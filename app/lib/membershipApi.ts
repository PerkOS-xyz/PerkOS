"use client";

/**
 * Membership API client — invites/removes members on orgs + projects via
 * PerkOS-API (server-side, Admin SDK). A wallet can't write under another
 * wallet's subtree from the client, so all sharing goes through the server.
 */
import { authedFetch } from "./apiClient";

export type MemberRole = "owner" | "editor" | "viewer";

export type Member = {
  wallet: string;
  role: string;
  status: string;
};

async function jsonOrThrow(res: Response, fallback: string) {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? fallback);
  }
  return res.json();
}

// ── Organization members ──────────────────────────────────────────────
export async function inviteOrgMember(input: {
  orgId: string;
  memberWallet: string;
  role?: "editor" | "viewer";
}): Promise<void> {
  const res = await authedFetch(`/orgs/${input.orgId}/members`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      memberWallet: input.memberWallet,
      role: input.role ?? "editor",
    }),
  });
  await jsonOrThrow(res, "Failed to invite member");
}

export async function listOrgMembers(orgId: string): Promise<Member[]> {
  const res = await authedFetch(`/orgs/${orgId}/members`);
  const data = (await jsonOrThrow(res, "Failed to load members")) as {
    members?: Member[];
  };
  return data.members ?? [];
}

export async function removeOrgMember(input: {
  orgId: string;
  memberWallet: string;
}): Promise<void> {
  const res = await authedFetch(
    `/orgs/${input.orgId}/members/${input.memberWallet}`,
    { method: "DELETE" }
  );
  await jsonOrThrow(res, "Failed to remove member");
}

// ── Project members ───────────────────────────────────────────────────
export async function inviteProjectMember(input: {
  projectId: string;
  memberWallet: string;
  role?: "editor" | "viewer";
}): Promise<void> {
  const res = await authedFetch(`/projects/${input.projectId}/members`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      memberWallet: input.memberWallet,
      role: input.role ?? "editor",
    }),
  });
  await jsonOrThrow(res, "Failed to invite member");
}

export async function listProjectMembers(
  projectId: string
): Promise<Member[]> {
  const res = await authedFetch(`/projects/${projectId}/members`);
  const data = (await jsonOrThrow(res, "Failed to load members")) as {
    members?: Member[];
  };
  return data.members ?? [];
}

export async function removeProjectMember(input: {
  projectId: string;
  memberWallet: string;
}): Promise<void> {
  const res = await authedFetch(
    `/projects/${input.projectId}/members/${input.memberWallet}`,
    { method: "DELETE" }
  );
  await jsonOrThrow(res, "Failed to remove member");
}
