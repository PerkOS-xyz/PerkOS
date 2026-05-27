/**
 * Agent runtime upgrade orchestrator.
 *
 * Upgrading an agent's container image without losing state is just
 * three operations the platform already has — composed in a single
 * intent the user can press one button for:
 *
 *   1. hibernate (scale to 0)
 *        → container traps SIGTERM, drains Hermes, tars HERMES_HOME,
 *          uploads to s3://perkos-agent-snapshots-${env}/<wallet>/<name>/
 *   2. wait for ECS runningCount to hit 0
 *        → tells us the snapshot upload completed (the entrypoint
 *          calls snapshot.sh BEFORE exiting). Bounded by a timeout so
 *          a stuck container can't hang the API forever.
 *   3. re-provision with the new imageTag
 *        → RegisterTaskDefinition (new revision pinned to new image)
 *          + UpdateService(desiredCount=1, forceNewDeployment=true).
 *          New task starts, entrypoint restores from the same S3
 *          prefix, Hermes wakes with full state.
 *
 * Validation:
 *   - The new imageTag must be `active === true` in /runtime_images
 *     for the agent's runtime, same gate provisionEcsAgent enforces.
 *   - The new tag must be different from the current one (we look at
 *     the saved ecs.imageUri suffix to decide).
 *
 * Failure modes:
 *   - hibernate raises → return early (state unchanged)
 *   - drain timeout    → return error; agent stays at desiredCount=0
 *     so the user can wake it manually with the existing endpoint.
 *   - re-provision raises → state unchanged at desiredCount=0; user
 *     can retry or wake on the old task def.
 *
 * Wallet/agent ownership is validated by the calling route, not here.
 */
import "server-only";

import {
  ECSClient,
  DescribeServicesCommand,
} from "@aws-sdk/client-ecs";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "./firebaseAdmin";
import { hibernateAgent, serviceNameFor } from "./hibernation";
import {
  provisionEcsAgent,
  type ProvisionResult,
} from "./ecsProvision";
import { getMetrics } from "./metrics";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const CLUSTER = "perkos-agents";

let cachedEcs: ECSClient | null = null;
function ecs(): ECSClient {
  if (cachedEcs) return cachedEcs;
  cachedEcs = new ECSClient({
    region: REGION,
    credentials: {
      accessKeyId:
        process.env.AWS_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY ?? "",
      secretAccessKey:
        process.env.AWS_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET ?? "",
    },
  });
  return cachedEcs;
}

/**
 * Pull `:<tag>` off the saved imageUri so the UI can show what's
 * currently deployed and the API can reject upgrade-to-self. Returns
 * undefined if the uri doesn't match the expected ECR shape.
 */
export function imageTagFromUri(imageUri: string | undefined): string | undefined {
  if (!imageUri || typeof imageUri !== "string") return undefined;
  const lastColon = imageUri.lastIndexOf(":");
  if (lastColon === -1) return undefined;
  const tag = imageUri.slice(lastColon + 1);
  return tag.length > 0 ? tag : undefined;
}

export type UpgradeErrorClass =
  | "BAD_INPUT"
  | "SAME_VERSION"
  | "TAG_INACTIVE"
  | "TAG_NOT_FOUND"
  | "DRAIN_TIMEOUT"
  | "SERVICE_NOT_FOUND";

export class UpgradeError extends Error {
  readonly errorClass: UpgradeErrorClass;
  constructor(cls: UpgradeErrorClass, message: string) {
    super(message);
    this.name = "UpgradeError";
    this.errorClass = cls;
  }
}

export type UpgradeInput = {
  walletAddress: string;
  agentId: string;
  agentName: string;
  runtime: "OpenClaw" | "Hermes";
  targetImageTag: string;
  /**
   * BYOK + perkos modes need to know how the agent was originally
   * provisioned — the caller resolves this from Firestore (agent doc +
   * agent_secrets) and passes it through. Same shape provisionEcsAgent
   * already uses on launch.
   */
  llmSource: "perkos" | "byok" | "skip";
  byokApiKey?: string;
  perkosLlmApiKey?: string;
  /** Saved on the agent doc — needed to detect upgrade-to-self. */
  currentImageUri?: string;
  /**
   * Cap on how long we wait for ECS to fully drain the running task
   * after hibernate. The entrypoint snapshots inside its SIGTERM
   * handler, so we MUST wait for drain — starting the new task while
   * the old one is still uploading would race the snapshot.
   */
  drainTimeoutMs?: number;
  /** Poll interval while waiting for drain. */
  drainPollIntervalMs?: number;
};

export type UpgradeResult = {
  from: string | null;
  to: string;
  hibernated: boolean;
  drainedAfterMs: number;
  provision: ProvisionResult;
};

