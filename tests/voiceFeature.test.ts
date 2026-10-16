import { afterEach, describe, expect, it, vi } from "vitest";
import { areAgentVoiceCallsEnabled } from "../app/lib/voiceFeature";
import config from "../next.config";

afterEach(() => vi.unstubAllEnvs());
describe("Legacy agent voice calls are isolated from Sparky voice", () => {
  it("defaults off in the production build configuration", () => {
    expect(config.env?.NEXT_PUBLIC_PERKOS_AGENT_VOICE_CALLS_ENABLED).toBe("false");
  });
  it.each([undefined, "false", "1", "TRUE", ""])('rejects flag %s', (flag) => {
    vi.stubEnv("NEXT_PUBLIC_PERKOS_AGENT_VOICE_CALLS_ENABLED", flag);
    expect(areAgentVoiceCallsEnabled()).toBe(false);
  });
  it("requires explicit true", () => {
    vi.stubEnv("NEXT_PUBLIC_PERKOS_AGENT_VOICE_CALLS_ENABLED", "true");
    expect(areAgentVoiceCallsEnabled()).toBe(true);
  });
});
