import { describe, expect, it } from "vitest";
import { isSpeechVoice, SPEECH_VOICES } from "../app/lib/perkosApi";

describe("spoken voice settings", () => {
  it("keeps TTS voices explicit and rejects persona or arbitrary values", () => {
    expect(SPEECH_VOICES).toContain("alloy");
    expect(SPEECH_VOICES).toContain("nova");
    expect(isSpeechVoice("shimmer")).toBe(true);
    expect(isSpeechVoice("warm and concise")).toBe(false);
    expect(isSpeechVoice({ voice: "nova" })).toBe(false);
  });
});
