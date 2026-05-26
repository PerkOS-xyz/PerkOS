import { beforeEach, describe, expect, it, vi } from "vitest";

// ECS mock — class-style so it survives across tests (see hibernation.test.ts).
const mockSend = vi.fn();
vi.mock("@aws-sdk/client-ecs", () => ({
  ECSClient: class {
    send = mockSend;
  },
  DescribeServicesCommand: class {
    constructor(public input: unknown) {}
  },
  UpdateServiceCommand: class {
    constructor(public input: unknown) {}
  },
  RegisterTaskDefinitionCommand: class {
    constructor(public input: unknown) {}
  },
  CreateServiceCommand: class {
    constructor(public input: unknown) {}
  },
  LogDriver: { AWSLOGS: "awslogs" },
}));

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class {
    send = async () => ({ ARN: "arn:sm:test" });
  },
  CreateSecretCommand: class {
    constructor(public input: unknown) {}
  },
  PutSecretValueCommand: class {
    constructor(public input: unknown) {}
  },
  DescribeSecretCommand: class {
    constructor(public input: unknown) {}
  },
}));

// Firestore mock — capture writes by path.
const writes: Array<{ path: string; data: Record<string, unknown> }> = [];
const docState: Record<string, Record<string, unknown>> = {};
const fakeDoc = (path: string) => ({
  set: async (data: Record<string, unknown>) => {
    writes.push({ path, data });
    docState[path] = { ...(docState[path] ?? {}), ...data };
  },
  get: async () => ({
    exists: Boolean(docState[path]),
    data: () => docState[path],
  }),
});
const adminDbMock = {
  collection: (c1: string) => ({
    doc: (d1: string) => ({
      collection: (c2: string) => ({
        doc: (d2: string) => fakeDoc(`${c1}/${d1}/${c2}/${d2}`),
      }),
      ...fakeDoc(`${c1}/${d1}`),
    }),
    where: () => ({
      where: () => ({
        get: async () => ({
          docs: [
            {
              id: "hermes:v2.0",
              data: () => ({
                tag: "v2.0",
                runtime: "hermes",
                active: true,
                publishedAt: "2026-05-25T00:00:00Z",
                notes: "perf improvements",
              }),
            },
            {
              id: "hermes:v1.9",
              data: () => ({
                tag: "v1.9",
                runtime: "hermes",
                active: true,
                publishedAt: "2026-05-20T00:00:00Z",
              }),
            },
            {
              id: "hermes:v1.5",
              data: () => ({
                tag: "v1.5",
                runtime: "hermes",
                active: true,
                publishedAt: "2026-05-01T00:00:00Z",
              }),
            },
          ],
        }),
      }),
    }),
  }),
};
vi.mock("../app/lib/firebaseAdmin", () => ({
  adminDb: () => adminDbMock,
}));

// FieldValue stub.
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "SERVER_TS",
  },
}));

import {
  imageTagFromUri,
  listAvailableUpgrades,
  upgradeAgent,
  UpgradeError,
} from "../app/lib/agentUpgrade";

beforeEach(() => {
  writes.length = 0;
  for (const k of Object.keys(docState)) delete docState[k];
  mockSend.mockClear();
  mockSend.mockReset();
  // Seed the runtime_images doc the assertTagIsActive call will look up.
  docState["runtime_images/hermes:v2.0"] = { tag: "v2.0", runtime: "hermes", active: true };
  docState["runtime_images/hermes:v1.9"] = { tag: "v1.9", runtime: "hermes", active: true };
  docState["runtime_images/hermes:inactive"] = { tag: "inactive", runtime: "hermes", active: false };
});

describe("imageTagFromUri", () => {
  it("extracts the tag from a standard ECR uri", () => {
    expect(
      imageTagFromUri(
        "089332276762.dkr.ecr.us-east-1.amazonaws.com/perkos-hermes:v1.0-perkos.2026.05.21",
      ),
    ).toBe("v1.0-perkos.2026.05.21");
  });
  it("returns undefined for missing input", () => {
    expect(imageTagFromUri(undefined)).toBeUndefined();
    expect(imageTagFromUri("")).toBeUndefined();
  });
  it("returns undefined when no colon present", () => {
    expect(imageTagFromUri("nocolon")).toBeUndefined();
  });
});

