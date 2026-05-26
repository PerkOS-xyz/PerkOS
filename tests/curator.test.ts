import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Firestore — not used by the pure `decide` path; only matters
// for the `runCuratorTick` tests that exercise the full orchestrator.
const fakeAgents: Array<{ id: string; data: Record<string, unknown> }> = [];
vi.mock("../app/lib/firebaseAdmin", () => ({
  adminDb: () => ({
    collection: (name: string) => {
      if (name !== "agents") {
        throw new Error(`unexpected collection ${name}`);
      }
      return {
        async get() {
          return {
            docs: fakeAgents.map((d) => ({ id: d.id, data: () => d.data })),
          };
        },
      };
    },
  }),
}));

// Stub hibernation lib — we don't want the curator tests to instantiate
// the real ECS client, just observe that hibernate would have been called.
vi.mock("../app/lib/hibernation", () => ({
  hibernateAgent: vi.fn(),
}));

import {
  DEFAULT_CONFIG,
  decide,
  loadConfigFromEnv,
  runCuratorTick,
} from "../app/lib/curator";

const NOW = new Date("2026-05-26T12:00:00Z");
function minsAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 60_000);
}

beforeEach(() => {
  fakeAgents.length = 0;
});

describe("loadConfigFromEnv", () => {
  it("returns defaults when env is empty", () => {
    const cfg = loadConfigFromEnv({} as NodeJS.ProcessEnv);
    expect(cfg.idleMinutes).toBe(60);
    expect(cfg.dryRun).toBe(true);
    expect(cfg.maxHibernationsPerTick).toBe(10);
    expect(cfg.skipNames.has("perkos-assistant")).toBe(true);
    expect(cfg.minAgeMinutes).toBe(15);
  });

  it("flips dryRun=false only on explicit 'false'", () => {
    expect(loadConfigFromEnv({ PERKOS_CURATOR_DRY_RUN: "false" } as never).dryRun).toBe(false);
    expect(loadConfigFromEnv({ PERKOS_CURATOR_DRY_RUN: "FALSE" } as never).dryRun).toBe(false);
    expect(loadConfigFromEnv({ PERKOS_CURATOR_DRY_RUN: "no" } as never).dryRun).toBe(true);
    expect(loadConfigFromEnv({ PERKOS_CURATOR_DRY_RUN: "" } as never).dryRun).toBe(true);
  });

  it("parses numeric env vars + ignores garbage", () => {
    const cfg = loadConfigFromEnv({
      PERKOS_CURATOR_IDLE_MINUTES: "120",
      PERKOS_CURATOR_MAX_PER_TICK: "5",
      PERKOS_CURATOR_MIN_AGE_MINUTES: "0",
    } as never);
    expect(cfg.idleMinutes).toBe(120);
    expect(cfg.maxHibernationsPerTick).toBe(5);
    expect(cfg.minAgeMinutes).toBe(0);

    const bad = loadConfigFromEnv({
      PERKOS_CURATOR_IDLE_MINUTES: "abc",
    } as never);
    expect(bad.idleMinutes).toBe(60); // falls back to default
  });

  it("parses skipNames as comma-separated lowercase set", () => {
    const cfg = loadConfigFromEnv({
      PERKOS_CURATOR_SKIP_NAMES: "MyBot, Helper ,perkos-assistant",
    } as never);
    expect(Array.from(cfg.skipNames).sort()).toEqual([
      "helper",
      "mybot",
      "perkos-assistant",
    ]);
  });
});

