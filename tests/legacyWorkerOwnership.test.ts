import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(), reads: [] as string[], writes: [] as string[],
  failRead: "", aws: vi.fn(), provision: vi.fn(), register: vi.fn(),
  running: vi.fn(), log: vi.fn(), ready: vi.fn(), failed: vi.fn(),
}));
function ref(path: string) {
  return {
    get: async () => {
      fixture.reads.push(path);
      if (path === fixture.failRead) throw new Error("synthetic read unavailable");
      return { exists: fixture.docs.has(path), data: () => fixture.docs.get(path) };
    },
    set: async (data: Record<string, unknown>) => {
      fixture.writes.push(path);
      fixture.docs.set(path, { ...fixture.docs.get(path), ...data });
    },
    collection: (name: string) => ({ doc: (id: string) => ref(`${path}/${name}/${id}`) }),
  };
}
vi.mock("../app/lib/firebaseAdmin", () => ({ adminDb: () => ({ collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }) }) }));
vi.mock("../app/lib/ecsProvision", () => ({ provisionEcsAgent: fixture.provision }));
vi.mock("../app/lib/llmAgentRegistry", () => ({ registerLlmAgent: fixture.register }));
vi.mock("../app/lib/provisionJobs", () => ({ markRunning: fixture.running, appendLog: fixture.log, completeJob: fixture.ready, failJob: fixture.failed }));
vi.mock("@aws-sdk/client-ecs", () => ({
  ECSClient: class { send = fixture.aws; },
  DescribeServicesCommand: class { constructor(public input: unknown) {} },
  UpdateServiceCommand: class { constructor(public input: unknown) {} },
}));

import { loadLegacyAgentOperation } from "../app/lib/agentOwnership";
import { processJob } from "../app/worker/processJob";
import { hibernateAgent, wakeAgent, getHibernationStatus } from "../app/lib/hibernation";
import { upgradeAgent } from "../app/lib/agentUpgrade";
import type { ProvisionJob } from "../app/lib/provisionJobs";

const wallet = `0x${"ab".repeat(20)}`;
const other = `0x${"cd".repeat(20)}`;
const input = { walletAddress: wallet, agentId: "auto-id", agentName: "Fixture" };
const mirror = `wallets/${wallet}/agents/auto-id`;
function job(llmSource: "perkos" | "byok" = "perkos"): ProvisionJob {
  return { ...input, jobId: "fixture-job", status: "claimed", input: { runtime: "Hermes", imageTag: "v2", llmSource }, attempts: 1, claimedBy: "fixture-worker", result: null, error: null };
}
beforeEach(() => {
  fixture.docs.clear(); fixture.reads.length = 0; fixture.writes.length = 0; fixture.failRead = "";
  vi.clearAllMocks();
  fixture.docs.set(mirror, { name: "Fixture", walletAddress: wallet });
  fixture.docs.set("agents/Fixture", { name: "Fixture", walletAddress: wallet, agentId: "auto-id", relayApiKey: "synthetic-relay" });
  fixture.docs.set("runtime_images/hermes:v2", { active: true });
  fixture.register.mockResolvedValue({ key: "synthetic-llm", last4: "test" });
  fixture.provision.mockResolvedValue({ serviceArn: "synthetic-service", taskDefinitionArn: "synthetic-definition", imageUri: "fixture:v2" });
});

