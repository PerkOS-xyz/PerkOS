import { describe, expect, it } from "vitest";
import { summarizeVoiceHealthCodes } from "../app/lib/agentVoiceHealth";

describe("agentVoiceHealth", () => {
  it("summarizes empty and non-empty code lists", () => {
    expect(summarizeVoiceHealthCodes([])).toBe("No issues reported");
    expect(summarizeVoiceHealthCodes(["runtime_not_ready", "speech_unavailable"])).toBe(
      "runtime_not_ready, speech_unavailable",
    );
  });
});
