/**
 * ensureAgentAwake — the building block for auto-wake.
 *
 * Caller intent: "I'm about to interact with this agent — make sure
 * it's online, wake it from hibernation if needed, optionally wait
 * until a task is actually running." Returns enough info for the
 * caller to either display a "waking up…" indicator or fail through.
 *
 * Used by:
 *   - The agent detail page (auto-wake banner)
 *   - Future: chat.perkos.xyz incoming-message hook (when chat ingest
 *     supports webhooks back to the miniapp)
 *   - Future: per-agent chat surface inside the miniapp
 *
 * Safety:
 *   - Caller verifies ownership BEFORE calling this. The helper trusts
 *     the wallet/agentId/agentName it receives.
 *   - Wake is idempotent (hibernation.ts handles already-running as a
 *     no-op), so a repeated ensureAwake is cheap.
 *   - The optional poll-until-running step is capped (default 60s) to
 *     keep the UI/HTTP timeout sane.
 *
 * Metric coverage:
 *   The underlying hibernation.wake call increments
 *   `perkos_wake_total{result}`. ensureAwake itself adds
 *   `perkos_ensure_awake_total{state}` so we can split "no-op"
 *   (already awake) from "triggered wake" (caused a real scale-up).
 */
import "server-only";

import { getHibernationStatus, wakeAgent } from "./hibernation";
import { getMetrics } from "./metrics";

export type EnsureAwakeInput = {
  walletAddress: string;
  agentId: string;
  agentName: string;
  /** When true (default), poll DescribeServices until runningCount > 0
   *  or we hit the timeout. When false, return after triggering wake
   *  without waiting — useful for fire-and-forget callers. */
  waitForRunning?: boolean;
  /** Cap on the wait. Default 60s. */
  waitTimeoutMs?: number;
  /** Poll interval. Default 3s. */
  pollIntervalMs?: number;
};

export type EnsureAwakeOutcome = {
  /** Hibernation state we observed at entry. */
  initialState: "active" | "hibernating" | "hibernated" | "waking";
  /** Hibernation state at exit (may equal initialState for no-ops). */
  finalState: "active" | "hibernating" | "hibernated" | "waking";
  /** True iff we issued a wake call as part of this invocation. */
  triggeredWake: boolean;
  /** Whether at least one task is in runningCount at exit. */
  online: boolean;
  /** Time spent waiting for the task to come up; 0 if we didn't wait. */
  waitedMs: number;
  /** Set when waitForRunning=true and the timeout elapsed without a
   *  running task — caller can decide whether to keep trying. */
  timedOut?: true;
};

/**
 * Inject-friendly variant for unit tests — wraps real
 * getHibernationStatus + wakeAgent by default but accepts overrides.
 */
export async function ensureAgentAwake(
  input: EnsureAwakeInput,
  deps?: {
    getStatus?: typeof getHibernationStatus;
    wake?: typeof wakeAgent;
  },
): Promise<EnsureAwakeOutcome> {
  const metrics = getMetrics();
  const getStatusImpl = deps?.getStatus ?? getHibernationStatus;
  const wakeImpl = deps?.wake ?? wakeAgent;
  const waitForRunning = input.waitForRunning ?? true;
  const waitTimeoutMs = input.waitTimeoutMs ?? 60_000;
  const pollIntervalMs = input.pollIntervalMs ?? 3_000;
  const start = Date.now();

  const initial = await getStatusImpl({
    walletAddress: input.walletAddress,
    agentId: input.agentId,
    agentName: input.agentName,
  });
  const initialState = initial.state;

  // We bump the metric exactly ONCE per call, on the way out, with the
  // most-specific label. Avoids the old shape where "waking" agents
  // would bump both "noop" (on entry) and "timeout" (after poll) for
  // a single invocation.
  const exitWith = (
    label: "noop" | "triggered" | "timeout",
    payload: EnsureAwakeOutcome,
  ): EnsureAwakeOutcome => {
    metrics.ensureAwakeTotal.inc({ state: label });
    return payload;
  };

  // Fast paths: already running and not transitioning → done.
  if (initial.runningCount > 0 && initial.state === "active") {
    return exitWith("noop", {
      initialState,
      finalState: "active",
      triggeredWake: false,
      online: true,
      waitedMs: 0,
    });
  }

  // If we're already "waking", don't re-issue wake — just wait.
  let triggeredWake = false;
  if (initial.state === "hibernated" || initial.state === "hibernating") {
    await wakeImpl({
      walletAddress: input.walletAddress,
      agentId: input.agentId,
      agentName: input.agentName,
    });
    triggeredWake = true;
  }

  if (!waitForRunning) {
    return exitWith(triggeredWake ? "triggered" : "noop", {
      initialState,
      finalState: "waking",
      triggeredWake,
      online: false,
      waitedMs: 0,
    });
  }

  // Poll until at least one task is running, or we time out.
  while (Date.now() - start < waitTimeoutMs) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    const cur = await getStatusImpl({
      walletAddress: input.walletAddress,
      agentId: input.agentId,
      agentName: input.agentName,
    });
    if (cur.runningCount > 0) {
      return exitWith(triggeredWake ? "triggered" : "noop", {
        initialState,
        finalState: "active",
        triggeredWake,
        online: true,
        waitedMs: Date.now() - start,
      });
    }
  }

  // Timed out — the caller can decide whether to keep waiting or surface
  // the partial outcome to the user.
  return exitWith("timeout", {
    initialState,
    finalState: "waking",
    triggeredWake,
    online: false,
    waitedMs: Date.now() - start,
    timedOut: true,
  });
}
