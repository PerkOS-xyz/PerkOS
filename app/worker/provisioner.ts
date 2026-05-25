/**
 * PerkOS provisioning worker.
 *
 * Runs as a separate process (separate Docker container, same image
 * as the miniapp). Polls Firestore for pending /provision_jobs,
 * atomically claims one with a lease, processes it, and updates the
 * job status + log. Heartbeats the lease while working so other
 * workers don't preempt a long-running ECS provision.
 *
 * Run with:
 *   npx tsx app/worker/provisioner.ts
 *
 * Env required (same as the miniapp container):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 *   AWS_REGION (or AWS_DEFAULT_REGION)
 *   AWS_ACCESS_KEY (or AWS_ACCESS_KEY_ID)
 *   AWS_SECRET (or AWS_SECRET_ACCESS_KEY)
 *   PERKOS_LLM_ADMIN_TOKEN
 *
 * Optional:
 *   WORKER_INSTANCE_ID — overrides the default hostname-based id
 */

import "server-only";

import { hostname } from "node:os";
import { randomBytes } from "node:crypto";

import {
  HEARTBEAT_MS,
  POLL_INTERVAL_MS,
  claimNextPendingJob,
  heartbeat,
  releaseLease,
  type ProvisionJob,
} from "../lib/provisionJobs";
import { processJob } from "./processJob";

const WORKER_ID =
  process.env.WORKER_INSTANCE_ID ??
  `${hostname()}-${randomBytes(4).toString("hex")}`;

let stopping = false;
let currentJob: ProvisionJob | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

function log(level: "info" | "warn" | "error", message: string) {
  // Plain stdout — docker compose logs picks it up.
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level}] [worker=${WORKER_ID}] ${message}`);
}

function startHeartbeat(job: ProvisionJob) {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(async () => {
    try {
      await heartbeat(job.jobId, WORKER_ID);
    } catch (err) {
      log(
        "warn",
        `heartbeat failed for job ${job.jobId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

async function tick() {
  if (stopping) return;
  let job: ProvisionJob | null = null;
  try {
    job = await claimNextPendingJob(WORKER_ID);
  } catch (err) {
    log(
      "warn",
      `claim error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }
  if (!job) return;

  currentJob = job;
  log(
    "info",
    `claimed job ${job.jobId} (agent=${job.agentName}, runtime=${job.input.runtime}, attempt=${job.attempts})`,
  );
  startHeartbeat(job);
  try {
    await processJob(job);
    log("info", `job ${job.jobId} completed`);
  } catch (err) {
    // processJob handles its own failJob() call. If it threw out
    // here, something went wrong above that level — log and let
    // the lease expire so it can be retried.
    log(
      "error",
      `job ${job.jobId} threw past processJob: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    stopHeartbeat();
    currentJob = null;
  }
}

async function loop() {
  log("info", `worker started (poll every ${POLL_INTERVAL_MS}ms)`);
  while (!stopping) {
    await tick();
    if (stopping) break;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  log("info", `worker stopped`);
}

async function gracefulShutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log("info", `received ${signal}, shutting down`);
  stopHeartbeat();
  if (currentJob) {
    // Release the lease so another worker can pick it up immediately.
    // Don't bother retrying if it fails — the lease will expire in 5 min.
    try {
      await releaseLease(currentJob.jobId);
      log(
        "info",
        `released lease on job ${currentJob.jobId} for re-claim`,
      );
    } catch (err) {
      log(
        "warn",
        `failed to release lease on ${currentJob.jobId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  process.exit(0);
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

void loop().catch((err) => {
  log(
    "error",
    `fatal loop error: ${err instanceof Error ? err.stack ?? err.message : String(err)}`,
  );
  process.exit(1);
});
