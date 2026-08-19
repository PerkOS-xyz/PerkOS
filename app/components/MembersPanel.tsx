"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAddress } from "../lib/format";
import { effectiveAvatarUrl, getUsernameOwner, getUserProfiles } from "../lib/perkosApi";
import { useAdvancedFeatures } from "../lib/advancedFeatures";
import { useAppAccount } from "../lib/useAppAccount";
import { UserAvatar } from "./UserAvatar";
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
  const { t } = useTranslation();
  const account = useAppAccount();
  const advanced = useAdvancedFeatures(account.address);
  const qc = useQueryClient();
  const key = ["members", kind, id];
  const [wallet, setWallet] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");

  const kindLabel =
    kind === "org"
      ? t("components.members.kindOrg")
      : t("components.members.kindProject");

  const membersQuery = useQuery({
    queryKey: key,
    queryFn: () =>
      kind === "org" ? listOrgMembers(id) : listProjectMembers(id),
    enabled: Boolean(id),
  });
  const members: Member[] = membersQuery.data ?? [];

  // Avatars/usernames for the listed members (one batched read, shared cache).
  const memberWallets = members.map((m) => m.wallet.toLowerCase());
  const profilesQuery = useQuery({
    queryKey: ["user-profiles", memberWallets.join(",")],
    queryFn: () => getUserProfiles(memberWallets),
    enabled: memberWallets.length > 0,
    staleTime: 60_000,
  });

  // Invitar acepta una address 0x… o un @username. Pedir siempre una address
  // convertía "sumar a alguien al equipo" en una operación técnica: el invitado
  // tenía que activar el modo avanzado solo para poder leer la suya y pasarla.
  const identifier = wallet.trim();
  const isWallet = /^0x[a-fA-F0-9]{40}$/.test(identifier);
  const isUsername = /^@?[a-z0-9_]{3,20}$/i.test(identifier) && !identifier.startsWith("0x");
  const canInvite = isWallet || isUsername;

  const inviteMut = useMutation({
    mutationFn: async () => {
      let memberWallet = identifier;
      if (!isWallet) {
        const owner = await getUsernameOwner(identifier.replace(/^@/, ""));
        if (!owner) throw new Error(t("components.members.unknownUsername"));
        memberWallet = owner;
      }
      return kind === "org"
        ? inviteOrgMember({ orgId: id, memberWallet, role })
        : inviteProjectMember({ projectId: id, memberWallet, role });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      setWallet("");
      toast.success(t("components.members.memberInvited"), {
        description: t("components.members.memberInvitedDesc", {
          address: isWallet ? formatAddress(identifier) : identifier,
          kind: kindLabel,
        }),
      });
    },
    onError: (e: Error) =>
      toast.error(t("components.members.inviteFailed"), {
        description: e.message,
      }),
  });

  const removeMut = useMutation({
    mutationFn: (memberWallet: string) =>
      kind === "org"
        ? removeOrgMember({ orgId: id, memberWallet })
        : removeProjectMember({ projectId: id, memberWallet }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success(t("components.members.memberRemoved"));
    },
    onError: (e: Error) =>
      toast.error(t("components.members.removeFailed"), {
        description: e.message,
      }),
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
            {t("components.members.inviteLabel", { kind: kindLabel })}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder={t("components.members.walletPlaceholder")}
              className="h-9 min-w-0 flex-1 font-mono text-xs"
            />
            <div className="flex shrink-0 items-center gap-2">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
                className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground"
              >
                <option value="editor">
                  {t("components.members.roleEditor")}
                </option>
                <option value="viewer">
                  {t("components.members.roleViewer")}
                </option>
              </select>
              <Button
                type="submit"
                size="sm"
                className="gap-1.5"
                disabled={!canInvite || inviteMut.isPending}
              >
                <UserPlus className="h-3.5 w-3.5" />
                {inviteMut.isPending
                  ? t("components.members.inviting")
                  : t("components.members.invite")}
              </Button>
            </div>
          </div>
          {wallet.trim() && !isWallet ? (
            <p className="text-xs text-destructive">
              {t("components.members.invalidWallet")}
            </p>
          ) : null}
        </form>
      ) : null}

      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
        {members.length === 0 ? (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            {membersQuery.isLoading
              ? t("components.members.loadingMembers")
              : t("components.members.noMembers")}
          </li>
        ) : (
          members.map((m, index) => {
            const profile = profilesQuery.data?.[m.wallet.toLowerCase()];
            // Prefer the handle the API resolved: a teammate's own profile is
            // unreadable from here, so `profile` is only ever populated for the
            // caller themselves.
            const handle = m.username ?? profile?.username;
            const memberLabel = handle
              ? `@${handle}`
              : advanced.enabled
                ? formatAddress(m.wallet)
                : t("components.members.teamMember", { number: index + 1 });

            return (
            <li
              key={m.wallet}
              className="flex items-center justify-between gap-2 px-4 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <UserAvatar
                  address={m.wallet}
                  avatarUrl={effectiveAvatarUrl(
                    profile
                  )}
                  size={28}
                  title={memberLabel}
                />
                <span
                  className="truncate text-xs text-foreground"
                  title={memberLabel}
                >
                  {memberLabel}
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
                  aria-label={t("components.members.removeAria", {
                    wallet: memberLabel,
                  })}
                  title={t("components.members.removeTitle")}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
