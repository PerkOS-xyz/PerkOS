/** Build-time opt-in; next.config only permits this for the Dev environment. */
export function isVoiceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PERKOS_VOICE_ENABLED === "true";
}
