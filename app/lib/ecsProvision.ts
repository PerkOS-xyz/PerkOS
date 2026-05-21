/**
 * AWS ECS Fargate provisioner — one agent task per user, in cluster
 * `perkos-agents` (us-east-1). Called from /api/agents/launch when the
 * wizard's deployMode is "perkos-ecs".
 *
 * Design choices:
 *
 *   - No public ingress. The agent only talks OUT to transport.perkos.xyz
 *     + the LLM gateway. All inbound work arrives via the perkos-a2a
 *     sidecar's WS connection back to Transport. This keeps the security
 *     surface tiny (egress-only security group, no ALB, no public IP per
 *     task) and lets us scale to many agents without per-agent DNS.
 *
 *   - One ECS Service per agent (not per-user, not shared). The service
 *     name is `agent-<wallet>-<agentName>` so the same wallet provisioning
 *     the same agent twice is idempotent — UpdateService rolls forward.
 *
 *   - BYOK keys live in Secrets Manager at `perkos-agents/<wallet>/<agentName>/llm-key`.
 *     The task definition references the secret by ARN; the execution
 *     role has `secretsmanager:GetSecretValue` scoped to `perkos-agents/*`.
 *
 *   - The runtime image tag is verified server-side against
 *     `runtime_images where active = true` before any AWS call — this
 *     stops a malicious or stale client from pinning an unapproved image.
 *
 * Reused account-level resources (already exist):
 *   - VPC vpc-0198183965fff4a31 (default)
 *   - Subnets: 5 default subnets across us-east-1a-f
 *   - Execution role: perkos-spark-ecs-execution (has
 *     AmazonECSTaskExecutionRolePolicy + new inline perkos-agents-secrets-read)
 *   - Task role: perkos-spark-ecs-task (no permissions; the agent only
 *     calls HTTPS, never AWS APIs)
 *   - Security group: sg-0c136d6aaa847cbd2 (perkos-agents-sg, egress only)
 *   - Log group: /ecs/perkos-agents (14d retention)
 */

import "server-only";

import {
  ECSClient,
  CreateServiceCommand,
  UpdateServiceCommand,
  DescribeServicesCommand,
  RegisterTaskDefinitionCommand,
  LogDriver,
} from "@aws-sdk/client-ecs";
import {
  SecretsManagerClient,
  CreateSecretCommand,
  PutSecretValueCommand,
  DescribeSecretCommand,
} from "@aws-sdk/client-secrets-manager";

import { adminDb } from "./firebaseAdmin";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const ACCOUNT = "089332276762";

// Pre-provisioned account resources. Hard-coded by design — these are
// infra constants, not per-tenant config.
const CLUSTER = "perkos-agents";
const VPC_SUBNETS = [
  "subnet-07a73c0f81f735de2",
  "subnet-08c8339ff1ef02c16",
  "subnet-0c6a63a891104eab6",
  "subnet-0a30b1cda2efd71d7",
  "subnet-0ff9db2e786d56b16",
];
const SECURITY_GROUP = "sg-0c136d6aaa847cbd2";
const EXECUTION_ROLE_ARN = `arn:aws:iam::${ACCOUNT}:role/perkos-spark-ecs-execution`;
const TASK_ROLE_ARN = `arn:aws:iam::${ACCOUNT}:role/perkos-spark-ecs-task`;
const LOG_GROUP = "/ecs/perkos-agents";
const ECR_REGISTRY = `${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com`;
const PERKOS_LLM_BASE_URL = "https://api.llm.perkos.xyz";

// Fargate has fixed cpu/memory pairs. 512/1024 = 0.5 vCPU, 1 GB — fits the
// agent + perkos-a2a sidecar comfortably for alpha.
const TASK_CPU = "512";
const TASK_MEMORY = "1024";

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

