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

export type OpenClawByokProvider = "anthropic" | "openai" | "openrouter";
export type HermesByokProvider = "openai" | "anthropic" | "openrouter" | "ollama";

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

  // BYOK — provider-specific block
  const provider = (byokProvider ?? "anthropic") as OpenClawByokProvider;
  const envName = `${provider.toUpperCase()}_API_KEY`;
  const defaultModel =
    modelId ??
    (provider === "anthropic"
      ? "claude-sonnet-4-5"
      : provider === "openai"
        ? "gpt-4o-mini"
        : "openai/gpt-4o-mini");

  return [
    "{",
    '  "models": {',
    '    "providers": {',
    `      "${provider}": {`,
    `        "apiKey": "$${envName}",`,
    `        "defaultModel": "${defaultModel}"`,
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

  // BYOK — provider-specific block
  const provider = (byokProvider ?? "openai") as HermesByokProvider;
  const envName = `${provider.toUpperCase()}_API_KEY`;
  const defaultModel =
    modelId ??
    (provider === "openai"
      ? "gpt-4o-mini"
      : provider === "anthropic"
        ? "claude-sonnet-4-5"
        : provider === "openrouter"
          ? "openai/gpt-4o-mini"
          : "qwen2.5:7b");

  return [
    "provider:",
    `  name: ${provider}`,
    `  api_key_env: ${envName}`,
    "model:",
    `  default: ${defaultModel}`,
    "secrets:",
    `  ${envName}: <your-key-here>`,
  ].join("\n");
}

export function buildConfigPreview(input: ConfigPreviewInput): {
  language: "jsonc" | "yaml";
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
  return {
    language: "yaml",
    content: buildHermesPreview(input),
    configPath: `~/.hermes/profiles/${input.agentName || "<name>"}/config.yaml`,
  };
}

/**
 * Per-runtime BYOK provider options. Different sets because each
 * runtime ships different model-provider plugins out of the box.
 */
export function byokProviderOptions(runtime: AgentRuntime): {
  id: string;
  label: string;
  defaultModel: string;
}[] {
  if (runtime === "OpenClaw") {
    return [
      { id: "anthropic", label: "Anthropic", defaultModel: "claude-sonnet-4-5" },
      { id: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini" },
      { id: "openrouter", label: "OpenRouter", defaultModel: "openai/gpt-4o-mini" },
    ];
  }
  return [
    { id: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini" },
    { id: "anthropic", label: "Anthropic", defaultModel: "claude-sonnet-4-5" },
    { id: "openrouter", label: "OpenRouter", defaultModel: "openai/gpt-4o-mini" },
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
