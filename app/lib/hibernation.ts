/**
 * Hibernation lib — scale-to-zero + scale-back-up for agent ECS services.
 *
 * Why hibernate at all?
 *   A 0.5 vCPU / 1 GB Fargate task costs ~$18/mo when running 24/7. An
 *   idle agent racks up the bill while doing nothing. Hibernation drops
 *   that to the cost of an S3 snapshot (~$0.02/mo for the typical
 *   Hermes data dir at <1 MB).
 *
 * Design:
 *   - `hibernate()` calls `UpdateServiceCommand({ desiredCount: 0 })`.
 *     ECS sends SIGTERM to the running task; the runtime container has
 *     a shutdown hook (PerkOS-Containers) that tars $HERMES_HOME and
 *     uploads to s3://perkos-agent-snapshots-${env}/<wallet>/<name>/
 *     before it exits. We don't block the API on the upload — the
 *     hibernation Firestore doc records "pending" → "hibernated" via a
 *     completion ping from the container (route in a follow-up PR).
 *
 *   - `wake()` calls `UpdateServiceCommand({ desiredCount: 1 })`. The
 *     container's entrypoint detects a stashed snapshot and restores
 *     before Hermes starts. The API marks state "waking" until the
 *     restore-complete ping flips it to "active".
 *
 *   - We never `DeleteService` here. Hibernation preserves the service
 *     + task definition so wake is just a desiredCount bump. Delete is
 *     a separate intent handled by `ecsDeprovision.ts`.
 *
 * Tenant isolation:
 *   - The wallet/agent pair is derived from the caller's Firebase uid
 *     in the API route, not from request bodies. This module trusts
 *     its inputs (callers must already have validated ownership).
 *   - The S3 key prefix is wallet-scoped — `prefix(wallet, name)`.
 *     The IAM policy attached to the task role allows R/W on the whole
 *     bucket; per-wallet isolation is enforced at the application
 *     layer, not at the IAM layer. The bash bootstrap script's policy
 *     comment explains this trade-off.
 */
import "server-only";

