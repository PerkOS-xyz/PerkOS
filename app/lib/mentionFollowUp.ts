/**
 * What to do for @-mentioned agents after PerkOS-Chat acknowledges a send.
 * Held for an offline agent (`queued`): only wake it, the held message reaches
 * it on connect and resending through A2A would make it answer twice. Nobody
 * received it and nothing was held: wake and deliver through A2A.
 */
export function mentionFollowUp(
  ack: { delivered: number; queued: number },
  mentions: string[],
): { wake: string[]; resend: string[] } {
  const agents = mentions
    .filter((identity) => identity.startsWith("agent:"))
    .map((identity) => identity.slice("agent:".length));
  if (ack.queued > 0) return { wake: agents, resend: [] };
  if (ack.delivered === 0) return { wake: [], resend: agents };
  return { wake: [], resend: [] };
}
