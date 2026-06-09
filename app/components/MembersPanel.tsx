"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAddress } from "../lib/format";
import {
  inviteOrgMember,
  inviteProjectMember,
  listOrgMembers,
  listProjectMembers,
  removeOrgMember,
  removeProjectMember,
  type Member,
} from "../lib/membershipApi";

type Kind = "org" | "project";

/**
 * Reusable members panel for an org or a project: lists members + their roles,
 * lets the owner invite a wallet (editor/viewer) and remove members. All
 * mutations go through PerkOS-API (server-side, Admin SDK).
 */
export function MembersPanel({
  kind,
  id,
  canManage = true,
}: {
  kind: Kind;
  id: string;
  canManage?: boolean;
}) {
  const qc = useQueryClient();
  const key = ["members", kind, id];
  const [wallet, setWallet] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");

  const membersQuery = useQuery({
    queryKey: key,
    queryFn: () =>
      kind === "org" ? listOrgMembers(id) : listProjectMembers(id),
    enabled: Boolean(id),
  });
  const members: Member[] = membersQuery.data ?? [];

  const isWallet = /^0x[a-fA-F0-9]{40}$/.test(wallet.trim());

  const inviteMut = useMutation({
    mutationFn: () =>
      kind === "org"
        ? inviteOrgMember({ orgId: id, memberWallet: wallet.trim(), role })
        : inviteProjectMember({
            projectId: id,
            memberWallet: wallet.trim(),
            role,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      setWallet("");
      toast.success("Member invited", {
        description: `${formatAddress(wallet.trim())} can now access this ${kind}.`,
      });
    },
    onError: (e: Error) =>
      toast.error("Couldn't invite member", { description: e.message }),
  });

  const removeMut = useMutation({
    mutationFn: (memberWallet: string) =>
      kind === "org"
        ? removeOrgMember({ orgId: id, memberWallet })
        : removeProjectMember({ projectId: id, memberWallet }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Member removed");
    },
    onError: (e: Error) =>
      toast.error("Couldn't remove member", { description: e.message }),
  });

  function onInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isWallet && !inviteMut.isPending) inviteMut.mutate();
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <form onSubmit={onInvite} className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            Invite a wallet to this {kind}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x… wallet address"
              className="h-9 min-w-0 flex-1 font-mono text-xs"
            />
            <div className="flex shrink-0 items-center gap-2">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
                className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <Button
                type="submit"
                size="sm"
                className="gap-1.5"
                disabled={!isWallet || inviteMut.isPending}
              >
                <UserPlus className="h-3.5 w-3.5" />
                {inviteMut.isPending ? "Inviting…" : "Invite"}
              </Button>
            </div>
          </div>
          {wallet.trim() && !isWallet ? (
            <p className="text-xs text-destructive">
              Enter a valid 0x… wallet address (40 hex chars).
            </p>
          ) : null}
        </form>
      ) : null}

      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
        {members.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            {membersQuery.isLoading ? "Loading members…" : "No members yet."}
          </li>
        ) : (
          members.map((m) => (
            <li
              key={m.wallet}
              className="flex items-center justify-between gap-2 px-4 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
                  {m.wallet.slice(2, 4).toUpperCase()}
                </span>
                <span
                  className="truncate font-mono text-xs text-foreground"
                  title={m.wallet}
                >
                  {formatAddress(m.wallet)}
                </span>
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {m.role}
                </span>
              </div>
              {canManage && m.role !== "owner" ? (
                <button
                  type="button"
                  onClick={() => removeMut.mutate(m.wallet)}
                  disabled={removeMut.isPending}
                  aria-label={`Remove ${m.wallet}`}
                  title="Remove member"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
