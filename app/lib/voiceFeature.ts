/**
 * Legacy agent-call surface. This is unrelated to Sparky's browser-native
 * speech input/output and remains disabled in production.
 */
export function areAgentVoiceCallsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PERKOS_AGENT_VOICE_CALLS_ENABLED === "true";
}
