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

  it("renders an anthropic block for byok with anthropic provider", () => {
    const out = buildOpenClawPreview({
      runtime: "OpenClaw",
      agentName: "a",
      llmSource: "byok",
      byokProvider: "anthropic",
    });
    expect(out).toContain('"anthropic"');
    expect(out).toContain("$ANTHROPIC_API_KEY");
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
    expect(out).toContain('"defaultModel": "gpt-4o"');
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

  it("renders an openai block with default model when byok+openai", () => {
    const out = buildHermesPreview({
      runtime: "Hermes",
      agentName: "a",
      llmSource: "byok",
      byokProvider: "openai",
    });
    expect(out).toContain("name: openai");
    expect(out).toContain("api_key_env: OPENAI_API_KEY");
    expect(out).toContain("default: gpt-4o-mini");
  });

  it("supports ollama as a byok provider for Hermes (not for OpenClaw)", () => {
    const out = buildHermesPreview({
      runtime: "Hermes",
      agentName: "a",
      llmSource: "byok",
      byokProvider: "ollama",
    });
    expect(out).toContain("name: ollama");
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
  it("offers 3 cloud providers for OpenClaw", () => {
    const opts = byokProviderOptions("OpenClaw");
    expect(opts.map((o) => o.id).sort()).toEqual([
      "anthropic",
      "openai",
      "openrouter",
    ]);
  });

  it("offers cloud providers + local Ollama for Hermes", () => {
    const opts = byokProviderOptions("Hermes");
    expect(opts.map((o) => o.id)).toContain("ollama");
    expect(opts.length).toBeGreaterThan(3);
  });
});