/**
 * Returns when the service's runningCount === 0, or throws
 * DRAIN_TIMEOUT after timeoutMs. Used between hibernate and
 * re-provision so we don't start a new task while the snapshot is
 * still uploading.
 */
async function waitForDrain(opts: {
  serviceName: string;
  timeoutMs: number;
  pollIntervalMs: number;
}): Promise<number> {
  const start = Date.now();
  let attempts = 0;
  while (Date.now() - start < opts.timeoutMs) {
    attempts++;
    const described = await ecs().send(
      new DescribeServicesCommand({
        cluster: CLUSTER,
        services: [opts.serviceName],
      }),
    );
    const svc = described.services?.find(
      (s) => s.status === "ACTIVE" && s.serviceName === opts.serviceName,
    );
    if (!svc) {
      throw new UpgradeError(
        "SERVICE_NOT_FOUND",
        `ECS service ${opts.serviceName} disappeared during drain.`,
      );
    }
    if ((svc.runningCount ?? 0) === 0 && (svc.pendingCount ?? 0) === 0) {
      return Date.now() - start;
    }
    await new Promise((r) => setTimeout(r, opts.pollIntervalMs));
  }
  throw new UpgradeError(
    "DRAIN_TIMEOUT",
    `Service ${opts.serviceName} did not drain within ${opts.timeoutMs}ms (${attempts} polls).`,
  );
}

/**
 * Confirms the requested tag is in /runtime_images with active=true
 * for the agent's runtime. Mirrors the gate inside provisionEcsAgent
 * so the API can refuse early with a clean error class instead of
 * letting the worker discover the same problem later.
 */
async function assertTagIsActive(
  runtime: "OpenClaw" | "Hermes",
  imageTag: string,
): Promise<void> {
  const kind = runtime.toLowerCase();
  const key = `${kind}:${imageTag}`;
  const snap = await adminDb().collection("runtime_images").doc(key).get();
  if (!snap.exists) {
    throw new UpgradeError(
      "TAG_NOT_FOUND",
      `Image tag ${imageTag} not found for ${runtime}.`,
    );
  }
  if (snap.data()?.active !== true) {
    throw new UpgradeError(
      "TAG_INACTIVE",
      `Image tag ${imageTag} is not active for provisioning.`,
    );
  }
}

