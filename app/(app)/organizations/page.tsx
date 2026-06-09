"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useConnection } from "wagmi";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Check, Pencil, Plus } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatAddress } from "../../lib/format";
import { useActiveOrg } from "../../lib/useActiveOrg";
import { getWalletProjects, updateOrgName } from "../../lib/perkosApi";

export default function OrganizationsPage() {
  const { address } = useConnection();
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
      toast.success("Organization renamed");
    },
    onError: (e: Error) =>
      toast.error("Couldn't rename", { description: e.message }),
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium text-foreground">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Group your projects and the agents that work on them. Switch the
            active organization from the header.
          </p>
        </div>
        <Link
          href="/organizations/new"
          className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
        >
          <Plus className="h-3.5 w-3.5" />
          New organization
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
                      className="flex items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (draftName.trim() && o.id) renameMut.mutate(o.id);
                      }}
                    >
                      <Input
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        className="h-8 w-48 text-sm"
                        maxLength={60}
                      />
                      <Button
                        type="submit"
                        size="xs"
                        disabled={renameMut.isPending || !draftName.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                        {o.name}
                        {o.isDefault ? (
                          <span className="rounded border border-border px-1 text-[9px] uppercase text-muted-foreground">
                            default
                          </span>
                        ) : null}
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            <Check className="h-3 w-3" /> active
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {countFor(o.id ?? "")}{" "}
                        {countFor(o.id ?? "") === 1 ? "project" : "projects"}
                        {address ? ` · owner ${formatAddress(address)}` : ""}
                      </span>
                    </div>
                  )}
                </div>

                {!editing ? (
                  <div className="flex items-center gap-2">
                    {!isActive ? (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => o.id && setActiveOrgId(o.id)}
                      >
                        Set active
                      </Button>
                    ) : null}
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
                      Rename
                    </Button>
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
