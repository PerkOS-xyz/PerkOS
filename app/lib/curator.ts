/**
 * Curator — picks idle agents and hibernates them automatically.
 *
 * Why a curator?
 *   Manual hibernation (the Hibernate button on the agent detail page)
 *   covers the case where the owner KNOWS they're done for the day.
 *   Most aren't that disciplined — agents sit at desiredCount=1 24/7
 *   even when nobody's talking to them. The curator runs on a timer,
 *   asks "is this agent idle?", and if so, calls the same hibernate
 *   primitive the UI does. End result: idle agents drop from ~$18/mo
 *   Fargate cost to ~$0.02/mo S3 snapshot cost without anyone clicking
 *   a button.
 *
 * Safety rails:
 *   - Dry-run mode (default in dev): logs decisions, takes no action.
 *   - Allowlist skip-list (env): names that must never be hibernated
 *     by the curator (e.g. the PerkOS Assistant itself).
 *   - Idle threshold is in minutes, configurable via env so we can dial
 *     it conservatively at launch and tighten it once we trust the
 *     signal.
 *   - Activity proxy is `updatedAt` on the global agent doc — anything
 *     that writes the doc (chat ingest, tool calls, user edits) bumps
 *     it. Agents missing the field are SKIPPED, not hibernated; we
 *     never act on absence of evidence.
 *   - Already-hibernated agents are skipped. Re-hibernating a hibernated
 *     agent is a no-op anyway but we don't waste an ECS round-trip on it.
 *
 * What this module does NOT do:
 *   - It does not wake agents. Wake is always user-initiated (a chat
 *     message arrives, or the user clicks Wake). Auto-wake on incoming
 *     chat is a future PR — for now, hibernated agents stay hibernated
 *     until the owner pings them.
 *
 * Out-of-band proxy reads:
 *   - We read the GLOBAL /agents/{name} doc, not per-wallet docs, so
 *     the curator doesn't need to enumerate every wallet. Per-wallet
 *     state is written by hibernateAgent() so the UI sees it too.
 */
import "server-only";

import { adminDb } from "./firebaseAdmin";
import { hibernateAgent, type HibernationActionResult } from "./hibernation";
import { getMetrics } from "./metrics";

export type CuratorConfig = {
  /**
   * Minutes since updatedAt before an agent is considered idle.
   * Default 60. Set higher (e.g. 240) during initial rollout.
   */
  idleMinutes: number;
  /**
   * If true, log decisions without calling hibernate. Default true
   * unless explicitly disabled — fail-closed.
   */
  dryRun: boolean;
  /**
   * Hard cap on agents hibernated per tick. Prevents a config mistake
   * (e.g. idleMinutes=0) from hibernating the entire fleet in one go.
   */
  maxHibernationsPerTick: number;
  /** Lowercased agent names that the curator must never touch. */
  skipNames: Set<string>;
  /**
   * Floor on agent age in minutes — newer agents are always skipped
   * even if updatedAt looks old. Prevents racing the provisioner.
   */
  minAgeMinutes: number;
};

export const DEFAULT_CONFIG: CuratorConfig = {
  idleMinutes: 60,
  dryRun: true,
  maxHibernationsPerTick: 10,
  skipNames: new Set(["perkos-assistant"]),
  minAgeMinutes: 15,
};

export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): CuratorConfig {
  const num = (key: string, fallback: number, min = 0): number => {
    const raw = env[key];
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= min ? n : fallback;
  };
  // dryRun: explicit `false` flips it off; anything else stays true.
  const dryRunRaw = (env.PERKOS_CURATOR_DRY_RUN ?? "true").trim().toLowerCase();
  const dryRun = dryRunRaw !== "false";
  const skipNames = new Set(
    (env.PERKOS_CURATOR_SKIP_NAMES ?? "perkos-assistant")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return {
    idleMinutes: num("PERKOS_CURATOR_IDLE_MINUTES", 60, 1),
    dryRun,
    maxHibernationsPerTick: num("PERKOS_CURATOR_MAX_PER_TICK", 10, 1),
    skipNames,
    minAgeMinutes: num("PERKOS_CURATOR_MIN_AGE_MINUTES", 15, 0),
  };
}

export type CuratorDecisionReason =
  | "idle"
  | "skipped-allowlist"
  | "skipped-already-hibernated"
  | "skipped-no-updated-at"
  | "skipped-too-young"
  | "skipped-not-idle"
  | "skipped-not-ecs"
  | "skipped-cap-reached";

export type CuratorDecision = {
  name: string;
  walletAddress: string;
  reason: CuratorDecisionReason;
  /** Minutes since updatedAt, or undefined when no timestamp. */
  idleMinutes?: number;
  hibernationState?: string;
};

type AgentRecord = {
  name: string;
  walletAddress: string;
  updatedAt?: Date;
  createdAt?: Date;
  ecsServiceArn?: string;
  hibernationState?: string;
};

function tsToDate(v: unknown): Date | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const maybe = v as { toDate?: () => Date };
  if (typeof maybe.toDate === "function") return maybe.toDate();
  return undefined;
}

