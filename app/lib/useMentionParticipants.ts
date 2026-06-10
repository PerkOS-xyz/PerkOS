"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";

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
  projectId: string
): MentionParticipant[] {
  const { address } = useConnection();

  const { data: members } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => listProjectMembers(projectId),
    enabled: Boolean(projectId),
  });

  const memberWallets = (members ?? []).map((m) => m.wallet.toLowerCase());
  // Always include the connected wallet (in case the members list is empty/loading).
  const humanWallets = Array.from(
    new Set([...(address ? [address.toLowerCase()] : []), ...memberWallets])
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
    const agents = new Set<string>();
    for (const t of detail.tasks) if (t.agent) agents.add(t.agent);
    for (const a of detail.project.agentIds ?? []) agents.add(a);
    for (const n of agents) out.push({ id: `agent:${n}`, label: n, kind: "agent" });
  }

  return out;
}