describe("retired worker authorization", () => {
  it.each(["wake", "hibernate", "delete", "upgrade", "unknown"])("cannot reinterpret an API %s job as launch", async kind => {
    const forged = job();
    Object.assign(forged.input, { kind });
    await processJob(forged);
    expect(fixture.failed).toHaveBeenCalledOnce();
    expect(fixture.reads).toEqual([]); expect(fixture.writes).toEqual([]);
    expect(fixture.register).not.toHaveBeenCalled(); expect(fixture.provision).not.toHaveBeenCalled();
  });
  const mutations = [
    ["missing registry", () => fixture.docs.delete("agents/Fixture")],
    ["foreign owner", () => fixture.docs.set("agents/Fixture", { walletAddress: other, agentId: "auto-id" })],
    ["wrong ID", () => fixture.docs.set("agents/Fixture", { walletAddress: wallet, agentId: "foreign-id" })],
    ["missing mirror", () => fixture.docs.delete(mirror)],
    ["forged mirror", () => fixture.docs.set(mirror, { name: "Fixture", walletAddress: other })],
    ["read failure", () => { fixture.failRead = "agents/Fixture"; }],
  ] as const;
  for (const [label, mutate] of mutations) {
    it(`provisioner blocks ${label} before credentials or resources`, async () => {
      mutate();
      await processJob(job("byok"));
      expect(fixture.failed).toHaveBeenCalledOnce();
      expect(fixture.ready).not.toHaveBeenCalled();
      expect(fixture.register).not.toHaveBeenCalled();
      expect(fixture.provision).not.toHaveBeenCalled();
      expect(fixture.reads.some((path) => path.startsWith("agent_secrets/"))).toBe(false);
      expect(fixture.writes).toEqual([]);
    });
    for (const [operation, run] of [
      ["hibernate", () => hibernateAgent(input)], ["wake", () => wakeAgent(input)],
      ["status", () => getHibernationStatus(input)],
      ["upgrade", () => upgradeAgent({ ...input, runtime: "Hermes", targetImageTag: "v2", llmSource: "perkos" })],
    ] as const) {
      it(`${operation} blocks ${label} before AWS and writes`, async () => {
        mutate();
        await expect(run()).rejects.toThrow();
        expect(fixture.aws).not.toHaveBeenCalled();
        expect(fixture.provision).not.toHaveBeenCalled();
        expect(fixture.writes).toEqual([]);
      });
    }
  }
  it.each(["So11111111111111111111111111111111111111112", "platform", "0xabc"])("rejects unsupported legacy wallet %s without reads", async walletAddress => {
    await expect(loadLegacyAgentOperation({ ...input, walletAddress })).rejects.toThrow("Agent authorization unavailable");
    expect(fixture.reads).toEqual([]);
  });
  it("uses only the authoritative ID for internal name-based callers", async () => {
    fixture.docs.set(`wallets/${wallet}/agents/Fixture`, { name: "Fixture" });
    await expect(loadLegacyAgentOperation({ ...input, agentId: "Fixture" })).resolves.toMatchObject({ wallet, id: "auto-id" });
    expect(fixture.reads).not.toContain(`wallets/${wallet}/agents/Fixture`);
  });
  it("provisions a bound normalized EVM agent with its verified relay", async () => {
    await processJob({ ...job(), walletAddress: `0x${"AB".repeat(20)}` });
    expect(fixture.register).toHaveBeenCalledWith("Fixture");
    expect(fixture.provision).toHaveBeenCalledWith(expect.objectContaining({ walletAddress: wallet, agentId: "auto-id", relayApiKey: "synthetic-relay" }));
    expect(fixture.ready).toHaveBeenCalledOnce();
    expect(fixture.failed).not.toHaveBeenCalled();
  });
  it("reads BYOK only under the proven owner and ID", async () => {
    fixture.docs.set(`agent_secrets/${wallet}/agents/auto-id`, { modelKey: "synthetic-byok" });
    await processJob(job("byok"));
    expect(fixture.register).not.toHaveBeenCalled();
    expect(fixture.provision).toHaveBeenCalledWith(expect.objectContaining({ byokApiKey: "synthetic-byok" }));
    expect(fixture.ready).toHaveBeenCalledOnce();
  });
  it("revalidates after gateway registration before ECS", async () => {
    fixture.register.mockImplementationOnce(async () => {
      fixture.docs.set("agents/Fixture", { walletAddress: other, agentId: "auto-id" });
      return { key: "synthetic-llm", last4: "test" };
    });
    await processJob(job());
    expect(fixture.provision).not.toHaveBeenCalled();
    expect(fixture.failed).toHaveBeenCalledOnce();
  });
});
