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
const ENV = process.env.PERKOS_ENV ?? "dev";
const HIBERNATION_BUCKET = `perkos-agent-snapshots-${ENV}`;
// Generous drain window: lets the container forward SIGTERM to upstream
// Hermes, wait for it to quiesce, tar HERMES_HOME, and upload to S3.
// PerkOS-Containers' docker-entrypoint.sh relies on this budget.
const HIBERNATION_STOP_TIMEOUT_SECONDS = 300;

// --- perkos-a2a bridge sidecar config ---------------------------------
// The bridge image lives in its own ECR repo (perkos-a2a-bridge) built
// from PerkOS-Containers/images/perkos-a2a-bridge/Dockerfile. The image
// has to be pushed to ECR for the sidecar wiring below to actually
// launch — until the push exists, every provision that asks for the
// bridge will fail at ECS task-start with "image pull failed". We
// guard against that by only attaching the sidecar when the runtime
// config provides relayApiKey AND the PERKOS_A2A_BRIDGE_ENABLED env
// flag is on.
const A2A_BRIDGE_ENABLED =
  (process.env.PERKOS_A2A_BRIDGE_ENABLED ?? "false").toLowerCase() === "true";
const A2A_BRIDGE_IMAGE_TAG = process.env.PERKOS_A2A_BRIDGE_IMAGE_TAG ?? "latest";
const A2A_BRIDGE_IMAGE_URI = `${ECR_REGISTRY}/perkos-a2a-bridge:${A2A_BRIDGE_IMAGE_TAG}`;
const A2A_RELAY_URL =
  process.env.PERKOS_TRANSPORT_URL ?? "wss://transport.perkos.xyz/a2a";
const A2A_CHAT_URL =
  process.env.PERKOS_CHAT_URL ?? "wss://chat.perkos.xyz/chat";
const A2A_TOOLS_API_URL = process.env.PERKOS_TOOLS_API_URL?.trim() ?? "";
const A2A_TOOLS_JWT_SECRET = process.env.A2A_TOOLS_JWT_SECRET?.trim() ?? "";

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
  /** Required when llmSource === "byok" — the user's own LLM provider key
   *  (OpenAI / Anthropic / OpenRouter). Stashed at .../llm-key. */
  byokApiKey?: string;
  /** When llmSource === "perkos", the per-agent key minted via
   *  registerLlmAgent() against api.llm.perkos.xyz. Stashed at
   *  .../perkos-llm-key. The runtime authenticates with this when it
   *  calls the PerkOS LLM gateway. */
  perkosLlmApiKey?: string;
  /** Agent ID issued by /api/agents/launch (firestore agents/{name} doc). */
  agentId: string;
  /** Per-agent relayApiKey minted at launch time (lives at
   *  /agents/{name}.relayApiKey in Firestore). When provided + the
   *  PERKOS_A2A_BRIDGE_ENABLED env is true, the task definition gets a
   *  perkos-a2a-bridge sidecar that connects this agent to
   *  chat.perkos.xyz + transport.perkos.xyz. Without this, the agent
   *  is reachable only through whatever direct transport its runtime
   *  image ships with. */
  relayApiKey?: string;
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
 * Stash a Secrets Manager secret for a wallet/agent pair. Returns the ARN
 * that the task definition will reference. `kind` namespaces the secret
 * under the agent (e.g. `llm-key` for BYOK, `perkos-llm-key` for the
 * gateway-minted Bearer key) so a single agent can have both.
 */