export async function upgradeAgent(
  input: UpgradeInput,
): Promise<UpgradeResult> {
  const metrics = getMetrics();
  if (!input.targetImageTag || typeof input.targetImageTag !== "string") {
    metrics.upgradeTotal.inc({ result: "bad-input" });
    throw new UpgradeError("BAD_INPUT", "targetImageTag is required.");
  }

  const currentTag = imageTagFromUri(input.currentImageUri) ?? null;
  if (currentTag && currentTag === input.targetImageTag) {
    metrics.upgradeTotal.inc({ result: "same-version" });
    throw new UpgradeError(
      "SAME_VERSION",
      `Agent is already on image tag ${input.targetImageTag}.`,
    );
  }

  try {
    await assertTagIsActive(input.runtime, input.targetImageTag);
  } catch (err) {
    metrics.upgradeTotal.inc({
      result: err instanceof UpgradeError ? err.errorClass.toLowerCase().replace("_", "-") : "error",
    });
    throw err;
  }

  const serviceName = serviceNameFor(input.walletAddress, input.agentName);
  const drainTimeoutMs = input.drainTimeoutMs ?? 5 * 60 * 1000;
  const drainPollIntervalMs = input.drainPollIntervalMs ?? 5_000;

  // From here on, anything that throws counts as an upgrade failure
  // labelled by errorClass so the dashboard can split drain timeouts
  // from generic ECS errors. Wrap the rest of the body in try/catch so
  // a single counter increment covers every downstream failure mode.
  try {
  // 1. Hibernate.
  let hibernated = false;
  const hibernateResult = await hibernateAgent({
    walletAddress: input.walletAddress,
    agentId: input.agentId,
    agentName: input.agentName,
  });
  hibernated = hibernateResult.previousDesiredCount > 0;

  // 2. Wait for drain — only matters if we actually had a task running.
  //    If desiredCount was already 0, there's nothing to wait for.
  const drainedAfterMs = hibernated
    ? await waitForDrain({
        serviceName,
        timeoutMs: drainTimeoutMs,
        pollIntervalMs: drainPollIntervalMs,
      })
    : 0;

  // 3. Re-provision with the new tag. This re-registers the task
  //    definition (a new revision pinned to the new image) and
  //    UpdateService(desiredCount=1, forceNewDeployment=true). The new
  //    task's entrypoint downloads the snapshot we just took and
  //    restores it before Hermes starts.
  //
  //    Re-fetch the relayApiKey from /agents/{name} so the bridge
  //    sidecar (added in ecsProvision when PERKOS_A2A_BRIDGE_ENABLED
  //    is on) survives the upgrade. Without this, an upgrade would
  //    drop the sidecar from the task def and the agent would lose
  //    chat reachability on the new image.
  let relayApiKey: string | undefined;
  try {
    const snap = await adminDb()
      .collection("agents")
      .doc(input.agentName)
      .get();
    const data = snap.data() as { relayApiKey?: string } | undefined;
    relayApiKey = data?.relayApiKey;
  } catch {
    /* swallow — upgrade proceeds without bridge if lookup fails */
  }

  const provision = await provisionEcsAgent({
    walletAddress: input.walletAddress,
    agentName: input.agentName,
    runtime: input.runtime,
    imageTag: input.targetImageTag,
    llmSource: input.llmSource,
    byokApiKey: input.byokApiKey,
    perkosLlmApiKey: input.perkosLlmApiKey,
    agentId: input.agentId,
    relayApiKey,
  });

  // Record the upgrade in Firestore so the UI can show "Last upgraded".
  const upgradeMeta = {
    from: currentTag,
    to: input.targetImageTag,
    at: FieldValue.serverTimestamp(),
    drainedAfterMs,
  };
  const db = adminDb();
  await Promise.all([
    db
      .collection("wallets")
      .doc(input.walletAddress.toLowerCase())
      .collection("agents")
      .doc(input.agentId)
      .set(
        {
          ecs: {
            imageUri: provision.imageUri,
            taskDefinitionArn: provision.taskDefinitionArn,
            serviceArn: provision.serviceArn,
            lastUpgradeAt: FieldValue.serverTimestamp(),
          },
          lastUpgrade: upgradeMeta,
          updatedAt: new Date(),
        },
        { merge: true },
      ),
    db
      .collection("agents")
      .doc(input.agentName)
      .set(
        { lastUpgrade: upgradeMeta, updatedAt: new Date() },
        { merge: true },
      ),
  ]);

  metrics.upgradeTotal.inc({ result: "success" });
  return {
    from: currentTag,
    to: input.targetImageTag,
    hibernated,
    drainedAfterMs,
    provision,
  };
  } catch (err) {
    metrics.upgradeTotal.inc({
      result:
        err instanceof UpgradeError
          ? err.errorClass.toLowerCase().replace(/_/g, "-")
          : "error",
    });
    throw err;
  }
}

export type AvailableUpgrade = {
  imageTag: string;
  /** ISO timestamp when this image was published to the registry. */
  publishedAt?: string;
  /** Optional human-readable note from the admin who promoted it. */
  notes?: string;
};

export type UpgradeOptions = {
  currentImageTag: string | null;
  currentImageUri: string | null;
  available: AvailableUpgrade[];
};

/**
 * Read /runtime_images for the agent's runtime, filter to active tags
 * NEWER than the current one (sorted by publishedAt desc). Used by the
 * GET endpoint that powers the "available upgrades" dropdown.
 */
export async function listAvailableUpgrades(opts: {
  runtime: "OpenClaw" | "Hermes";
  currentImageUri: string | null;
}): Promise<UpgradeOptions> {
  const kind = opts.runtime.toLowerCase();
  const snap = await adminDb()
    .collection("runtime_images")
    .where("runtime", "==", kind)
    .where("active", "==", true)
    .get();

  const currentImageTag = imageTagFromUri(opts.currentImageUri ?? undefined) ?? null;
  const out: AvailableUpgrade[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as {
      tag?: string;
      publishedAt?: { toDate?: () => Date } | string;
      notes?: string;
    };
    if (!data.tag || data.tag === currentImageTag) continue;
    let publishedAt: string | undefined;
    if (data.publishedAt) {
      if (typeof data.publishedAt === "string") publishedAt = data.publishedAt;
      else if (typeof data.publishedAt.toDate === "function") {
        publishedAt = data.publishedAt.toDate().toISOString();
      }
    }
    out.push({
      imageTag: data.tag,
      publishedAt,
      notes: typeof data.notes === "string" ? data.notes : undefined,
    });
  }

  // Newest first; undefined publishedAt sinks to the bottom.
  out.sort((a, b) => {
    if (a.publishedAt && b.publishedAt) {
      return b.publishedAt.localeCompare(a.publishedAt);
    }
    if (a.publishedAt) return -1;
    if (b.publishedAt) return 1;
    return a.imageTag.localeCompare(b.imageTag);
  });

  return {
    currentImageTag,
    currentImageUri: opts.currentImageUri,
    available: out,
  };
}
