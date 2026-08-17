import { describe, expect, it } from "vitest";
import { isSpeechVoice, SPEECH_VOICES } from "../app/lib/perkosApi";
import type { SpeechVoice } from "../app/lib/perkosApi";
import {
  speechVoiceChipLabel,
  speechVoiceLean,
  speechVoiceOptionLabel,
} from "../app/lib/speechVoiceLabels";

describe("spoken voice settings", () => {
  it("keeps TTS voices explicit and rejects persona or arbitrary values", () => {
    expect(SPEECH_VOICES).toContain("alloy");
    expect(SPEECH_VOICES).toContain("nova");
    expect(isSpeechVoice("shimmer")).toBe(true);
    expect(isSpeechVoice("warm and concise")).toBe(false);
    expect(isSpeechVoice({ voice: "nova" })).toBe(false);
  });

  it("labels feminine/masculine lean for owner selection without inventing gender truth", () => {
    expect(speechVoiceLean("nova")).toBe("feminine");
    expect(speechVoiceLean("onyx")).toBe("masculine");
    expect(speechVoiceLean("alloy")).toBe("neutral");
    expect(speechVoiceOptionLabel("nova")).toMatch(/feminine-leaning/);
    expect(speechVoiceOptionLabel("onyx")).toMatch(/masculine-leaning/);
    expect(speechVoiceChipLabel("nova")).toBe("nova · feminine");
    // Cast on purpose: the point of this assertion is the RUNTIME guard, which
    // exists because voices arrive from Firestore and the API, where the type
    // is not enforced. shared-types narrowed SpeechVoice from a string to a
    // strict union, so the invalid value now has to be cast in to reach it.
    expect(speechVoiceChipLabel("not-a-voice" as SpeechVoice)).toBeNull();
  });
});
