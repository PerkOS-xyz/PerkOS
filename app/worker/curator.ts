/**
 * PerkOS curator worker.
 *
 * Long-running process — runs the curator tick on a schedule. Same
 * shape as provisioner.ts (separate Docker container, same image,
 * graceful SIGTERM). Pulls from Firestore, calls hibernate on idle
 * agents, logs every decision.
 *
 * Run with:
 *   npx tsx app/worker/curator.ts
 *
 * Env (in addition to the Firebase + AWS creds the miniapp container
 * already needs):
 *   PERKOS_CURATOR_ENABLED          true|false  (default true; set
 *                                                "false" to keep the
 *                                                process alive but
 *                                                skip every tick)
 *   PERKOS_CURATOR_INTERVAL_MIN     minutes between ticks (default 15)
 *   PERKOS_CURATOR_IDLE_MINUTES     idle threshold (default 60)
 *   PERKOS_CURATOR_DRY_RUN          true|false (default true — flip
 *                                                to "false" ONLY after
 *                                                a few dry-run days
 *                                                confirm the signal)
 *   PERKOS_CURATOR_MAX_PER_TICK     hard cap on hibernations per tick
 *                                    (default 10 — safety against a
 *                                    config mistake auto-killing the
 *                                    fleet)
 *   PERKOS_CURATOR_SKIP_NAMES       comma-separated names that the
 *                                    curator must never hibernate
 *                                    (default "perkos-assistant")
 *   PERKOS_CURATOR_MIN_AGE_MINUTES  floor on agent age (default 15)
 *   WORKER_INSTANCE_ID              optional, defaults to hostname
 */
import "server-only";

import { hostname } from "node:os";
import { randomBytes } from "node:crypto";

import { loadConfigFromEnv, runCuratorTick } from "../lib/curator";

const WORKER_ID =
  process.env.WORKER_INSTANCE_ID ??
  `curator-${hostname()}-${randomBytes(4).toString("hex")}`;

const INTERVAL_MS = Math.max(
  1,
  Number(process.env.PERKOS_CURATOR_INTERVAL_MIN ?? "15"),
) * 60_000;

const ENABLED = (process.env.PERKOS_CURATOR_ENABLED ?? "true")
  .toLowerCase()
  .trim() !== "false";

let stopping = false;

function log(level: "info" | "warn" | "error", message: string, fields?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const extras = fields ? " " + JSON.stringify(fields) : "";
  console.log(`[${ts}] [${level}] [curator=${WORKER_ID}]${extras} ${message}`);
}

async function tick() {
  if (!ENABLED) {
    log("info", "curator disabled (PERKOS_CURATOR_ENABLED=false), skipping tick");
    return;
  }
  const config = loadConfigFromEnv();
  log("info", "tick start", {
    dryRun: config.dryRun,
    idleMinutes: config.idleMinutes,
    maxPerTick: config.maxHibernationsPerTick,
    skipNames: Array.from(config.skipNames),
  });

  let result;
  try {
    result = await runCuratorTick({ config });
  } catch (err) {
    log(
      "error",
      `tick threw: ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }

  // Summary metrics so we can grep + alert on volume.
  const byReason: Record<string, number> = {};
  for (const d of result.decisions) {
    byReason[d.reason] = (byReason[d.reason] ?? 0) + 1;
  }
  log("info", "tick decisions", { byReason, totalCandidates: result.decisions.length });

  // Per-action log lines so we have a paper trail of every hibernation
  // (or refusal) tied to a wallet + agent + idle minutes.
  for (const d of result.decisions) {
    if (d.reason === "idle") {
      log(
        "info",
        result.dryRun
          ? `[dry-run] would hibernate ${d.name} (idle ${d.idleMinutes}m)`
          : `hibernating ${d.name} (idle ${d.idleMinutes}m)`,
        { wallet: d.walletAddress, idleMinutes: d.idleMinutes },
      );
    } else if (d.reason === "skipped-cap-reached") {
      log("warn", `cap reached, ${d.name} deferred to next tick`, {
        wallet: d.walletAddress,
      });
    }
    // Other reasons are too noisy at info — only aggregated counts above.
  }

  // Hibernation outcomes (only present when dryRun=false).
  for (const h of result.hibernated) {
    if (h.error) {
      log("error", `hibernate ${h.name} failed: ${h.error}`, { wallet: h.walletAddress });
    } else {
      log(
        "info",
        `hibernated ${h.name} ok (prev=${h.result?.previousDesiredCount}, new=${h.result?.newDesiredCount})`,
        { wallet: h.walletAddress },
      );
    }
  }
}

async function loop() {
  log(
    "info",
    `curator worker started (interval=${INTERVAL_MS / 60_000}m, enabled=${ENABLED})`,
  );

  // Run one tick on boot so operators see a signal immediately rather
  // than waiting `interval` minutes for the first one.
  await tick();

  while (!stopping) {
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
    if (stopping) break;
    await tick();
  }
  log("info", "curator worker stopped");
}

function gracefulShutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log("info", `received ${signal}, shutting down`);
  // No in-flight work to wait for — the tick is fully synchronous from
  // our perspective. Exit immediately so docker doesn't have to kill us.
  process.exit(0);
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

void loop().catch((err) => {
  log(
    "error",
    `fatal loop error: ${err instanceof Error ? err.stack ?? err.message : String(err)}`,
  );
  process.exit(1);
});
