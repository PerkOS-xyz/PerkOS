/**
 * @-mention helpers shared by the project chat + per-doc chat.
 *
 * A mention's stored identity is STRUCTURED and already unique —
 * `user:0x…` (a wallet) for humans, `agent:Name` for agents — so two
 * participants can never collide. The `label` is only what the user sees /
 * types after `@` (a chosen username, or a short address, or an agent name).
 */

export type MentionParticipant = {
  /** Stable identity stored in message.mentions[]: "user:0x…" | "agent:Name". */
  id: string;
  /** Human-readable handle typed after `@` (username / 0x…abcd / AgentName). */
  label: string;
  kind: "human" | "agent";
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract the structured mention identities present in `text`, by matching
 * `@<label>` against the known participants (case-insensitive, bounded by
 * start/space and end/space/punctuation). Returns unique ids in first-seen
 * order. Typing `@Name` works without an autocomplete picker.
 */
export function extractMentions(
  text: string,
  participants: MentionParticipant[]
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const p of participants) {
    if (!p.label) continue;
    const re = new RegExp(
      `(^|\\s)@${escapeRegExp(p.label)}(?=$|\\s|[.,!?;:])`,
      "i"
    );
    if (re.test(text) && !seen.has(p.id)) {
      seen.add(p.id);
      ids.push(p.id);
    }
  }
  return ids;
}

/** Does `mentions` include the given wallet (as a "user:" identity)? */
export function mentionsWallet(
  mentions: string[] | undefined,
  wallet: string | null | undefined
): boolean {
  if (!mentions || !wallet) return false;
  const w = wallet.toLowerCase();
  return mentions.some((m) => m.toLowerCase() === `user:${w}`);
}

/**
 * Split a message into plain-text + mention chip segments for rendering.
 * Matches `@<label>` for each known participant; everything else is text.
 */
export type MentionSegment =
  | { type: "text"; value: string }
  | { type: "mention"; label: string; participant: MentionParticipant };

export function segmentMentions(
  text: string,
  participants: MentionParticipant[]
): MentionSegment[] {
  if (!participants.length || !text.includes("@")) {
    return [{ type: "text", value: text }];
  }
  // Longest labels first so "@alice-bot" wins over "@alice".
  const ordered = [...participants].sort(
    (a, b) => b.label.length - a.label.length
  );
  const alt = ordered.map((p) => escapeRegExp(p.label)).join("|");
  const re = new RegExp(`(^|\\s)@(${alt})(?=$|\\s|[.,!?;:])`, "gi");
  const segs: MentionSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const lead = m[1] ?? "";
    const labelText = m[2] ?? "";
    const start = m.index + lead.length; // position of "@"
    if (start > last) segs.push({ type: "text", value: text.slice(last, start) });
    const p =
      ordered.find((x) => x.label.toLowerCase() === labelText.toLowerCase()) ??
      ordered[0]!;
    segs.push({ type: "mention", label: labelText, participant: p });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ type: "text", value: text.slice(last) });
  return segs.length ? segs : [{ type: "text", value: text }];
}
