import { describe, expect, it } from "vitest";

import {
  buildConfigPreview,
  buildHermesPreview,
  buildOpenClawPreview,
  byokProviderOptions,
} from "../app/lib/agentConfigPreview";

describe("buildOpenClawPreview", () => {
  it("renders the PerkOS LLM ollama provider block when llmSource=perkos", () => {
    const out = buildOpenClawPreview({
      runtime: "OpenClaw",
      agentName: "apollo",
      llmSource: "perkos",
      perkosAgentId: "ag_abc",
    });
    expect(out).toContain("api.llm.perkos.xyz");
    expect(out).toContain('"x-agent-id": "ag_abc"');
    expect(out).toContain('"kimi-k2.6:cloud"');
  });

  it("falls back to $PERKOS_AGENT_ID literal when no agent id given", () => {
    const out = buildOpenClawPreview({
      runtime: "OpenClaw",
      agentName: "a",
      llmSource: "perkos",
    });
    expect(out).toContain('"x-agent-id": "$PERKOS_AGENT_ID"');
  });

  it("renders the byok provider block (key 'byok' + PERKOS key) and maps the chosen provider", () => {
    // BYOK always keys the provider "byok" (not the vendor name) + reuses the
    // managed $PERKOS_LLM_API_KEY env, while baseUrl/model are mapped from the
    // chosen provider. anthropic still maps (free-form), even though it's not a
    // dropdown option — see byokProviderOptions.
    const out = buildOpenClawPreview({
      runtime: "OpenClaw",
      agentName: "a",
      llmSource: "byok",
      byokProvider: "anthropic",
    });
    expect(out).toContain('"byok"');
    expect(out).toContain('"apiKey": "$PERKOS_LLM_API_KEY"');
    expect(out).toContain('"api": "openai-completions"');
    expect(out).toContain("https://api.anthropic.com/v1");
    expect(out).toContain("claude-sonnet-4-5");
  });

  it("uses the supplied model id over the provider default", () => {
    const out = buildOpenClawPreview({
      runtime: "OpenClaw",
      agentName: "a",
      llmSource: "byok",
      byokProvider: "openai",
      modelId: "gpt-4o",
    });
    // Custom providers declare a models[] array (no `defaultModel` field).
    expect(out).toContain('"id": "gpt-4o"');
  });

  it("emits a JSONC skip stub when llmSource=skip", () => {
    const out = buildOpenClawPreview({
      runtime: "OpenClaw",
      agentName: "a",
      llmSource: "skip",
    });
    expect(out).toMatch(/No LLM source configured/);
    expect(out.trim().startsWith("{")).toBe(true);
  });
});

describe("buildHermesPreview", () => {
  it("renders the PerkOS LLM OpenAI-compat block for llmSource=perkos", () => {
    const out = buildHermesPreview({
      runtime: "Hermes",
      agentName: "apollo",
      llmSource: "perkos",
      perkosAgentId: "ag_xyz",
    });
    expect(out).toContain("api.llm.perkos.xyz/v1");
    expect(out).toContain("name: openai");
    expect(out).toContain("PERKOS_AGENT_ID: ag_xyz");
  });

  it("renders a custom-provider block (chat_completions) with default model when byok+openai", () => {
    const out = buildHermesPreview({
      runtime: "Hermes",
      agentName: "a",
      llmSource: "byok",
      byokProvider: "openai",
    });
    // BYOK pins provider:custom + api_mode:chat_completions + inline api_key
    // (the documented OpenAI-compatible BYOK shape — see project_byok_openai_runtime_config).
    expect(out).toContain("provider: custom");
    expect(out).toContain("api_mode: chat_completions");
    expect(out).toContain("base_url: https://api.openai.com/v1");
    expect(out).toContain("default: gpt-4o-mini");
  });

  it("supports ollama as a byok provider for Hermes (not for OpenClaw)", () => {
    const out = buildHermesPreview({
      runtime: "Hermes",
      agentName: "a",
      llmSource: "byok",
      byokProvider: "ollama",
    });
    expect(out).toContain("provider: custom");
    expect(out).toContain("base_url: http://127.0.0.1:11434/v1");
    expect(out).toContain("default: qwen2.5:7b");
  });
});

describe("buildConfigPreview", () => {
  it("returns JSONC + ~/.openclaw path for OpenClaw runtime", () => {
    const out = buildConfigPreview({
      runtime: "OpenClaw",
      agentName: "apollo",
      llmSource: "perkos",
    });
    expect(out.language).toBe("jsonc");
    expect(out.configPath).toBe("~/.openclaw/openclaw.json");
  });

  it("returns YAML + per-profile path for Hermes runtime", () => {
    const out = buildConfigPreview({
      runtime: "Hermes",
      agentName: "apollo",
      llmSource: "perkos",
    });
    expect(out.language).toBe("yaml");
    expect(out.configPath).toBe("~/.hermes/profiles/apollo/config.yaml");
  });
});

describe("byokProviderOptions", () => {
  it("offers the OpenAI-compatible cloud providers for OpenClaw (no anthropic-direct)", () => {
    // anthropic-direct is intentionally NOT offered: its native API is
    // /v1/messages, not /chat/completions. Claude is reachable via OpenRouter.
    const opts = byokProviderOptions("OpenClaw");
    expect(opts.map((o) => o.id).sort()).toEqual(["openai", "openrouter"]);
  });

  it("offers cloud providers + local Ollama for Hermes", () => {
    const opts = byokProviderOptions("Hermes");
    expect(opts.map((o) => o.id).sort()).toEqual([
      "ollama",
      "openai",
      "openrouter",
    ]);
  });
});
