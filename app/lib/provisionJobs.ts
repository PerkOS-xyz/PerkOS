/**
 * Provision-job queue helpers.
 *
 * /api/agents/launch writes a job here instead of doing the slow
 * AWS work synchronously. The worker (app/worker/provisioner.ts)
 * picks jobs up, runs them, and writes status + log entries back.
 *
 * Schema:
 *
 *   /provision_jobs/{jobId} {
 *     status:       "pending" | "claimed" | "running" | "ready" | "failed",
 *     walletAddress: string,
 *     agentId:      string,        // /wallets/{addr}/agents/{id}
 *     agentName:    string,
 *     input: {                     // everything the worker needs to run
 *       runtime:    "Hermes" | "OpenClaw",
 *       imageTag:   string,
 *       llmSource:  "perkos" | "byok",
 *       byokApiKey: string | null, // only when llmSource === "byok"
 *     },
 *     claimedBy:    string | null, // worker id holding the lease
 *     claimedAt:    timestamp | null,
 *     leaseUntil:   timestamp | null,
 *     attempts:     number,        // incremented on every claim
 *     result: {                    // populated on "ready"
 *       serviceArn, taskDefinitionArn, imageUri, llmKeyLast4,
 *     } | null,
 *     error:        string | null, // populated on "failed"
 *     createdAt:    timestamp,
 *     updatedAt:    timestamp,
 *   }
 *
 *   /provision_jobs/{jobId}/log/{autoId} {
 *     ts:      timestamp,
 *     level:   "info" | "ok" | "warn" | "error",
 *     message: string,
 *   }
 *
 * Concurrency model: lease-with-heartbeat.
 *   - claimNextPendingJob() runs an atomic transaction that flips
 *     `pending → claimed` and stamps `leaseUntil = now + LEASE_MS`.
 *   - The worker calls heartbeat() every HEARTBEAT_MS to extend.
 *   - If the worker dies, leaseUntil expires and another worker can
 *     re-claim (we also surface "stale-claimed" jobs via the same
 *     query path — see claimNextPendingJob below).
 */

import "server-only";

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb } from "./firebaseAdmin";

export const LEASE_MS = 5 * 60 * 1000; // 5 min — generous for ECS provisioning
export const HEARTBEAT_MS = 30 * 1000;
export const POLL_INTERVAL_MS = 2000;

export type JobStatus =
  | "pending"
  | "claimed"
  | "running"
  | "ready"
  | "failed";

export type ProvisionJobInput = {
  runtime: "Hermes" | "OpenClaw";
  imageTag: string;
  /** Where the runtime's LLM Authorization header comes from.
   *  For "byok", the worker fetches the user's key from
   *  /agent_secrets/{wallet}/agents/{agentId} — never put plaintext
   *  in the job doc. */
  llmSource: "perkos" | "byok";
};

export type ProvisionJob = {
  jobId: string;
  status: JobStatus;
  walletAddress: string;
  agentId: string;
  agentName: string;
  input: ProvisionJobInput;
  claimedBy: string | null;
  attempts: number;
  result: {
    serviceArn?: string;
    taskDefinitionArn?: string;
    imageUri?: string;
    llmKeyLast4?: string;
  } | null;
  error: string | null;
};

export type JobLogLevel = "info" | "ok" | "warn" | "error";

export type CreateJobInput = {
  walletAddress: string;
  agentId: string;
  agentName: string;
  input: ProvisionJobInput;
};