export type ProvisionInput = {
  walletAddress: string;
  agentName: string;
  runtime: "OpenClaw" | "Hermes";
  /** ECR image tag, e.g. `latest-perkos.2026.05.21.ad2df38`. */
  imageTag: string;
  /** "perkos" | "byok" | "skip" — informs whether we stash a BYOK key. */
  llmSource: "perkos" | "byok" | "skip";
  /** Required when llmSource === "byok". */
  byokApiKey?: string;
  /** Agent ID issued by /api/agents/launch (firestore agents/{name} doc). */
  agentId: string;
};

export type ProvisionResult = {
  serviceArn: string;
  taskDefinitionArn: string;
  imageUri: string;
};

/**
 * Verify the image tag came from the admin's curated list. The wizard
 * sends what /api/runtimes returned, so under normal use this always
 * matches — the check exists to make sure a hand-crafted request can't
 * pin some random/old tag we haven't approved.
 */
async function assertImageTagIsActive(
  runtime: "OpenClaw" | "Hermes",
  imageTag: string
): Promise<void> {
  const kind = runtime.toLowerCase();
  const key = `${kind}:${imageTag}`;
  const snap = await adminDb().collection("runtime_images").doc(key).get();
  if (!snap.exists) {
    throw new Error(`Image tag ${imageTag} not found for ${runtime}.`);
  }
  if (snap.data()?.active !== true) {
    throw new Error(`Image tag ${imageTag} is not active for provisioning.`);
  }
}

function repoNameFor(runtime: "OpenClaw" | "Hermes"): string {
  return runtime === "OpenClaw" ? "perkos-openclaw" : "perkos-hermes";
}

function imageUriFor(runtime: "OpenClaw" | "Hermes", tag: string): string {
  return `${ECR_REGISTRY}/${repoNameFor(runtime)}:${tag}`;
}

function familyFor(walletAddress: string, agentName: string): string {
  // Task definition families are global, namespaced by walletAddress so
  // two wallets can use the same agentName without collision.
  return `perkos-agent-${walletAddress.toLowerCase().slice(2, 10)}-${agentName.toLowerCase()}`;
}

function serviceNameFor(walletAddress: string, agentName: string): string {
  // ECS service names must be <= 255 chars and match [a-zA-Z0-9_-]. We
  // truncate the wallet address to avoid hitting the cap on long names.
  return `agent-${walletAddress.toLowerCase().slice(2, 10)}-${agentName.toLowerCase()}`;
}

/**
 * Stash the BYOK API key in Secrets Manager. Returns the ARN that the
 * task definition will reference. No-op for non-BYOK flows.
 */
async function ensureLlmSecret(
  walletAddress: string,
  agentName: string,
  apiKey: string
): Promise<string> {
  const name = `perkos-agents/${walletAddress.toLowerCase()}/${agentName.toLowerCase()}/llm-key`;
  try {
    const existing = await sm().send(new DescribeSecretCommand({ SecretId: name }));
    // Refresh on every provision so rotation works.
    await sm().send(new PutSecretValueCommand({ SecretId: name, SecretString: apiKey }));
    if (!existing.ARN) {
      throw new Error("Secrets Manager returned a doc with no ARN.");
    }
    return existing.ARN;
  } catch (err) {
    const code = (err as { name?: string }).name;
    if (code !== "ResourceNotFoundException") throw err;
    const created = await sm().send(
      new CreateSecretCommand({
        Name: name,
        SecretString: apiKey,
        Description: `PerkOS LLM key for ${walletAddress.toLowerCase()} / ${agentName}`,
      })
    );
    if (!created.ARN) throw new Error("Secrets Manager create returned no ARN.");
    return created.ARN;
  }
}