describe("decide", () => {
  it("flags an idle ECS agent for hibernation", () => {
    const decisions = decide({
      config: DEFAULT_CONFIG,
      now: NOW,
      agents: [
        {
          name: "Bot",
          walletAddress: "0xabc",
          updatedAt: minsAgo(120),
          createdAt: minsAgo(7 * 24 * 60),
          ecsServiceArn: "arn:svc:1",
          hibernationState: "active",
        },
      ],
    });
    expect(decisions[0]).toMatchObject({
      reason: "idle",
      idleMinutes: 120,
    });
  });

  it("skips agents on the allowlist", () => {
    const cfg = { ...DEFAULT_CONFIG, skipNames: new Set(["perkos-assistant"]) };
    const decisions = decide({
      config: cfg,
      now: NOW,
      agents: [
        {
          name: "PerkOS-Assistant",
          walletAddress: "0xabc",
          updatedAt: minsAgo(999),
          createdAt: minsAgo(999),
          ecsServiceArn: "arn:svc:1",
          hibernationState: "active",
        },
      ],
    });
    expect(decisions[0].reason).toBe("skipped-allowlist");
  });

  it("skips agents that aren't ECS-deployed", () => {
    const decisions = decide({
      config: DEFAULT_CONFIG,
      now: NOW,
      agents: [
        {
          name: "Local",
          walletAddress: "0xabc",
          updatedAt: minsAgo(999),
          createdAt: minsAgo(999),
        },
      ],
    });
    expect(decisions[0].reason).toBe("skipped-not-ecs");
  });

  it("skips agents already hibernated or hibernating", () => {
    const decisions = decide({
      config: DEFAULT_CONFIG,
      now: NOW,
      agents: [
        {
          name: "A",
          walletAddress: "0xabc",
          updatedAt: minsAgo(999),
          createdAt: minsAgo(999),
          ecsServiceArn: "arn:svc:1",
          hibernationState: "hibernated",
        },
        {
          name: "B",
          walletAddress: "0xabc",
          updatedAt: minsAgo(999),
          createdAt: minsAgo(999),
          ecsServiceArn: "arn:svc:2",
          hibernationState: "hibernating",
        },
      ],
    });
    expect(decisions.map((d) => d.reason)).toEqual([
      "skipped-already-hibernated",
      "skipped-already-hibernated",
    ]);
  });

  it("refuses to act when updatedAt is missing", () => {
    const decisions = decide({
      config: DEFAULT_CONFIG,
      now: NOW,
      agents: [
        {
          name: "Mystery",
          walletAddress: "0xabc",
          ecsServiceArn: "arn:svc:1",
          createdAt: minsAgo(999),
        },
      ],
    });
    expect(decisions[0].reason).toBe("skipped-no-updated-at");
  });

  it("refuses to act on agents younger than minAge", () => {
    const decisions = decide({
      config: { ...DEFAULT_CONFIG, minAgeMinutes: 30 },
      now: NOW,
      agents: [
        {
          name: "Fresh",
          walletAddress: "0xabc",
          updatedAt: minsAgo(999),
          createdAt: minsAgo(10), // newer than the 30-min floor
          ecsServiceArn: "arn:svc:1",
        },
      ],
    });
    expect(decisions[0].reason).toBe("skipped-too-young");
  });

  it("skips agents that aren't idle enough", () => {
    const decisions = decide({
      config: { ...DEFAULT_CONFIG, idleMinutes: 60 },
      now: NOW,
      agents: [
        {
          name: "Chatty",
          walletAddress: "0xabc",
          updatedAt: minsAgo(30),
          createdAt: minsAgo(999),
          ecsServiceArn: "arn:svc:1",
        },
      ],
    });
    expect(decisions[0]).toMatchObject({
      reason: "skipped-not-idle",
      idleMinutes: 30,
    });
  });

  it("enforces maxHibernationsPerTick — extras get skipped-cap-reached", () => {
    const cfg = { ...DEFAULT_CONFIG, maxHibernationsPerTick: 2 };
    const agents = Array.from({ length: 5 }, (_, i) => ({
      name: `bot-${i}`,
      walletAddress: "0xabc",
      updatedAt: minsAgo(120),
      createdAt: minsAgo(999),
      ecsServiceArn: `arn:svc:${i}`,
      hibernationState: "active",
    }));
    const decisions = decide({ config: cfg, now: NOW, agents });
    const idleCount = decisions.filter((d) => d.reason === "idle").length;
    const cappedCount = decisions.filter((d) => d.reason === "skipped-cap-reached").length;
    expect(idleCount).toBe(2);
    expect(cappedCount).toBe(3);
  });
});

