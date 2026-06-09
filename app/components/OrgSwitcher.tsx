"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useConnection } from "wagmi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Check,
  ChevronsUpDown,
  FolderKanban,
  Pencil,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

import { useActiveOrg } from "../lib/useActiveOrg";
import { getOrgProjects, updateOrgName } from "../lib/perkosApi";

/** Header org chip: shows the active org, switches between orgs, renames it,
 *  and links to create / manage organizations. */
export function OrgSwitcher() {
  const { address } = useConnection();
  const qc = useQueryClient();
  const {
    orgs,
    activeOrg,
    activeOrgId,
    setActiveOrgId,
    refresh,
    loading,
  } = useActiveOrg();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!renaming) setName(activeOrg?.name ?? "");
  }, [activeOrg?.name, renaming]);

  const renameMut = useMutation({
    mutationFn: () =>
      updateOrgName({
        walletAddress: address!,
        orgId: activeOrgId!,
        name: name.trim(),
      }),
    onSuccess: async () => {
      await refresh();
      setRenaming(false);
      toast.success("Organization renamed");
    },
    onError: (e: Error) =>
      toast.error("Couldn't rename", { description: e.message }),
  });

  const label = loading ? "…" : activeOrg?.name ?? "Organization";

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setRenaming(false); }}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label="Switch organization"
            className="max-w-[180px] gap-2 px-2 hover:bg-muted/40"
          />
        }
      >
        <Building2 className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate text-sm text-foreground">{label}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 border-border bg-card p-2">
        <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Organizations
        </p>

        {renaming ? (
          <form
            className="flex items-center gap-1 px-1 py-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() && activeOrgId) renameMut.mutate();
            }}
          >
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-sm"
              maxLength={60}
            />
            <Button
              type="submit"
              size="xs"
              disabled={renameMut.isPending || !name.trim()}
            >
              Save
            </Button>
          </form>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {orgs.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (o.id) setActiveOrgId(o.id);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted/40"
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{o.name}</span>
                  {o.isDefault ? (
                    <span className="rounded border border-border px-1 text-[9px] uppercase text-muted-foreground">
                      default
                    </span>
                  ) : null}
                  {o.id === activeOrgId ? (
                    <Check className="ml-auto h-3.5 w-3.5 text-primary" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}

        <Separator className="my-1 bg-border" />

        {!renaming && activeOrgId ? (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted/40"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            Rename “{activeOrg?.name}”
          </button>
        ) : null}

        <Link
          href="/organizations/new"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted/40"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          Create organization
        </Link>
        <Link
          href="/organizations"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted/40"
        >
          <Building2 className="h-3.5 w-3.5" />
          Manage organizations
        </Link>
      </PopoverContent>
    </Popover>
  );
}

/** Header project picker: lists the projects in the ACTIVE org and jumps to
 *  the one you want to work on. */
export function ProjectPicker() {
  const { address } = useConnection();
  const router = useRouter();
  const { activeOrg, activeOrgId, defaultOrgId } = useActiveOrg();
  const [open, setOpen] = useState(false);

  const projectsQuery = useQuery({
    queryKey: ["wallet-projects", address, activeOrgId],
    queryFn: () =>
      getOrgProjects({
        org: activeOrg!,
        myWallet: address!,
        defaultOrgId: defaultOrgId ?? undefined,
      }),
    enabled: Boolean(address) && Boolean(activeOrg),
  });
  const projects = projectsQuery.data ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label="Pick a project"
            className="max-w-[180px] gap-2 px-2 hover:bg-muted/40"
          />
        }
      >
        <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm text-foreground">Projects</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 border-border bg-card p-2">
        <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Projects in this org
        </p>
        {projects.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            {projectsQuery.isLoading ? "Loading…" : "No projects yet."}
          </p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    const ownerQ =
                      activeOrg?.shared && activeOrg.ownerWallet
                        ? `?owner=${activeOrg.ownerWallet}`
                        : "";
                    router.push(`/projects/${p.id}${ownerQ}`);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted/40"
                >
                  <FolderKanban className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {p.tasks} {p.tasks === 1 ? "task" : "tasks"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Separator className="my-1 bg-border" />
        <Link
          href="/projects"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted/40"
        >
          <FolderKanban className="h-3.5 w-3.5" />
          All projects
        </Link>
        <Link
          href="/projects/new"
          onClick={() => setOpen(false)}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted/40"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          New project
        </Link>
      </PopoverContent>
    </Popover>
  );
}