/**
 * Read every agent in /agents and project the fields the curator needs.
 * Filter at the projection layer so the decision logic operates on a
 * simple shape that's easy to unit-test.
 */
export async function loadCandidateAgents(): Promise<AgentRecord[]> {
  const snap = await adminDb().collection("agents").get();
  const out: AgentRecord[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const ecs = (data.ecs as { serviceArn?: string } | undefined) ?? undefined;
    const hibernation =
      (data.hibernation as { state?: string } | undefined) ?? undefined;
    out.push({
      name: doc.id,
      walletAddress:
        typeof data.walletAddress === "string" ? data.walletAddress : "",
      updatedAt: tsToDate(data.updatedAt),
      createdAt: tsToDate(data.createdAt),
      ecsServiceArn: ecs?.serviceArn,
      hibernationState: hibernation?.state,
    });
  }
  return out;
}

/**
 * Pure decision function — takes a config + the projected agent list +
 * a "now" anchor, returns one decision per agent. No I/O, no side
 * effects. The runtime wrapper iterates the decisions and acts.
 */
export function decide(opts: {
  config: CuratorConfig;
  agents: AgentRecord[];
  now: Date;
}): CuratorDecision[] {
  const { config, agents, now } = opts;
  const decisions: CuratorDecision[] = [];
  let actsThisTick = 0;

  for (const agent of agents) {
    const base = { name: agent.name, walletAddress: agent.walletAddress };

    if (config.skipNames.has(agent.name.toLowerCase())) {
      decisions.push({ ...base, reason: "skipped-allowlist" });
      continue;
    }

    if (!agent.ecsServiceArn) {
      decisions.push({ ...base, reason: "skipped-not-ecs" });
      continue;
    }

    if (
      agent.hibernationState === "hibernated" ||
      agent.hibernationState === "hibernating"
    ) {
      decisions.push({
        ...base,
        reason: "skipped-already-hibernated",
        hibernationState: agent.hibernationState,
      });
      continue;
    }

    if (!agent.updatedAt) {
      // No activity signal — refuse to act on absence of evidence.
      decisions.push({ ...base, reason: "skipped-no-updated-at" });
      continue;
    }

    if (agent.createdAt) {
      const ageMin = (now.getTime() - agent.createdAt.getTime()) / 60_000;
      if (ageMin < config.minAgeMinutes) {
        decisions.push({ ...base, reason: "skipped-too-young" });
        continue;
      }
    }

    const idleMin = (now.getTime() - agent.updatedAt.getTime()) / 60_000;
    if (idleMin < config.idleMinutes) {
      decisions.push({
        ...base,
        reason: "skipped-not-idle",
        idleMinutes: Math.floor(idleMin),
      });
      continue;
    }

    if (actsThisTick >= config.maxHibernationsPerTick) {
      decisions.push({
        ...base,
        reason: "skipped-cap-reached",
        idleMinutes: Math.floor(idleMin),
      });
      continue;
    }

    decisions.push({
      ...base,
      reason: "idle",
      idleMinutes: Math.floor(idleMin),
    });
    actsThisTick++;
  }

  return decisions;
}

export type CuratorTickResult = {
  config: CuratorConfig;
  decisions: CuratorDecision[];
  hibernated: Array<{
    name: string;
    walletAddress: string;
    result?: HibernationActionResult;
    error?: string;
  }>;
  dryRun: boolean;
};

/**
 * Execute one curator tick: load → decide → (act unless dryRun).
 * Returns the full decision set so callers can log/metrics them.
 */
