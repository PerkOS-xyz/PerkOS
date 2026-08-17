/**
 * Runtime-flavored config previews for the agent launcher wizard.
 *
 * Each runtime (OpenClaw, Hermes) writes its provider/LLM settings in
 * a different shape, on disk:
 *
 *   OpenClaw  →  ~/.openclaw/openclaw.json
 *                (JSON; provider blocks under models.providers.*)
 *   Hermes    →  ~/.hermes/profiles/<name>/config.yaml
 *                (YAML; secrets under config.secrets, provider under
 *                 config.provider)
 *
 * The wizard renders the *literal* text the user (or the ECS entrypoint
 * script) will write — so what you see is what gets persisted. This
 * builds trust: the preview is not a marketing diagram, it's the
 * actual config.
 */

import type { AgentRuntime } from "./perkosApi";

export type LLMSource = "perkos" | "byok" | "skip";

export type ConfigPreviewInput = {
  runtime: AgentRuntime;
  agentName: string;
  llmSource: LLMSource;
  /** Free-form provider id when llmSource === 'byok'. */
  byokProvider?: string;
  /** Model id ("claude-sonnet-4-5", "gpt-4o-mini", etc.). */
  modelId?: string;
  /** Stable agent id (the one PerkOS issues; goes into x-agent-id). */
  perkosAgentId?: string;
};

/**
 * Build an OpenClaw provider block matching the shape that lives under
 * `models.providers.*` in `~/.openclaw/openclaw.json`. The block is
 * inert until the user actually copies it into their config (or the
 * ECS entrypoint script writes it on boot).
 *
 * `$ENV_VAR` strings remain literal in the preview — the runtime
 * dereferences them at load time, not the preview generator. This is
 * standard OpenClaw idiom (see openclaw/examples).
 */
export function buildOpenClawPreview(input: ConfigPreviewInput): string {
  const { llmSource, byokProvider, modelId, perkosAgentId } = input;

  if (llmSource === "skip") {
    return [
      "{",
      "  // No LLM source configured yet.",
      "  // Add a provider under `models.providers.*` before the agent",
      "  // can run. See https://docs.perkos.xyz/agents/llm",
      "}",
    ].join("\n");
  }

  if (llmSource === "perkos") {
    return [
      "{",
      '  "models": {',
      '    "providers": {',
      '      "ollama": {',
      '        "baseUrl": "https://api.llm.perkos.xyz",',
      '        "apiKey": "$PERKOS_LLM_API_KEY",',
      '        "api": "ollama",',
      '        "headers": {',
      `          "x-agent-id": "${perkosAgentId ?? "$PERKOS_AGENT_ID"}"`,
      "        },",
      '        "models": [',
      '          { "id": "kimi-k2.6:cloud", "name": "Kimi K2.6 Cloud", "contextWindow": 128000 },',
      '          { "id": "qwen2.5:7b", "name": "Qwen 2.5 7B", "contextWindow": 32768 },',
      '          { "id": "qwen2.5:14b", "name": "Qwen 2.5 14B", "contextWindow": 32768 }',
      "        ]",
      "      }",
      "    }",
      "  }",
      "}",
    ].join("\n");
  }

  // BYOK — mirrors what PerkOS actually provisions (PerkOS-API
  // services/ecs/provision.ts). The provider is keyed "byok", NOT the vendor
  // name: a provider that normalizes to "openai" + the official api.openai.com
  // baseUrl makes OpenClaw route through the Codex/Responses runtime, which
  // expects an OAuth profile and IGNORES the config apiKey → posts to
  // /v1/responses with no bearer → 401 (verified in the latest source,
  // src/agents/openai-routing.ts → openAIProviderUsesCodexRuntimeByDefault).
  // The "byok" name skips Codex routing and uses the plain openai-completions
  // client: Authorization: Bearer <key> → <baseUrl>/chat/completions. The
  // model is referenced on the wire as "byok/<id>" → stripped to "<id>".
  // Custom providers must declare baseUrl + a models[] array (zod-enforced:
  // src/config/zod-schema.core.ts) — defaultModel is NOT a valid field.
  const provider = byokProvider ?? "openai";
  const baseUrl = byokBaseUrl(provider);
  const model = byokDefaultModel(provider, modelId);

  return [
    "{",
    '  "models": {',
    '    "providers": {',
    '      "byok": {',
    `        "baseUrl": "${baseUrl}",`,
    '        "api": "openai-completions",',
    '        "apiKey": "$PERKOS_LLM_API_KEY",',
    '        "models": [',
    `          { "id": "${model}", "name": "${model}", "contextWindow": 128000 }`,
    "        ]",
    "      }",
    "    }",
    "  }",
    "}",
  ].join("\n");
}