describe("runCuratorTick (dryRun)", () => {
  it("returns decisions WITHOUT calling hibernate when dryRun=true", async () => {
    fakeAgents.push({
      id: "Bot",
      data: {
        name: "Bot",
        walletAddress: "0xabc",
        runtime: "hermes",
        ecs: { serviceArn: "arn:svc:1" },
        updatedAt: minsAgo(120),
        createdAt: minsAgo(9999),
      },
    });

    const hibernateMock = vi.fn();
    const result = await runCuratorTick({
      config: { ...DEFAULT_CONFIG, dryRun: true, idleMinutes: 60, minAgeMinutes: 0 },
      now: NOW,
      hibernate: hibernateMock,
      loadAgents: async () => [
        {
          name: "Bot",
          walletAddress: "0xabc",
          updatedAt: minsAgo(120),
          createdAt: minsAgo(9999),
          ecsServiceArn: "arn:svc:1",
          hibernationState: "active",
        },
      ],
    });

    expect(result.dryRun).toBe(true);
    expect(result.decisions[0].reason).toBe("idle");
    expect(result.hibernated).toHaveLength(0);
    expect(hibernateMock).not.toHaveBeenCalled();
  });
});

describe("runCuratorTick (live)", () => {
  it("calls hibernate for each 'idle' decision and records results", async () => {
    const hibernateMock = vi.fn().mockImplementation(async (input) => ({
      serviceArn: "arn:svc:1",
      previousDesiredCount: 1,
      newDesiredCount: 0,
      state: "hibernating",
      _input: input,
    }));
    const resolveAgentIdMock = vi.fn().mockResolvedValue("doc-id-bot");

    const result = await runCuratorTick({
      config: { ...DEFAULT_CONFIG, dryRun: false, idleMinutes: 60, minAgeMinutes: 0 },
      now: NOW,
      hibernate: hibernateMock,
      resolveAgentId: resolveAgentIdMock,
      loadAgents: async () => [
        {
          name: "Bot",
          walletAddress: "0xabc",
          updatedAt: minsAgo(120),
          createdAt: minsAgo(9999),
          ecsServiceArn: "arn:svc:1",
          hibernationState: "active",
        },
      ],
    });

    expect(result.dryRun).toBe(false);
    expect(result.hibernated).toHaveLength(1);
    expect(result.hibernated[0].name).toBe("Bot");
    expect(result.hibernated[0].error).toBeUndefined();
    expect(hibernateMock).toHaveBeenCalledOnce();
    expect(hibernateMock).toHaveBeenCalledWith({
      walletAddress: "0xabc",
      agentId: "doc-id-bot",
      agentName: "Bot",
    });
    expect(resolveAgentIdMock).toHaveBeenCalledWith("0xabc", "Bot");
  });

  it("captures hibernate failures per-agent without aborting the tick", async () => {
    const hibernateMock = vi
      .fn()
      .mockResolvedValueOnce({ previousDesiredCount: 1, newDesiredCount: 0, state: "hibernating", serviceArn: "a" })
      .mockRejectedValueOnce(new Error("ECS api down"));

    const result = await runCuratorTick({
      config: { ...DEFAULT_CONFIG, dryRun: false, idleMinutes: 60, minAgeMinutes: 0 },
      now: NOW,
      hibernate: hibernateMock,
      resolveAgentId: async (_w, name) => `doc-${name}`,
      loadAgents: async () => [
        {
          name: "OK",
          walletAddress: "0xabc",
          updatedAt: minsAgo(120),
          createdAt: minsAgo(9999),
          ecsServiceArn: "arn:1",
          hibernationState: "active",
        },
        {
          name: "BOOM",
          walletAddress: "0xabc",
          updatedAt: minsAgo(120),
          createdAt: minsAgo(9999),
          ecsServiceArn: "arn:2",
          hibernationState: "active",
        },
      ],
    });

    expect(result.hibernated).toHaveLength(2);
    expect(result.hibernated[0].error).toBeUndefined();
    expect(result.hibernated[1].error).toContain("ECS api down");
  });

  it("emits error when resolveAgentId returns null", async () => {
    const result = await runCuratorTick({
      config: { ...DEFAULT_CONFIG, dryRun: false, idleMinutes: 60, minAgeMinutes: 0 },
      now: NOW,
      hibernate: vi.fn(),
      resolveAgentId: async () => null,
      loadAgents: async () => [
        {
          name: "Bot",
          walletAddress: "0xabc",
          updatedAt: minsAgo(120),
          createdAt: minsAgo(9999),
          ecsServiceArn: "arn:1",
          hibernationState: "active",
        },
      ],
    });
    expect(result.hibernated[0].error).toContain("agentId not found");
  });
});