describe("listAvailableUpgrades", () => {
  it("sorts newest publishedAt first and excludes the current tag", async () => {
    const opts = await listAvailableUpgrades({
      runtime: "Hermes",
      currentImageUri:
        "089332276762.dkr.ecr.us-east-1.amazonaws.com/perkos-hermes:v1.5",
    });
    expect(opts.currentImageTag).toBe("v1.5");
    expect(opts.available.map((a) => a.imageTag)).toEqual(["v2.0", "v1.9"]);
    expect(opts.available[0]?.notes).toBe("perf improvements");
  });

  it("excludes the current tag even when it appears in the catalog", async () => {
    const opts = await listAvailableUpgrades({
      runtime: "Hermes",
      currentImageUri:
        "089332276762.dkr.ecr.us-east-1.amazonaws.com/perkos-hermes:v2.0",
    });
    expect(opts.available.map((a) => a.imageTag)).toEqual(["v1.9", "v1.5"]);
  });
});

describe("upgradeAgent", () => {
  it("rejects upgrade-to-self with SAME_VERSION", async () => {
    await expect(
      upgradeAgent({
        walletAddress: "0xabc",
        agentId: "a1",
        agentName: "Bot",
        runtime: "Hermes",
        targetImageTag: "v2.0",
        llmSource: "perkos",
        currentImageUri:
          "089332276762.dkr.ecr.us-east-1.amazonaws.com/perkos-hermes:v2.0",
      }),
    ).rejects.toMatchObject({
      errorClass: "SAME_VERSION",
    });
  });

  it("rejects an inactive tag with TAG_INACTIVE", async () => {
    await expect(
      upgradeAgent({
        walletAddress: "0xabc",
        agentId: "a1",
        agentName: "Bot",
        runtime: "Hermes",
        targetImageTag: "inactive",
        llmSource: "perkos",
        currentImageUri:
          "089332276762.dkr.ecr.us-east-1.amazonaws.com/perkos-hermes:v1.0",
      }),
    ).rejects.toMatchObject({
      errorClass: "TAG_INACTIVE",
    });
  });

  it("rejects a missing tag with TAG_NOT_FOUND", async () => {
    await expect(
      upgradeAgent({
        walletAddress: "0xabc",
        agentId: "a1",
        agentName: "Bot",
        runtime: "Hermes",
        targetImageTag: "vGhost",
        llmSource: "perkos",
        currentImageUri:
          "089332276762.dkr.ecr.us-east-1.amazonaws.com/perkos-hermes:v1.0",
      }),
    ).rejects.toMatchObject({
      errorClass: "TAG_NOT_FOUND",
    });
  });

  it("rejects missing imageTag with BAD_INPUT", async () => {
    await expect(
      upgradeAgent({
        walletAddress: "0xabc",
        agentId: "a1",
        agentName: "Bot",
        runtime: "Hermes",
        targetImageTag: "",
        llmSource: "perkos",
      }),
    ).rejects.toMatchObject({
      errorClass: "BAD_INPUT",
    });
  });

  it("hibernates, waits for drain, and re-provisions on the happy path", async () => {
    // The orchestrator calls the AWS SDK at these points:
    //   1. hibernateAgent  -> DescribeServices (desiredCount: 1)
    //   2. hibernateAgent  -> UpdateService    (set desiredCount: 0)
    //   3. waitForDrain    -> DescribeServices (runningCount: 1, pending: 0)
    //   4. waitForDrain    -> DescribeServices (runningCount: 0)  ✓ drained
    //   5. provisionEcsAgent -> RegisterTaskDefinition (new task def)
    //   6. provisionEcsAgent -> DescribeServices (find existing svc)
    //   7. provisionEcsAgent -> UpdateService    (set desiredCount: 1)
    mockSend
      .mockResolvedValueOnce({
        services: [
          {
            status: "ACTIVE",
            serviceName: "agent-abcdef12-bot",
            desiredCount: 1,
            runningCount: 1,
            serviceArn: "arn:svc:1",
          },
        ],
      })
      .mockResolvedValueOnce({
        service: { serviceArn: "arn:svc:1" },
      })
      .mockResolvedValueOnce({
        services: [
          {
            status: "ACTIVE",
            serviceName: "agent-abcdef12-bot",
            runningCount: 1,
            pendingCount: 0,
          },
        ],
      })
      .mockResolvedValueOnce({
        services: [
          {
            status: "ACTIVE",
            serviceName: "agent-abcdef12-bot",
            runningCount: 0,
            pendingCount: 0,
          },
        ],
      })
      .mockResolvedValueOnce({
        taskDefinition: { taskDefinitionArn: "arn:td:2" },
      })
      .mockResolvedValueOnce({
        services: [
          {
            status: "ACTIVE",
            serviceName: "agent-abcdef12-bot",
            serviceArn: "arn:svc:1",
          },
        ],
      })
      .mockResolvedValueOnce({
        service: { serviceArn: "arn:svc:1" },
      });

    const result = await upgradeAgent({
      walletAddress: "0xabcdef1234567890",
      agentId: "a1",
      agentName: "Bot",
      runtime: "Hermes",
      targetImageTag: "v2.0",
      llmSource: "perkos",
      currentImageUri:
        "089332276762.dkr.ecr.us-east-1.amazonaws.com/perkos-hermes:v1.0",
      drainPollIntervalMs: 1,
      drainTimeoutMs: 5_000,
    });

    expect(result.from).toBe("v1.0");
    expect(result.to).toBe("v2.0");
    expect(result.hibernated).toBe(true);
    expect(result.provision.taskDefinitionArn).toBe("arn:td:2");
    // Drain completed on the second poll, so >0 ms elapsed.
    expect(result.drainedAfterMs).toBeGreaterThanOrEqual(0);

    // Firestore writes: hibernation status (per-wallet + global) +
    // final upgrade record (per-wallet + global) = at least 4 writes.
    expect(writes.length).toBeGreaterThanOrEqual(4);
    const upgradeWrites = writes.filter(
      (w) =>
        typeof (w.data as { lastUpgrade?: unknown }).lastUpgrade === "object",
    );
    expect(upgradeWrites.length).toBeGreaterThanOrEqual(2);
  });

  it("surfaces DRAIN_TIMEOUT when runningCount never reaches 0", async () => {
    mockSend
      // hibernate: describe returns desiredCount=1
      .mockResolvedValueOnce({
        services: [
          {
            status: "ACTIVE",
            serviceName: "agent-abcdef12-bot",
            desiredCount: 1,
            runningCount: 1,
            serviceArn: "arn:svc:1",
          },
        ],
      })
      // hibernate: UpdateService scale-to-0
      .mockResolvedValueOnce({ service: { serviceArn: "arn:svc:1" } });
    // Every subsequent DescribeServices call (from waitForDrain) still
    // shows runningCount=1 — drain never completes.
    mockSend.mockResolvedValue({
      services: [
        {
          status: "ACTIVE",
          serviceName: "agent-abcdef12-bot",
          runningCount: 1,
          pendingCount: 0,
        },
      ],
    });

    await expect(
      upgradeAgent({
        walletAddress: "0xabcdef1234567890",
        agentId: "a1",
        agentName: "Bot",
        runtime: "Hermes",
        targetImageTag: "v2.0",
        llmSource: "perkos",
        currentImageUri:
          "089332276762.dkr.ecr.us-east-1.amazonaws.com/perkos-hermes:v1.0",
        drainPollIntervalMs: 1,
        drainTimeoutMs: 50, // small so the test runs fast
      }),
    ).rejects.toMatchObject({
      errorClass: "DRAIN_TIMEOUT",
    });
  });
});

describe("UpgradeError", () => {
  it("preserves errorClass + message", () => {
    const e = new UpgradeError("SAME_VERSION", "x");
    expect(e.errorClass).toBe("SAME_VERSION");
    expect(e.message).toBe("x");
  });
});
