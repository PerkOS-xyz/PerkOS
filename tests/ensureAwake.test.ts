import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensureAgentAwake } from "../app/lib/ensureAwake";
import { getRegistry } from "../app/lib/metrics";

beforeEach(() => {
  getRegistry().resetMetrics();
});

const INPUT = {
  walletAddress: "0xabc",
  agentId: "a1",
  agentName: "Bot",
};

function status(overrides: {
  state: "active" | "hibernating" | "hibernated" | "waking";
  running?: number;
  desired?: number;
}) {
  return {
    state: overrides.state,
    desiredCount: overrides.desired ?? (overrides.running ?? 0 > 0 ? 1 : 0),
    runningCount: overrides.running ?? 0,
    pendingCount: 0,
    snapshot: { bucket: "b", prefix: "p/" },
  };
}

describe("ensureAgentAwake", () => {
  it("fast-path: already active + running → no wake, noop result", async () => {
    const getStatus = vi.fn().mockResolvedValue(status({ state: "active", running: 1 }));
    const wake = vi.fn();
    const out = await ensureAgentAwake(INPUT, { getStatus, wake });
    expect(wake).not.toHaveBeenCalled();
    expect(out.triggeredWake).toBe(false);
    expect(out.online).toBe(true);
    expect(out.initialState).toBe("active");
    expect(out.finalState).toBe("active");
    expect(out.waitedMs).toBe(0);
  });

  it("hibernated → calls wake + waits for running", async () => {
    let pollN = 0;
    const getStatus = vi.fn().mockImplementation(async () => {
      // First call (entry probe): hibernated.
      // Subsequent calls (poll loop): runningCount goes 0 → 0 → 1
      pollN++;
      if (pollN === 1) return status({ state: "hibernated", running: 0, desired: 0 });
      if (pollN < 3) return status({ state: "waking", running: 0, desired: 1 });
      return status({ state: "active", running: 1, desired: 1 });
    });
    const wake = vi.fn().mockResolvedValue({});
    const out = await ensureAgentAwake(
      { ...INPUT, pollIntervalMs: 5, waitTimeoutMs: 1_000 },
      { getStatus, wake },
    );
    expect(wake).toHaveBeenCalledOnce();
    expect(out.triggeredWake).toBe(true);
    expect(out.online).toBe(true);
    expect(out.finalState).toBe("active");
    expect(out.timedOut).toBeUndefined();
  });

  it("hibernating (already in transition) → still issues wake (idempotent) + waits", async () => {
    let pollN = 0;
    const getStatus = vi.fn().mockImplementation(async () => {
      pollN++;
      if (pollN === 1) return status({ state: "hibernating", running: 1, desired: 0 });
      return status({ state: "active", running: 1, desired: 1 });
    });
    const wake = vi.fn().mockResolvedValue({});
    const out = await ensureAgentAwake(
      { ...INPUT, pollIntervalMs: 5 },
      { getStatus, wake },
    );
    expect(wake).toHaveBeenCalledOnce();
    expect(out.triggeredWake).toBe(true);
  });

  it("waking (mid-wake) → does NOT re-issue wake, just waits", async () => {
    let pollN = 0;
    const getStatus = vi.fn().mockImplementation(async () => {
      pollN++;
      if (pollN === 1) return status({ state: "waking", running: 0, desired: 1 });
      return status({ state: "active", running: 1, desired: 1 });
    });
    const wake = vi.fn();
    const out = await ensureAgentAwake(
      { ...INPUT, pollIntervalMs: 5 },
      { getStatus, wake },
    );
    expect(wake).not.toHaveBeenCalled();
    expect(out.triggeredWake).toBe(false);
    expect(out.online).toBe(true);
  });

  it("waitForRunning=false → returns immediately after wake", async () => {
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce(status({ state: "hibernated", running: 0, desired: 0 }));
    const wake = vi.fn().mockResolvedValue({});
    const out = await ensureAgentAwake(
      { ...INPUT, waitForRunning: false },
      { getStatus, wake },
    );
    expect(wake).toHaveBeenCalledOnce();
    expect(out.triggeredWake).toBe(true);
    expect(out.online).toBe(false);
    expect(out.finalState).toBe("waking");
    // Only the entry probe was called; no poll-loop calls.
    expect(getStatus).toHaveBeenCalledOnce();
  });

  it("timeout → returns timedOut=true with the partial outcome", async () => {
    // First call: hibernated. Every subsequent: still 0 running.
    const getStatus = vi.fn().mockImplementation(async () =>
      status({ state: "waking", running: 0, desired: 1 }),
    );
    const wake = vi.fn().mockResolvedValue({});
    // Make the inputs make a short loop: 50ms total, poll every 10ms.
    const out = await ensureAgentAwake(
      { ...INPUT, pollIntervalMs: 10, waitTimeoutMs: 50 },
      { getStatus, wake },
    );
    expect(out.timedOut).toBe(true);
    expect(out.online).toBe(false);
    expect(out.waitedMs).toBeGreaterThanOrEqual(40);
  });
});
