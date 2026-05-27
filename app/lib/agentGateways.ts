/**
 * Messaging gateways data layer.
 *
 * One agent can enable any subset of the supported messaging
 * gateways. Each entry on the agent's Firestore doc carries:
 *   - the gateway type ("telegram" | "farcaster" | ...)
 *   - enable flag
 *   - non-secret config (e.g. webhook visibility, channel scope)
 *   - lifecycle stamps
 *   - status (`pending` until the runtime confirms it picked up the
 *     config, `active` once Hermes reports the platform connected,
 *     `error` with a reason if it failed)
 *
 * Secret values (bot tokens, signer UUIDs, API keys) NEVER live on
 * the Firestore doc. They live in AWS Secrets Manager under the
 * same wallet-scoped prefix the LLM keys already use. The doc only
 * stores boolean "secret was provided" markers so the wizard /
 * admin UIs can render presence without round-tripping to AWS.
 *
 * This module is the single source of truth for:
 *   - the gateway type registry (what platforms we support today)
 *   - the secret-name conventions (per-gateway-per-secret)
 *   - the Firestore <-> Secrets-Manager glue (read + write)
 *   - the runtime-env materialization (which secrets become which
 *     env vars in the agent container — read by ecsProvision in a
 *     follow-up PR)
 *
 * Kept deliberately small + pure where possible. The HTTP routes
 * import this; ecsProvision will import this. Tests cover the pure
 * parts (catalog, env materialization, secret-name shape) without
 * Firestore or AWS.
 */

export type GatewayType = "telegram" | "farcaster";

/**
 * What the runtime needs to bring a gateway up.
 *
 * Each `secrets` entry maps a human key to:
 *   - the AWS Secrets Manager "kind" suffix we'll store it under
 *     (full secret name = `perkos-agents/<wallet>/<agent>/<kind>`)
 *   - the env var the Hermes container reads it from
 *
 * Each `nonSecretConfig` entry is a piece of public-safe config
 * that goes on the Firestore doc (e.g. webhook visibility mode).
 *
 * `requiredSecretKeys` is the contract enforced server-side when a
 * wallet enables a gateway — every key here must be present in the
 * incoming form payload.
 */
export type GatewaySpec = {
  type: GatewayType;
  label: string;
  /**
   * Map of `formKey -> { secretKind, envVar }`. The form key is what
   * the wizard sends; the secretKind is the suffix on the SM secret
   * name; the envVar is what Hermes reads at runtime.
   */
  secrets: Record<string, { secretKind: string; envVar: string }>;
  /**
   * Map of `formKey -> { envVar, required }`. These live on the
   * Firestore doc AND get materialized as env vars when the agent
   * provisions. Use for non-sensitive values (visibility, channel
   * URL, etc).
   */
  nonSecretConfig: Record<string, { envVar: string; required: boolean }>;
  /**
   * Env var the entrypoint reads to decide whether to stage this
   * gateway's plugin and flip the `enabled: true` in config.yaml.
   */
  enabledEnvVar: string;
};

export const GATEWAY_CATALOG: Record<GatewayType, GatewaySpec> = {
  telegram: {
    type: "telegram",
    label: "Telegram",
    enabledEnvVar: "TELEGRAM_ENABLED",
    secrets: {
      botToken: {
        secretKind: "gateway-telegram-bot-token",
        envVar: "TELEGRAM_BOT_TOKEN",
      },
    },
    nonSecretConfig: {
      webhookUrl: { envVar: "TELEGRAM_WEBHOOK_URL", required: false },
    },
  },
  farcaster: {
    type: "farcaster",
    label: "Farcaster",
    enabledEnvVar: "FARCASTER_ENABLED",
    secrets: {
      neynarApiKey: {
        secretKind: "gateway-farcaster-neynar-key",
        envVar: "FARCASTER_NEYNAR_API_KEY",
      },
      signerUuid: {
        secretKind: "gateway-farcaster-signer",
        envVar: "FARCASTER_SIGNER_UUID",
      },
      webhookSecret: {
        secretKind: "gateway-farcaster-webhook-secret",
        envVar: "FARCASTER_WEBHOOK_SECRET",
      },
    },
    nonSecretConfig: {
      fid: { envVar: "FARCASTER_FID", required: true },
      replyVisibility: { envVar: "FARCASTER_REPLY_VISIBILITY", required: false },
      parentChannel: { envVar: "FARCASTER_PARENT_CHANNEL", required: false },
    },
  },
};

export type AgentGatewayStatus = "pending" | "active" | "error";

/**
 * What lives on a Firestore agent doc under `gateways.<type>`.
 *
 * No secret values here. `secretsProvided` is the set of `formKey`s
 * we've stashed in Secrets Manager — used by the UI to render
 * "Token: configured" / "Token: missing" without reading AWS.
 */