/**
 * Build a Hermes `config.yaml` snippet. Hermes uses an OpenAI-compatible
 * provider block plus an inline `secrets:` map keyed by env var name —
 * which matches `requires_env` declared in each provider plugin's
 * `plugin.yaml`.
 */
export function buildHermesPreview(input: ConfigPreviewInput): string {
  const { llmSource, byokProvider, modelId, perkosAgentId } = input;

  if (llmSource === "skip") {
    return [
      "# No LLM source configured yet.",
      "# Add a provider block before the agent can run.",
      "# See https://docs.perkos.xyz/agents/llm",
    ].join("\n");
  }

  if (llmSource === "perkos") {
    // PerkOS-LLM exposes /v1/chat/completions — OpenAI-compatible.
    return [
      "provider:",
      "  name: openai",
      "  base_url: https://api.llm.perkos.xyz/v1",
      "  api_key_env: PERKOS_LLM_API_KEY",
      "model:",
      "  default: kimi-k2.6:cloud",
      "secrets:",
      "  PERKOS_LLM_API_KEY: <issued-by-perkos>",
      `  PERKOS_AGENT_ID: ${perkosAgentId ?? "<onboarded-agent-id>"}`,
    ].join("\n");
  }

  // BYOK — mirrors what PerkOS actually provisions (PerkOS-API
  // services/ecs/provision.ts). Hermes resolves a custom provider's key from an
  // inline api_key (or a host-derived <VENDOR>_API_KEY env), NOT from
  // api_key_env, so the key is set inline. api_mode is PINNED to
  // chat_completions: Hermes auto-detects the wire protocol from base_url and
  // maps api.openai.com → codex_responses (latest source:
  // hermes_cli/runtime_provider.py _detect_api_mode_for_url), which would break
  // an OpenAI-compatible BYOK key. Pinning it forces /chat/completions.
  const provider = byokProvider ?? "openai";
  const baseUrl = byokBaseUrl(provider);
  const model = byokDefaultModel(provider, modelId);

  return [
    "model:",
    `  default: ${model}`,
    "  provider: custom",
    `  base_url: ${baseUrl}`,
    "  api_mode: chat_completions",
    "  api_key: $PERKOS_LLM_API_KEY",
  ].join("\n");
}


/**
 * ZeroClaw renders TOML at `$HOME/.zeroclaw/config.toml`, and PerkOS writes it
 * by driving `zeroclaw config set --no-interactive` rather than templating a
 * file — the runtime encrypts secrets at rest, so the key never appears in
 * plaintext on disk. The preview shows the resulting shape.
 *
 * Two fields are easy to get wrong by analogy with the other runtimes: the
 * endpoint field is `uri` (there is no `base_url` on a ZeroClaw model provider),
 * and an agent MUST reference a configured `[risk_profiles.<alias>]` or every
 * message fails with a generic "LLM request failed" without the model ever
 * being called.
 */
export function buildZeroClawPreview(input: ConfigPreviewInput): string {
  const { llmSource, byokProvider, modelId } = input;

  if (llmSource === "skip") {
    return [
      "# No LLM source configured yet.",
      "# Add a provider block before the agent can run.",
      "# See https://docs.perkos.xyz/agents/llm",
    ].join("\n");
  }

  const isPerkos = llmSource === "perkos";
  const provider = byokProvider ?? "openai";
  const uri = isPerkos ? "https://api.llm.perkos.xyz/v1" : byokBaseUrl(provider);
  const model = isPerkos
    ? "kimi-k2.6:cloud"
    : byokDefaultModel(provider, modelId);

  return [
    "[providers.models.custom.perkos]",
    `uri = "${uri}"`,
    `model = "${model}"`,
    'wire_api = "chat_completions"',
    'kind = "openai-compatible"',
    'api_key = "enc2:<encrypted-at-rest>"',
    "",
    "[agents.default]",
    'model_provider = "custom.perkos"',
    'risk_profile = "perkos"',
    "",
    "[risk_profiles.perkos]",
    'level = "supervised"',
    "workspace_only = true",
    "",
    "[gateway]",
    'host = "0.0.0.0"',
    "port = 42617",
    "paired_tokens = [\"<issued-by-perkos>\"]",
  ].join("\n");
}