export async function provisionEcsAgent(
  input: ProvisionInput
): Promise<ProvisionResult> {
  await assertImageTagIsActive(input.runtime, input.imageTag);

  const wallet = input.walletAddress.toLowerCase();
  const family = familyFor(wallet, input.agentName);
  const serviceName = serviceNameFor(wallet, input.agentName);
  const imageUri = imageUriFor(input.runtime, input.imageTag);

  // Env for the runtime container. The entrypoint shim in PerkOS-Containers
  // templates these into ~/.openclaw/openclaw.json or hermes config.yaml.
  const runtimeEnv: { name: string; value: string }[] = [
    { name: "PERKOS_AGENT_ID", value: input.agentId },
    { name: "PERKOS_AGENT_NAME", value: input.agentName },
    { name: "PERKOS_LLM_BASE_URL", value: PERKOS_LLM_BASE_URL },
    { name: "PERKOS_LLM_DEFAULT_MODEL", value: "kimi-k2.6:cloud" },
  ];

  let secretArn: string | null = null;
  if (input.llmSource === "byok" && input.byokApiKey) {
    secretArn = await ensureLlmSecret(wallet, input.agentName, input.byokApiKey);
  }

  // Task definition: runtime container + perkos-a2a sidecar.
  // The sidecar pins the npm @perkos/perkos-a2a@0.9.0 image (separate ECR
  // repo — to be set up in a follow-up). For now we ship the runtime
  // alone; A2A bridging stays a manual wire-up until the bridge image
  // gets published.
  const containerDefinitions = [
    {
      name: "runtime",
      image: imageUri,
      essential: true,
      cpu: 0,
      environment: runtimeEnv,
      secrets: secretArn
        ? [{ name: "PERKOS_LLM_API_KEY", valueFrom: secretArn }]
        : [],
      logConfiguration: {
        logDriver: LogDriver.AWSLOGS,
        options: {
          "awslogs-group": LOG_GROUP,
          "awslogs-region": REGION,
          "awslogs-stream-prefix": `agent-${wallet.slice(2, 10)}-${input.agentName}`,
          "awslogs-create-group": "true",
        },
      },
    },
  ];

  const taskDef = await ecs().send(
    new RegisterTaskDefinitionCommand({
      family,
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      cpu: TASK_CPU,
      memory: TASK_MEMORY,
      executionRoleArn: EXECUTION_ROLE_ARN,
      taskRoleArn: TASK_ROLE_ARN,
      containerDefinitions,
    })
  );
  const taskDefinitionArn = taskDef.taskDefinition?.taskDefinitionArn;
  if (!taskDefinitionArn) {
    throw new Error("ECS RegisterTaskDefinition returned no ARN.");
  }

  // Create or update the service. Idempotent on (cluster, serviceName).
  const networkConfiguration = {
    awsvpcConfiguration: {
      subnets: VPC_SUBNETS,
      securityGroups: [SECURITY_GROUP],
      // ENABLED = public IP attached. Required so the task can reach
      // transport.perkos.xyz + the LLM gateway from a default VPC without
      // a NAT gateway. The SG denies all ingress so this is still safe.
      assignPublicIp: "ENABLED" as const,
    },
  };

  const existing = await ecs().send(
    new DescribeServicesCommand({ cluster: CLUSTER, services: [serviceName] })
  );
  const found = existing.services?.find(
    (s) => s.status === "ACTIVE" && s.serviceName === serviceName
  );

  let serviceArn: string;
  if (found) {
    const updated = await ecs().send(
      new UpdateServiceCommand({
        cluster: CLUSTER,
        service: serviceName,
        taskDefinition: taskDefinitionArn,
        desiredCount: 1,
        networkConfiguration,
        forceNewDeployment: true,
      })
    );
    serviceArn = updated.service?.serviceArn ?? "";
  } else {
    const created = await ecs().send(
      new CreateServiceCommand({
        cluster: CLUSTER,
        serviceName,
        taskDefinition: taskDefinitionArn,
        desiredCount: 1,
        launchType: "FARGATE",
        networkConfiguration,
      })
    );
    serviceArn = created.service?.serviceArn ?? "";
  }

  if (!serviceArn) {
    throw new Error("ECS service ARN missing after create/update.");
  }

  return {
    serviceArn,
    taskDefinitionArn,
    imageUri,
  };
}
