import { afterEach, describe, expect, it, vi } from "vitest";
import { isVoiceEnabled } from "../app/lib/voiceFeature";
import config from "../next.config";

afterEach(() => vi.unstubAllEnvs());
describe("Voice is opt-in", () => {
  it("defaults off in the production build configuration", () => {
    expect(config.env?.NEXT_PUBLIC_PERKOS_VOICE_ENABLED).toBe("false");
  });
  it.each([undefined, "false", "1", "TRUE", ""])('rejects flag %s', (flag) => {
    vi.stubEnv("NEXT_PUBLIC_PERKOS_VOICE_ENABLED", flag);
    expect(isVoiceEnabled()).toBe(false);
  });
  it("requires explicit true", () => {
    vi.stubEnv("NEXT_PUBLIC_PERKOS_VOICE_ENABLED", "true");
    expect(isVoiceEnabled()).toBe(true);
  });
});
