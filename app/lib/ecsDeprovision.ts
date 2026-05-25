/**
 * AWS ECS Fargate deprovisioner — counterpart to ecsProvision.ts.
 *
 * Called from DELETE /api/agents/[agentId] to tear down everything that
 * provisionEcsAgent put up: the ECS service, the Secrets Manager secrets,
 * and (best-effort) the latest task definition revision. Idempotent —
 * missing resources are not an error so a half-provisioned agent can
 * still be cleaned up.
 *
 * What we do NOT touch:
 *   - Older task definition revisions (cheap; let them age out)
 *   - CloudWatch log groups (kept for postmortems; aged by retention policy)
 *   - The cluster, VPC, IAM roles — shared infra, owned by ecsProvision.ts
 *     constants
 *
 * Secrets are deleted with `forceDeleteWithoutRecovery: true` because for
 * a wallet-initiated delete there is no undo path; the agent is gone.
 */

import "server-only";

import {
  ECSClient,
  UpdateServiceCommand,
  DeleteServiceCommand,
  DescribeServicesCommand,
} from "@aws-sdk/client-ecs";
import {
  SecretsManagerClient,
  DeleteSecretCommand,
} from "@aws-sdk/client-secrets-manager";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const CLUSTER = "perkos-agents";

const credentials = {
  accessKeyId:
    process.env.AWS_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY ?? "",
  secretAccessKey:
    process.env.AWS_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET ?? "",
};

let cachedEcs: ECSClient | null = null;
let cachedSm: SecretsManagerClient | null = null;
function ecs(): ECSClient {
  if (!cachedEcs) cachedEcs = new ECSClient({ region: REGION, credentials });
  return cachedEcs;
}
function sm(): SecretsManagerClient {
  if (!cachedSm)
    cachedSm = new SecretsManagerClient({ region: REGION, credentials });
  return cachedSm;
}

// Mirrors the format in ecsProvision.ts. Kept in sync by convention; if
// the provisioner ever changes its naming the deprovisioner must too.
function serviceNameFor(walletAddress: string, agentName: string): string {
  return `agent-${walletAddress.toLowerCase().slice(2, 10)}-${agentName.toLowerCase()}`;
}
function secretNameFor(
  walletAddress: string,
  agentName: string,
  kind: "llm-key" | "perkos-llm-key",
): string {
  return `perkos-agents/${walletAddress.toLowerCase()}/${agentName.toLowerCase()}/${kind}`;
}

export type DeprovisionInput = {
  walletAddress: string;
  agentName: string;
};

export type DeprovisionResult = {
  serviceDeleted: boolean;
  secretsDeleted: ("llm-key" | "perkos-llm-key")[];
  warnings: string[];
};

/**
 * Tear down ECS + Secrets resources for a single agent. Safe to call on
 * an agent that never had ECS provisioning (e.g. VPS or Local deploy
 * mode) — returns `serviceDeleted: false, secretsDeleted: []`.
 */
export async function deprovisionEcsAgent(
  input: DeprovisionInput,
): Promise<DeprovisionResult> {
  const serviceName = serviceNameFor(input.walletAddress, input.agentName);
  const warnings: string[] = [];
  let serviceDeleted = false;
  const secretsDeleted: ("llm-key" | "perkos-llm-key")[] = [];

  // 1. ECS service: scale to 0 then force-delete. DeleteService with
  //    force=true kills running tasks; UpdateService=0 first is a polite
  //    SIGTERM that lets in-flight messages flush, ~10s typical.
  try {
    const existing = await ecs().send(
      new DescribeServicesCommand({
        cluster: CLUSTER,
        services: [serviceName],
      }),
    );
    const found = existing.services?.find(
      (s) => s.serviceName === serviceName && s.status === "ACTIVE",
    );

    if (found) {
      try {
        await ecs().send(
          new UpdateServiceCommand({
            cluster: CLUSTER,
            service: serviceName,
            desiredCount: 0,
          }),
        );
      } catch (err) {
        // Scaling down is best-effort; force-delete below still works.
        warnings.push(
          `UpdateService(desiredCount=0) failed: ${(err as Error).message}`,
        );
      }

      await ecs().send(
        new DeleteServiceCommand({
          cluster: CLUSTER,
          service: serviceName,
          force: true,
        }),
      );
      serviceDeleted = true;
    }
  } catch (err) {
    const code = (err as { name?: string }).name;
    if (code !== "ServiceNotFoundException" && code !== "ClusterNotFoundException") {
      throw err;
    }
    // Service or cluster didn't exist — fine, nothing to delete.
  }

  // 2. Secrets — delete both kinds (provisioner may have created either or both).
  for (const kind of ["llm-key", "perkos-llm-key"] as const) {
    const name = secretNameFor(input.walletAddress, input.agentName, kind);
    try {
      await sm().send(
        new DeleteSecretCommand({
          SecretId: name,
          ForceDeleteWithoutRecovery: true,
        }),
      );
      secretsDeleted.push(kind);
    } catch (err) {
      const code = (err as { name?: string }).name;
      if (code === "ResourceNotFoundException") continue;
      warnings.push(
        `DeleteSecret(${kind}) failed: ${(err as Error).message}`,
      );
    }
  }

  return { serviceDeleted, secretsDeleted, warnings };
}