export function buildConfigPreview(input: ConfigPreviewInput): {
  language: "jsonc" | "yaml" | "toml";
  content: string;
  configPath: string;
} {
  if (input.runtime === "OpenClaw") {
    return {
      language: "jsonc",
      content: buildOpenClawPreview(input),
      configPath: "~/.openclaw/openclaw.json",
    };
  }
  if (input.runtime === "ZeroClaw") {
    return {
      language: "toml",
      content: buildZeroClawPreview(input),
      configPath: "~/.zeroclaw/config.toml",
    };
  }
  return {
    language: "yaml",
    content: buildHermesPreview(input),
    configPath: `~/.hermes/profiles/${input.agentName || "<name>"}/config.yaml`,
  };
}

/**
 * Per-runtime BYOK provider options. All entries are OpenAI-compatible,
 * because that's the only wire protocol PerkOS provisions for BYOK
 * (provider "byok" + openai-completions / Hermes provider:custom +
 * api_mode:chat_completions). Anthropic-direct is intentionally NOT offered:
 * its native API is /v1/messages, not /chat/completions, so forcing the
 * OpenAI-compatible wire fails — Claude is reachable via OpenRouter, which IS
 * OpenAI-compatible. Ollama also exposes /v1/chat/completions, so it fits.
 */
export function byokProviderOptions(runtime: AgentRuntime): {
  id: string;
  label: string;
  defaultModel: string;
}[] {
  if (runtime === "OpenClaw" || runtime === "ZeroClaw") {
    return [
      { id: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini" },
      { id: "openrouter", label: "OpenRouter (incl. Claude)", defaultModel: "openai/gpt-4o-mini" },
    ];
  }
  return [
    { id: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini" },
    { id: "openrouter", label: "OpenRouter (incl. Claude)", defaultModel: "openai/gpt-4o-mini" },
    { id: "ollama", label: "Local Ollama", defaultModel: "qwen2.5:7b" },
  ];
}

/**
 * BYOK provider → OpenAI-compatible base URL (incl. version path). The launch
 * route forwards this as `llmBaseUrl`; provision.ts then points the runtime at
 * it with the `openai-completions` wire protocol + provider name `byok` (which
 * skips OpenClaw's Codex/Responses routing — see project_byok_openai_runtime_config).
 * openai + openrouter are first-class OpenAI-compatible; anthropic is best-effort
 * (its native API isn't /chat/completions — prefer OpenRouter for Claude); ollama
 * assumes a sidecar reachable from the task (not the user's localhost).
 */
export function byokBaseUrl(provider: string): string {
  switch (provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "anthropic":
      return "https://api.anthropic.com/v1";
    case "ollama":
      return "http://127.0.0.1:11434/v1";
    default:
      return "https://api.openai.com/v1";
  }
}

/**
 * Default model id per BYOK provider, unless the user typed one. Mirrors the
 * defaults the wizard seeds in byokProviderOptions; the launch route forwards
 * the chosen id as `llmModel`, which provision.ts writes as the provider's
 * model (OpenClaw `models[].id` / Hermes `model.default`).
 */
export function byokDefaultModel(provider: string, modelId?: string): string {
  if (modelId && modelId.trim()) return modelId.trim();
  switch (provider) {
    case "anthropic":
      return "claude-sonnet-4-5";
    case "openrouter":
      return "openai/gpt-4o-mini";
    case "ollama":
      return "qwen2.5:7b";
    default:
      return "gpt-4o-mini"; // openai + unknown
  }
}
