/** Build-time rollout gate. Keep off until API, storage and Chat are ready. */
export function solanaLoginEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SOLANA_LOGIN_ENABLED === "true";
}