export async function createJob(opts: CreateJobInput): Promise<string> {
  const db = adminDb();
  const ref = db.collection("provision_jobs").doc();
  await ref.set({
    status: "pending" as JobStatus,
    walletAddress: opts.walletAddress,
    agentId: opts.agentId,
    agentName: opts.agentName,
    input: opts.input,
    claimedBy: null,
    claimedAt: null,
    leaseUntil: null,
    attempts: 0,
    result: null,
    error: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/**
 * Atomically claim the next claimable job — either truly pending, or
 * stale-claimed (lease expired so the owning worker is presumed dead).
 *
 * Returns the claimed job, or null if there's nothing to do.
 */
export async function claimNextPendingJob(
  workerId: string,
): Promise<ProvisionJob | null> {
  const db = adminDb();
  const now = Date.now();
  const lookups: FirebaseFirestore.QuerySnapshot[] = await Promise.all([
    db
      .collection("provision_jobs")
      .where("status", "==", "pending")
      .orderBy("createdAt", "asc")
      .limit(5)
      .get(),
    db
      .collection("provision_jobs")
      .where("status", "in", ["claimed", "running"])
      .where("leaseUntil", "<", Timestamp.fromMillis(now))
      .orderBy("leaseUntil", "asc")
      .limit(5)
      .get(),
  ]);

  for (const snap of lookups) {
    for (const doc of snap.docs) {
      try {
        const claimed = await db.runTransaction<ProvisionJob | null>(
          async (tx) => {
            const fresh = await tx.get(doc.ref);
            if (!fresh.exists) return null;
            const data = fresh.data() as Record<string, unknown>;
            const status = data.status as JobStatus;
            const leaseUntil = data.leaseUntil as Timestamp | null;

            // Re-check the conditions inside the transaction — another
            // worker may have grabbed it between the query and here.
            const claimable =
              status === "pending" ||
              ((status === "claimed" || status === "running") &&
                leaseUntil !== null &&
                leaseUntil.toMillis() < now);
            if (!claimable) return null;

            const attempts = ((data.attempts as number) ?? 0) + 1;
            tx.update(doc.ref, {
              status: "claimed" as JobStatus,
              claimedBy: workerId,
              claimedAt: FieldValue.serverTimestamp(),
              leaseUntil: Timestamp.fromMillis(Date.now() + LEASE_MS),
              attempts,
              updatedAt: FieldValue.serverTimestamp(),
            });

            return {
              jobId: doc.id,
              status: "claimed",
              walletAddress: String(data.walletAddress),
              agentId: String(data.agentId),
              agentName: String(data.agentName),
              input: data.input as ProvisionJobInput,
              claimedBy: workerId,
              attempts,
              result: null,
              error: null,
            };
          },
        );
        if (claimed) return claimed;
      } catch (err) {
        // Another worker beat us inside the transaction — move on.
        console.warn(
          `[provisionJobs] claim race on ${doc.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
  return null;
}

export async function heartbeat(
  jobId: string,
  workerId: string,
): Promise<void> {
  const db = adminDb();
  await db.collection("provision_jobs").doc(jobId).update({
    leaseUntil: Timestamp.fromMillis(Date.now() + LEASE_MS),
    updatedAt: FieldValue.serverTimestamp(),
    // Defensive: keep the worker id in case something stomps it.
    claimedBy: workerId,
  });
}

export async function markRunning(jobId: string): Promise<void> {
  const db = adminDb();
  await db.collection("provision_jobs").doc(jobId).update({
    status: "running" as JobStatus,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function appendLog(
  jobId: string,
  level: JobLogLevel,
  message: string,
): Promise<void> {
  const db = adminDb();
  await db.collection("provision_jobs").doc(jobId).collection("log").add({
    ts: FieldValue.serverTimestamp(),
    level,
    message: message.slice(0, 1000),
  });
}

export async function completeJob(
  jobId: string,
  result: NonNullable<ProvisionJob["result"]>,
): Promise<void> {
  const db = adminDb();
  await db.collection("provision_jobs").doc(jobId).update({
    status: "ready" as JobStatus,
    result,
    error: null,
    leaseUntil: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function failJob(jobId: string, error: string): Promise<void> {
  const db = adminDb();
  await db.collection("provision_jobs").doc(jobId).update({
    status: "failed" as JobStatus,
    error: error.slice(0, 1000),
    leaseUntil: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Release a lease without changing status (used on graceful shutdown
 * so another worker can pick the job up immediately).
 */
export async function releaseLease(jobId: string): Promise<void> {
  const db = adminDb();
  await db.collection("provision_jobs").doc(jobId).update({
    status: "pending" as JobStatus,
    claimedBy: null,
    leaseUntil: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