async function ensureAgentSecret(
  walletAddress: string,
  agentName: string,
  kind: "llm-key" | "perkos-llm-key" | "relay-api-key",
  apiKey: string,
  description: string,
): Promise<string> {
  const name = `perkos-agents/${walletAddress.toLowerCase()}/${agentName.toLowerCase()}/${kind}`;
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
        Description: description,
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
    // Hibernation: the runtime's entrypoint reads this on boot (restore)
    // and SIGTERM (snapshot). Wallet/agent-scoped prefix; the bucket's
    // KMS encryption + IAM least-priv policy were stood up by
    // ops/aws/hibernation/bootstrap.sh.
    {
      name: "PERKOS_HIBERNATION_S3_URI",
      value: `s3://${HIBERNATION_BUCKET}/${wallet}/${input.agentName.toLowerCase()}/`,
    },
  ];

  // Resolve which key the runtime should send as Authorization: Bearer
  // to the LLM endpoint. Exactly one wins:
  //
  //   - byok mode → user's own provider key, stashed at .../llm-key
  //   - perkos mode → key minted from api.llm.perkos.xyz, stashed at
  //     .../perkos-llm-key (requires PerkOS-App to have called
  //     registerLlmAgent() upstream and passed the result here)
  //   - skip → no key; the runtime will run without LLM access
  let secretArn: string | null = null;
  if (input.llmSource === "byok" && input.byokApiKey) {
    secretArn = await ensureAgentSecret(
      wallet,
      input.agentName,
      "llm-key",
      input.byokApiKey,
      `BYOK LLM key for ${wallet} / ${input.agentName}`,
    );
  } else if (input.llmSource === "perkos" && input.perkosLlmApiKey) {
    secretArn = await ensureAgentSecret(
      wallet,
      input.agentName,
      "perkos-llm-key",
      input.perkosLlmApiKey,
      `PerkOS LLM gateway key for ${wallet} / ${input.agentName}`,
    );
  }

  // The bridge sidecar is only added when:
  //   1. The runtime config gives us a relayApiKey (so the bridge can
  //      authenticate to chat.perkos.xyz + transport.perkos.xyz), AND
  //   2. PERKOS_A2A_BRIDGE_ENABLED env is "true" (so the operator has
  //      opted in once the perkos-a2a-bridge ECR image is published).
  // Without both, we ship the runtime alone — same shape as before
  // this PR, no behavior change for unconfigured deploys.
  const attachBridge = A2A_BRIDGE_ENABLED && Boolean(input.relayApiKey);

  // Stash the relayApiKey in Secrets Manager so the bridge container
  // reads it via the task def's `secrets` field instead of a plaintext
  // env literal that would be visible to anyone with ecs:Describe* on
  // the task definition.
  let relayApiKeySecretArn: string | null = null;
  if (attachBridge && input.relayApiKey) {
    relayApiKeySecretArn = await ensureAgentSecret(
      wallet,
      input.agentName,
      "relay-api-key",
      input.relayApiKey,
      `relayApiKey for ${wallet} / ${input.agentName} (a2a bridge auth)`,
    );
  }

  // Task definition: runtime container + (optionally) perkos-a2a bridge
  // sidecar. The two containers share the task's network namespace, so
  // the bridge reaches the runtime over 127.0.0.1 — no service mesh
  // needed, no security group exposure.
  const containerDefinitions: Array<Record<string, unknown>> = [
    {
      name: "runtime",
      image: imageUri,
      essential: true,
      cpu: 0,
      environment: runtimeEnv,
      secrets: secretArn
        ? [{ name: "PERKOS_LLM_API_KEY", valueFrom: secretArn }]
        : [],
      // Give the entrypoint enough time to drain Hermes + tar +
      // upload to S3 when SIGTERM arrives (default would be 30s and
      // kill the snapshot mid-upload).
      stopTimeout: HIBERNATION_STOP_TIMEOUT_SECONDS,
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

  if (attachBridge && relayApiKeySecretArn) {
    // Bridge env — keep this in sync with PerkOS-A2A's bridge-agent.ts
    // loadConfig(). The bridge reaches the runtime over localhost
    // because Fargate puts both containers in the same network
    // namespace; HERMES_API_URL therefore points at 127.0.0.1.
    const bridgeEnv: { name: string; value: string }[] = [
      { name: "A2A_AGENT_NAME", value: input.agentName },
      { name: "A2A_RUNTIME", value: input.runtime === "Hermes" ? "hermes-api" : "openclaw" },
      { name: "HERMES_API_URL", value: "http://127.0.0.1:8642" },
      { name: "A2A_RELAY_ENABLED", value: "true" },
      { name: "A2A_RELAY_URL", value: A2A_RELAY_URL },
      { name: "A2A_CHAT_ENABLED", value: "true" },
      { name: "A2A_CHAT_URL", value: A2A_CHAT_URL },
    ];
    // Tools-API wiring — only when both knobs are configured. Without
    // them the bridge skips the tools-token listener and the runtime
    // simply can't call the platform-tools-api. Per the PerkOS-A2A
    // 0.10.0 contract, partial config is a hard refuse.
    if (A2A_TOOLS_API_URL && A2A_TOOLS_JWT_SECRET) {
      bridgeEnv.push(
        { name: "A2A_TOOLS_API_URL", value: A2A_TOOLS_API_URL },
        // A2A_TOOLS_JWT_SECRET is passed as a secret below — listing
        // it here as a literal would shadow that. (Intentionally
        // omitted from bridgeEnv.)
      );
    }

    const bridgeSecrets: Array<{ name: string; valueFrom: string }> = [
      { name: "A2A_RELAY_API_KEY", valueFrom: relayApiKeySecretArn },
      // Same key under the chat-specific env var name the bridge reads
      // when A2A_CHAT_ENABLED=true.
      { name: "A2A_CHAT_API_KEY", valueFrom: relayApiKeySecretArn },
    ];
    if (A2A_TOOLS_API_URL && A2A_TOOLS_JWT_SECRET) {
      // The tools-JWT secret is operator config, NOT per-agent state —
      // we stash it under a shared Secrets Manager name so all agents
      // in this environment reference the same secret. Caller is
      // responsible for ensuring the secret exists; we don't create
      // it here (that's an ops one-time setup, not a per-provision
      // side effect).
      const sharedToolsSecretArn = `arn:aws:secretsmanager:${REGION}:${ACCOUNT}:secret:perkos-platform/${ENV}/tools-jwt-secret`;
      bridgeSecrets.push({
        name: "A2A_TOOLS_JWT_SECRET",
        valueFrom: sharedToolsSecretArn,
      });
    }

    containerDefinitions.push({
      name: "a2a-bridge",
      image: A2A_BRIDGE_IMAGE_URI,
      essential: false, // bridge dying shouldn't kill the agent
      cpu: 0,
      environment: bridgeEnv,
      secrets: bridgeSecrets,
      logConfiguration: {
        logDriver: LogDriver.AWSLOGS,
        options: {
          "awslogs-group": LOG_GROUP,
          "awslogs-region": REGION,
          "awslogs-stream-prefix": `bridge-${wallet.slice(2, 10)}-${input.agentName}`,
          "awslogs-create-group": "true",
        },
      },
    });
  }

  // CPU/memory: when the bridge is attached we double the budget so
  // both containers have headroom. Single-container provisions stay
  // on the lean shape they had pre-bridge, so existing deploys don't
  // see a cost bump.
  const taskCpu = attachBridge ? "1024" : TASK_CPU;
  const taskMemory = attachBridge ? "2048" : TASK_MEMORY;

  const taskDef = await ecs().send(
    new RegisterTaskDefinitionCommand({
      family,
      networkMode: "awsvpc",
      requiresCompatibilities: ["FARGATE"],
      cpu: taskCpu,
      memory: taskMemory,
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