export async function runCuratorTick(opts?: {
  config?: CuratorConfig;
  now?: Date;
  hibernate?: typeof hibernateAgent;
  loadAgents?: typeof loadCandidateAgents;
  /** Per-wallet/agent lookup of the doc id (since hibernateAgent
   *  needs agentId, not just name). Defaults to a Firestore lookup. */
  resolveAgentId?: (walletAddress: string, agentName: string) => Promise<string | null>;
}): Promise<CuratorTickResult> {
  const config = opts?.config ?? loadConfigFromEnv();
  const now = opts?.now ?? new Date();
  const hibernateImpl = opts?.hibernate ?? hibernateAgent;
  const loadImpl = opts?.loadAgents ?? loadCandidateAgents;
  const resolveAgentIdImpl =
    opts?.resolveAgentId ?? defaultResolveAgentId;
  const metrics = getMetrics();
  const tickStartHr = process.hrtime.bigint();

  const agents = await loadImpl();
  const decisions = decide({ config, agents, now });

  // Count every decision so the dashboard can show why nothing
  // happened (vs. dry-run "would have").
  for (const d of decisions) {
    metrics.curatorDecisionTotal.inc({ reason: d.reason });
  }

  const hibernated: CuratorTickResult["hibernated"] = [];

  if (config.dryRun) {
    const durationSec =
      Number(process.hrtime.bigint() - tickStartHr) / 1_000_000_000;
    metrics.curatorTickDuration.observe({ dryRun: "true" }, durationSec);
    return { config, decisions, hibernated, dryRun: true };
  }

  for (const d of decisions) {
    if (d.reason !== "idle") continue;
    let agentId: string | null = null;
    try {
      agentId = await resolveAgentIdImpl(d.walletAddress, d.name);
    } catch (err) {
      metrics.curatorHibernationsTotal.inc({ result: "resolve-error" });
      hibernated.push({
        name: d.name,
        walletAddress: d.walletAddress,
        error: `resolveAgentId failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }
    if (!agentId) {
      metrics.curatorHibernationsTotal.inc({ result: "agent-id-missing" });
      hibernated.push({
        name: d.name,
        walletAddress: d.walletAddress,
        error: "agentId not found for wallet/name pair",
      });
      continue;
    }
    try {
      const result = await hibernateImpl({
        walletAddress: d.walletAddress,
        agentId,
        agentName: d.name,
      });
      metrics.curatorHibernationsTotal.inc({ result: "success" });
      hibernated.push({
        name: d.name,
        walletAddress: d.walletAddress,
        result,
      });
    } catch (err) {
      metrics.curatorHibernationsTotal.inc({ result: "error" });
      hibernated.push({
        name: d.name,
        walletAddress: d.walletAddress,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const durationSec =
    Number(process.hrtime.bigint() - tickStartHr) / 1_000_000_000;
  metrics.curatorTickDuration.observe({ dryRun: "false" }, durationSec);
  return { config, decisions, hibernated, dryRun: false };
}

/**
 * Default resolver — finds the per-wallet agent doc id by querying for
 * the agent name under the wallet's subcollection. We need this because
 * /agents/{name} is keyed by name, but hibernateAgent + Firestore writes
 * key by the doc id under /wallets/{addr}/agents/{id}.
 */
async function defaultResolveAgentId(
  walletAddress: string,
  agentName: string,
): Promise<string | null> {
  // Query `limit(2)` (not 1) so we can DETECT duplicates rather than
  // silently picking one. The launch route should enforce uniqueness
  // per (wallet, name), but a failed-then-retried provision could
  // leave two docs with the same name under the same wallet. If we
  // resolved to "the first match" the curator could hibernate the
  // wrong doc; throwing here makes the operator notice + clean up.
  const snap = await adminDb()
    .collection("wallets")
    .doc(walletAddress.toLowerCase())
    .collection("agents")
    .where("name", "==", agentName)
    .limit(2)
    .get();
  if (snap.empty) return null;
  if (snap.docs.length > 1) {
    throw new Error(
      `Ambiguous (wallet, name): ${walletAddress}/${agentName} has ` +
        `multiple agent docs. Refusing to hibernate either; resolve the ` +
        `duplicate in Firestore first.`,
    );
  }
  return snap.docs[0]!.id;
}
