import { normalizeWalletAddress } from "@perkos/shared-types";

import type { ChatIdentity } from "./chatClient";

/**
 * Who receives a project-conversation message. An @-mention goes straight to
 * those teammates. Anything else is for Sparky: addressed to the owner alone,
 * PerkOS-Chat only stores it for the conversation, so no teammate treats it as
 * a message to answer. A shared-project member falls back to the whole
 * conversation, since only the owner is sure to be a participant.
 */
export function conversationTargets(input: {
  mentions: ChatIdentity[];
  address?: string | null;
  shared: boolean;
}): ChatIdentity[] | undefined {
  if (input.mentions.length > 0) return input.mentions;
  if (input.shared || !input.address) return undefined;
  return [`user:${normalizeWalletAddress(input.address)}` as ChatIdentity];
}
