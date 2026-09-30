"use client";

import { normalizeWalletAddress } from "@perkos/shared-types";

import { useQuery } from "@tanstack/react-query";
import { useAppAccount } from "./useAppAccount";

import { listProjectMembers } from "./membershipApi";
import { getUserProfiles, type ProjectDetail } from "./perkosApi";
import { formatAddress } from "./format";
import type { MentionParticipant } from "./mentions";

/**
 * The @-mention participant list for a project's chats: human members (the
 * owner + invited teammates, labeled by their username when set, else short
 * address) + the project's agents (by name). Identities are collision-free
 * (`user:0x…` / `agent:Name`). Shared by the project chat + per-doc chat.
 */
export function useMentionParticipants(
  detail: ProjectDetail | null | undefined,
  projectId: string,
  ownerWallet?: string,
): MentionParticipant[] {
  const { address } = useAppAccount();

  const { data: members } = useQuery({
    queryKey: ["project-members", projectId, ownerWallet, address ? normalizeWalletAddress(address) : null],
    queryFn: () => listProjectMembers(projectId, ownerWallet),
    enabled: Boolean(projectId && address),
  });

  const memberWallets = (members ?? []).map((m) => normalizeWalletAddress(m.wallet));
  // Always include the connected wallet (in case the members list is empty/loading).
  const humanWallets = Array.from(
    new Set([...(address ? [normalizeWalletAddress(address)] : []), ...memberWallets])
  );

  const { data: profiles } = useQuery({
    queryKey: ["user-profiles", humanWallets.join(",")],
    queryFn: () => getUserProfiles(humanWallets),
    enabled: humanWallets.length > 0,
  });

  const out: MentionParticipant[] = [];
  const seen = new Set<string>();
  for (const w of humanWallets) {
    const id = `user:${w}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      label: profiles?.[w]?.username || formatAddress(w),
      kind: "human",
    });
  }

  if (detail) {
    // The project roster is authoritative. Historical tasks may still refer
    // to a removed agent, but that does not make it a current chat member.
    for (const name of new Set(detail.project.agentIds ?? [])) {
      out.push({ id: `agent:${name}`, label: name, kind: "agent" });
    }
  }

  return out;
}