export type AgentGatewayRecord = {
  type: GatewayType;
  enabled: boolean;
  nonSecretConfig: Record<string, string>;
  secretsProvided: string[];
  status: AgentGatewayStatus;
  statusMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentGateways = Partial<Record<GatewayType, AgentGatewayRecord>>;

/**
 * What the wizard / API sends in when enabling or updating a gateway.
 *
 * `secrets` carries the raw secret VALUES; we strip them before
 * persisting to Firestore — only `secretsProvided` keys survive.
 */
export type GatewayUpsertInput = {
  type: GatewayType;
  enabled: boolean;
  nonSecretConfig?: Record<string, string>;
  secrets?: Record<string, string>;
};

export type GatewayValidationError = {
  field: string;
  message: string;
};

/**
 * Validate an incoming upsert against the catalog.
 *
 * Pure. Returns either the canonicalized record (without secrets) or
 * a list of validation errors. The HTTP route surfaces these as 400s
 * with a field map so the form can highlight precisely.
 */
export function validateGatewayUpsert(
  input: GatewayUpsertInput,
): { ok: true; clean: GatewayUpsertInput } | { ok: false; errors: GatewayValidationError[] } {
  const errors: GatewayValidationError[] = [];
  const spec = GATEWAY_CATALOG[input.type];
  if (!spec) {
    return {
      ok: false,
      errors: [{ field: "type", message: `unknown gateway type: ${input.type}` }],
    };
  }

  // When enabled=true, every required secret + required non-secret
  // must be present. When enabled=false we only persist the toggle
  // (and leave any existing secrets alone — operator can re-enable
  // without re-entering them).
  if (input.enabled) {
    for (const [formKey] of Object.entries(spec.secrets)) {
      const value = input.secrets?.[formKey];
      if (!value || !value.trim()) {
        errors.push({
          field: `secrets.${formKey}`,
          message: `${spec.label} requires ${formKey}`,
        });
      }
    }
    for (const [formKey, meta] of Object.entries(spec.nonSecretConfig)) {
      if (!meta.required) continue;
      const value = input.nonSecretConfig?.[formKey];
      if (!value || !String(value).trim()) {
        errors.push({
          field: `nonSecretConfig.${formKey}`,
          message: `${spec.label} requires ${formKey}`,
        });
      }
    }
  }

  // Drop unknown keys (defense in depth; the form sends what we
  // declare here but reject anything else).
  const cleanedSecrets: Record<string, string> = {};
  for (const formKey of Object.keys(spec.secrets)) {
    const v = input.secrets?.[formKey];
    if (typeof v === "string" && v.trim()) cleanedSecrets[formKey] = v;
  }
  const cleanedConfig: Record<string, string> = {};
  for (const formKey of Object.keys(spec.nonSecretConfig)) {
    const v = input.nonSecretConfig?.[formKey];
    if (typeof v === "string" && v.trim()) cleanedConfig[formKey] = v;
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    clean: {
      type: input.type,
      enabled: input.enabled,
      secrets: cleanedSecrets,
      nonSecretConfig: cleanedConfig,
    },
  };
}

/**
 * Produce the runtime env contract for a gateway record + its known
 * secret ARNs. The shape matches what ECS task definitions expect
 * (a list of `{ name, value }` for plain env and `{ name, valueFrom }`
 * for Secrets Manager refs). ecsProvision consumes this in a
 * follow-up PR; living here keeps the runtime contract next to the
 * catalog that defines it.
 *
 * Pure. `secretArns` is `formKey -> SM secret ARN`; the caller is
 * responsible for actually creating those secrets via
 * `ensureAgentSecret()`.
 */
export function gatewayRuntimeEnv(
  record: AgentGatewayRecord,
  secretArns: Record<string, string>,
): {
  env: Array<{ name: string; value: string }>;
  secrets: Array<{ name: string; valueFrom: string }>;
} {
  const spec = GATEWAY_CATALOG[record.type];
  if (!spec) return { env: [], secrets: [] };

  const env: Array<{ name: string; value: string }> = [];
  const secrets: Array<{ name: string; valueFrom: string }> = [];

  // Master enable flag — the entrypoint reads this to decide whether
  // to stage the plugin and write `enabled: true` into config.yaml.
  if (record.enabled) {
    env.push({ name: spec.enabledEnvVar, value: "true" });
  }

  // Non-secret config — only emit keys present on the record.
  for (const [formKey, meta] of Object.entries(spec.nonSecretConfig)) {
    const value = record.nonSecretConfig[formKey];
    if (value != null && value !== "") {
      env.push({ name: meta.envVar, value: String(value) });
    }
  }

  // Secret refs — only emit for secrets we have an ARN for. Missing
  // ARNs are silent (ecsProvision is the layer that decides whether
  // missing-required is a hard error or a degraded provision).
  for (const [formKey, meta] of Object.entries(spec.secrets)) {
    const arn = secretArns[formKey];
    if (arn) secrets.push({ name: meta.envVar, valueFrom: arn });
  }

  return { env, secrets };
}

/**
 * Compose a Secrets Manager secret name for one gateway secret.
 *
 * Format: `perkos-agents/<wallet>/<agent>/<secretKind>`
 * — matches the existing convention used by `ensureAgentSecret` for
 * LLM keys + relay API keys. Keeping the prefix uniform means the
 * existing IAM policy (`perkos-agents/*` GetSecretValue) just works
 * for gateway secrets without policy changes.
 */
export function gatewaySecretName(
  walletAddress: string,
  agentName: string,
  type: GatewayType,
  formKey: string,
): string {
  const spec = GATEWAY_CATALOG[type];
  if (!spec) throw new Error(`unknown gateway type: ${type}`);
  const secretMeta = spec.secrets[formKey];
  if (!secretMeta) {
    throw new Error(`unknown secret formKey for ${type}: ${formKey}`);
  }
  return `perkos-agents/${walletAddress.toLowerCase()}/${agentName.toLowerCase()}/${secretMeta.secretKind}`;
}