import {
  ECSClient,
  DescribeServicesCommand,
  UpdateServiceCommand,
} from "@aws-sdk/client-ecs";
import type { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "./firebaseAdmin";
import { getMetrics } from "./metrics";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const ACCOUNT = "089332276762";
const CLUSTER = "perkos-agents";
const ENV = process.env.PERKOS_ENV ?? "dev";

export const SNAPSHOT_BUCKET = `perkos-agent-snapshots-${ENV}`;
export const SNAPSHOT_KMS_ARN = `arn:aws:kms:${REGION}:${ACCOUNT}:alias/perkos-agent-snapshots-${ENV}`;

let cached: ECSClient | null = null;
function ecs(): ECSClient {
  if (cached) return cached;
  cached = new ECSClient({
    region: REGION,
    credentials: {
      accessKeyId:
        process.env.AWS_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY ?? "",
      secretAccessKey:
        process.env.AWS_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET ?? "",
    },
  });
  return cached;
}

/**
 * ECS service name convention — kept in lockstep with ecsProvision.ts.
 * If that file's naming ever changes, both must move together.
 */
export function serviceNameFor(walletAddress: string, agentName: string): string {
  return `agent-${walletAddress.toLowerCase().slice(2, 10)}-${agentName.toLowerCase()}`;
}

/**
 * S3 key prefix for an agent's snapshots. The trailing slash is part of
 * the convention — keys live UNDER this prefix as `state.tar.gz` (latest)
 * and `state-<ISO>.tar.gz` (timestamped history).
 */
export function snapshotPrefix(walletAddress: string, agentName: string): string {
  return `${walletAddress.toLowerCase()}/${agentName.toLowerCase()}/`;
}

export type HibernationState =
  /** Service is running normally (desiredCount > 0). */
  | "active"
  /** API call to hibernate accepted; ECS is draining the task. */
  | "hibernating"
  /** Snapshot landed, task is stopped (desiredCount === 0). */
  | "hibernated"
  /** API call to wake accepted; ECS is starting a task. */
  | "waking";

export type HibernationDoc = {
  state: HibernationState;
  snapshotKey?: string;
  snapshotSizeBytes?: number;
  hibernatedAt?: FieldValue | Date | string;
  wakeStartedAt?: FieldValue | Date | string;
  /** Free-form note from the container (snapshot reason, restore status). */
  note?: string;
};

/**
 * Mutates Firestore `/wallets/{wallet}/agents/{agentId}.hibernation` and
 * a mirror in `/agents/{agentName}.hibernation` so downstream listeners
 * (admin views, curator cron) can see state from either path.
 */
async function writeHibernationState(
  walletAddress: string,
  agentId: string,
  agentName: string,
  patch: HibernationDoc,
): Promise<void> {
  const db = adminDb();
  const perWallet = db
    .collection("wallets")
    .doc(walletAddress.toLowerCase())
    .collection("agents")
    .doc(agentId);
  const global = db.collection("agents").doc(agentName);
  await Promise.all([
    perWallet.set({ hibernation: patch, updatedAt: new Date() }, { merge: true }),
    global.set({ hibernation: patch, updatedAt: new Date() }, { merge: true }),
  ]);
}

export type HibernateInput = {
  walletAddress: string;
  agentId: string;
  agentName: string;
};

export type HibernationActionResult = {
  serviceArn: string | null;
  previousDesiredCount: number;
  newDesiredCount: number;
  state: HibernationState;
};

/**
 * Scale the service to 0. Idempotent — if the service is already at 0
 * we still update Firestore to reflect the latest intent and return ok.
 */
export async function hibernateAgent(
  input: HibernateInput,
): Promise<HibernationActionResult> {
  const metrics = getMetrics();
  const service = serviceNameFor(input.walletAddress, input.agentName);

  let described;
  try {
    described = await ecs().send(
      new DescribeServicesCommand({ cluster: CLUSTER, services: [service] }),
    );
  } catch (err) {
    metrics.hibernateTotal.inc({ result: "error" });
    throw err;
  }
  const found = described.services?.find(
    (s) => s.status === "ACTIVE" && s.serviceName === service,
  );
  if (!found) {
    metrics.hibernateTotal.inc({ result: "not-found" });
    throw new HibernationError(
      "SERVICE_NOT_FOUND",
      `ECS service ${service} not found — agent may not be deployed yet.`,
    );
  }

  const previousDesiredCount = found.desiredCount ?? 0;

  // Already hibernated; just record state and return.
  if (previousDesiredCount === 0) {
    await writeHibernationState(input.walletAddress, input.agentId, input.agentName, {
      state: "hibernated",
      note: "noop — desiredCount was already 0",
    });
    metrics.hibernateTotal.inc({ result: "noop" });
    return {
      serviceArn: found.serviceArn ?? null,
      previousDesiredCount,
      newDesiredCount: 0,
      state: "hibernated",
    };
  }

  await writeHibernationState(input.walletAddress, input.agentId, input.agentName, {
    state: "hibernating",
    hibernatedAt: new Date(),
  });

  let updated;
  try {
    updated = await ecs().send(
      new UpdateServiceCommand({
        cluster: CLUSTER,
        service,
        desiredCount: 0,
      }),
    );
  } catch (err) {
    metrics.hibernateTotal.inc({ result: "error" });
    throw err;
  }

  metrics.hibernateTotal.inc({ result: "success" });
  return {
    serviceArn: updated.service?.serviceArn ?? found.serviceArn ?? null,
    previousDesiredCount,
    newDesiredCount: 0,
    state: "hibernating",
  };
}

export type WakeInput = HibernateInput;

/**
 * Scale the service back to 1. Idempotent — if already running we still
 * write state and return ok.
 */
export async function wakeAgent(input: WakeInput): Promise<HibernationActionResult> {
  const metrics = getMetrics();
  const service = serviceNameFor(input.walletAddress, input.agentName);

  let described;
  try {
    described = await ecs().send(
      new DescribeServicesCommand({ cluster: CLUSTER, services: [service] }),
    );
  } catch (err) {
    metrics.wakeTotal.inc({ result: "error" });
    throw err;
  }
  const found = described.services?.find(
    (s) => s.status === "ACTIVE" && s.serviceName === service,
  );
  if (!found) {
    metrics.wakeTotal.inc({ result: "not-found" });
    throw new HibernationError(
      "SERVICE_NOT_FOUND",
      `ECS service ${service} not found — agent may not be deployed yet.`,
    );
  }

  const previousDesiredCount = found.desiredCount ?? 0;

  if (previousDesiredCount >= 1) {
    await writeHibernationState(input.walletAddress, input.agentId, input.agentName, {
      state: "active",
      note: "noop — desiredCount was already >= 1",
    });
    metrics.wakeTotal.inc({ result: "noop" });
    return {
      serviceArn: found.serviceArn ?? null,
      previousDesiredCount,
      newDesiredCount: previousDesiredCount,
      state: "active",
    };
  }

  await writeHibernationState(input.walletAddress, input.agentId, input.agentName, {
    state: "waking",
    wakeStartedAt: new Date(),
  });

  let updated;
  try {
    updated = await ecs().send(
      new UpdateServiceCommand({
        cluster: CLUSTER,
        service,
        desiredCount: 1,
      }),
    );
  } catch (err) {
    metrics.wakeTotal.inc({ result: "error" });
    throw err;
  }

  metrics.wakeTotal.inc({ result: "success" });
  return {
    serviceArn: updated.service?.serviceArn ?? found.serviceArn ?? null,
    previousDesiredCount,
    newDesiredCount: 1,
    state: "waking",
  };
}

export type HibernationStatus = {
  state: HibernationState;
  desiredCount: number;
  runningCount: number;
  pendingCount: number;
  snapshot: {
    bucket: string;
    prefix: string;
    key?: string;
    sizeBytes?: number;
  };
  hibernatedAt?: string;
  wakeStartedAt?: string;
  note?: string;
};

/**
 * Read current hibernation status — merges ECS service state (the truth)
 * with the Firestore doc (intent + snapshot metadata).
 */
export async function getHibernationStatus(input: {
  walletAddress: string;
  agentId: string;
  agentName: string;
}): Promise<HibernationStatus> {
  const service = serviceNameFor(input.walletAddress, input.agentName);
  const described = await ecs().send(
    new DescribeServicesCommand({ cluster: CLUSTER, services: [service] }),
  );
  const found = described.services?.find(
    (s) => s.status === "ACTIVE" && s.serviceName === service,
  );

  const desiredCount = found?.desiredCount ?? 0;
  const runningCount = found?.runningCount ?? 0;
  const pendingCount = found?.pendingCount ?? 0;

  // Read the Firestore doc for snapshot metadata.
  const db = adminDb();
  const docSnap = await db
    .collection("wallets")
    .doc(input.walletAddress.toLowerCase())
    .collection("agents")
    .doc(input.agentId)
    .get();
  const fsHibernation = (docSnap.data()?.hibernation ?? {}) as HibernationDoc;

  // Reconcile state — ECS is the source of truth for "is the task up".
  let state: HibernationState = fsHibernation.state ?? "active";
  if (desiredCount === 0 && runningCount === 0) {
    // Tasks fully stopped. If we marked "hibernating", promote to
    // "hibernated" so the UI reflects reality.
    if (state === "hibernating" || state === "active") state = "hibernated";
  } else if (runningCount >= 1 && state === "waking") {
    state = "active";
  } else if (runningCount >= 1) {
    state = "active";
  }

  return {
    state,
    desiredCount,
    runningCount,
    pendingCount,
    snapshot: {
      bucket: SNAPSHOT_BUCKET,
      prefix: snapshotPrefix(input.walletAddress, input.agentName),
      key: fsHibernation.snapshotKey,
      sizeBytes: fsHibernation.snapshotSizeBytes,
    },
    hibernatedAt: serializeTs(fsHibernation.hibernatedAt),
    wakeStartedAt: serializeTs(fsHibernation.wakeStartedAt),
    note: fsHibernation.note,
  };
}

function serializeTs(v: FieldValue | Date | string | undefined): string | undefined {
  if (!v) return undefined;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  // Firestore Timestamp toDate, if present.
  const maybe = v as { toDate?: () => Date };
  if (typeof maybe.toDate === "function") return maybe.toDate().toISOString();
  return undefined;
}

export type HibernationErrorClass =
  | "SERVICE_NOT_FOUND"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_INPUT";

export class HibernationError extends Error {
  readonly errorClass: HibernationErrorClass;
  constructor(cls: HibernationErrorClass, message: string) {
    super(message);
    this.name = "HibernationError";
    this.errorClass = cls;
  }
}
