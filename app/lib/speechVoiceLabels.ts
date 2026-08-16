import type { SpeechVoice } from "./perkosApi";
import { SPEECH_VOICES } from "./perkosApi";

/** Presentation-only lean. OpenAI voices are not legally gendered; labels help owners pick. */
export type SpeechVoiceLean = "feminine" | "masculine" | "neutral";

export const SPEECH_VOICE_LEAN: Record<SpeechVoice, SpeechVoiceLean> = {
  alloy: "neutral",
  ash: "masculine",
  ballad: "neutral",
  coral: "feminine",
  echo: "masculine",
  fable: "neutral",
  onyx: "masculine",
  nova: "feminine",
  sage: "neutral",
  shimmer: "feminine",
  verse: "neutral",
  marin: "feminine",
  cedar: "masculine",
};

const LEAN_LABEL: Record<SpeechVoiceLean, string> = {
  feminine: "feminine-leaning",
  masculine: "masculine-leaning",
  neutral: "neutral",
};

const STYLE_LABEL: Record<SpeechVoice, string> = {
  alloy: "balanced",
  ash: "clear",
  ballad: "expressive",
  coral: "warm",
  echo: "steady",
  fable: "narrative",
  onyx: "deep",
  nova: "bright",
  sage: "calm",
  shimmer: "light",
  verse: "dynamic",
  marin: "natural",
  cedar: "grounded",
};

export function speechVoiceLean(voice: SpeechVoice): SpeechVoiceLean {
  return SPEECH_VOICE_LEAN[voice] ?? "neutral";
}

/** e.g. "Nova — bright · feminine-leaning" */
export function speechVoiceOptionLabel(voice: SpeechVoice): string {
  return `${voice[0].toUpperCase()}${voice.slice(1)} — ${STYLE_LABEL[voice]} · ${LEAN_LABEL[speechVoiceLean(voice)]}`;
}

/** Compact chip for call UI, e.g. "nova · feminine" */
export function speechVoiceChipLabel(voice: SpeechVoice | null | undefined): string | null {
  if (!voice || !(SPEECH_VOICES as readonly string[]).includes(voice)) return null;
  const lean = speechVoiceLean(voice);
  const short = lean === "feminine" ? "feminine" : lean === "masculine" ? "masculine" : "neutral";
  return `${voice} · ${short}`;
}
