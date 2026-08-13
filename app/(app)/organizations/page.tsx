"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppAccount } from "../../lib/useAppAccount";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Building2, Check, Pencil, Plus, Users } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatAddress } from "../../lib/format";
import { useActiveOrg } from "../../lib/useActiveOrg";
import { getWalletProjects, updateOrgName } from "../../lib/perkosApi";

export default function OrganizationsPage() {
  const { t } = useTranslation();
  const { address } = useAppAccount();
  const {
    orgs,
    activeOrgId,
    defaultOrgId,
    setActiveOrgId,
    refresh,
    loading,
  } = useActiveOrg();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  // All projects once, grouped by org for the per-org count.
  const projectsQuery = useQuery({
    queryKey: ["wallet-projects-all", address],
    queryFn: () => getWalletProjects(address!),
    enabled: Boolean(address),
  });
  const countFor = (orgId: string) =>
    (projectsQuery.data?.projects ?? []).filter(
      (p) => (p.orgId ?? defaultOrgId) === orgId
    ).length;

  const renameMut = useMutation({
    mutationFn: (orgId: string) =>
      updateOrgName({ walletAddress: address!, orgId, name: draftName.trim() }),
    onSuccess: async () => {
      await refresh();
      setEditingId(null);
      toast.success(t("organizations.toast.renamed"));
    },
    onError: (e: Error) =>
      toast.error(t("organizations.toast.renameFailed"), { description: e.message }),
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium text-foreground">{t("organizations.header.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("organizations.header.subtitle")}
          </p>
        </div>
        <Link
          href="/organizations/new"
          className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
        >
          <Plus className="h-3.5 w-3.5" />
          {t("organizations.header.newOrg")}
        </Link>
      </header>

      {loading && orgs.length === 0 ? (
        <div className="h-32 animate-pulse rounded-md border border-border bg-card" />
      ) : (
        <ul className="flex flex-col gap-3">
          {orgs.map((o) => {
            const isActive = o.id === activeOrgId;
            const editing = editingId === o.id;
            return (
              <li
                key={o.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-4 py-3",
                  isActive ? "border-primary/50" : "border-border"
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                    <Building2 className="h-4 w-4" />
                  </span>
                  {editing ? (
                    <form
                      className="flex flex-wrap items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (draftName.trim() && o.id) renameMut.mutate(o.id);
                      }}
                    >
                      <Input
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        className="h-8 min-w-0 flex-1 text-sm"
                        maxLength={60}
                      />
                      <Button
                        type="submit"
                        size="xs"
                        disabled={renameMut.isPending || !draftName.trim()}
                      >
                        {t("organizations.rename.save")}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        {t("organizations.rename.cancel")}
                      </Button>
                    </form>
                  ) : (
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                        {o.name}
                        {o.isDefault ? (
                          <span className="rounded border border-border px-1 text-[9px] uppercase text-muted-foreground">
                            {t("organizations.card.default")}
                          </span>
                        ) : null}
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            <Check className="h-3 w-3" /> {t("organizations.card.active")}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("organizations.card.projectCount", { count: countFor(o.id ?? "") })}
                        {address ? t("organizations.card.ownerSuffix", { address: formatAddress(address) }) : ""}
                      </span>
                    </div>
                  )}
                </div>

                {!editing ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {!isActive ? (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => o.id && setActiveOrgId(o.id)}
                      >
                        {t("organizations.card.setActive")}
                      </Button>
                    ) : null}
                    <Link
                      href={`/organizations/${o.id}/settings`}
                      className={cn(
                        buttonVariants({ size: "xs", variant: "ghost" }),
                        "gap-1.5 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Users className="h-3.5 w-3.5" />
                      {t("organizations.card.members")}
                    </Link>
                    {!o.shared ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        className="gap-1.5 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditingId(o.id ?? null);
                          setDraftName(o.name);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {t("organizations.card.rename")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
