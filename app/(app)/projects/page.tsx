"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { Archive, ArchiveRestore, Folder, Plus, Trash2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  deleteProject,
  getWalletProjects,
  updateProject,
  type Project,
} from "../../lib/perkosApi";
import { useActiveOrg } from "../../lib/useActiveOrg";
import { SearchInput, matchesQuery } from "../../components/SearchInput";
import { EmptyState } from "../../components/EmptyState";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export default function ProjectsPage() {
  const { address } = useConnection();
  const { activeOrgId, defaultOrgId, activeOrg } = useActiveOrg();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const searchParams = useSearchParams();
  // Status filter via ?status=. Currently "active" is the only value the
  // dashboard sends; other values silently pass through.
  const statusFilter = searchParams.get("status");

  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet-projects", address, activeOrgId],
    queryFn: () =>
      getWalletProjects(address!, activeOrgId ?? undefined, defaultOrgId ?? undefined),
    enabled: Boolean(address) && Boolean(activeOrgId),
  });

  const allProjects = data?.projects ?? [];
  const statusFiltered =
    statusFilter === "active"
      ? allProjects.filter((p) => (p.status ?? "").toLowerCase() === "active")
      : allProjects;
  const projects = statusFiltered.filter((p) =>
    matchesQuery(query, [p.name, p.goal, p.status])
  );
  const hasProjects = allProjects.length > 0;
  const noResults = hasProjects && projects.length === 0;

  // Selection is scoped to what's currently visible (filtered).
  const visibleIds = useMemo(
    () => projects.map((p) => p.id).filter((id): id is string => Boolean(id)),
    [projects]
  );
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allChecked =
    visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const someChecked = selectedVisible.length > 0 && !allChecked;

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function toggleAll(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }
  const clear = () => setSelected(new Set());

  const runBulk = async (ids: string[], fn: (id: string) => Promise<unknown>) => {
    const results = await Promise.allSettled(ids.map(fn));
    const failed = results.filter((r) => r.status === "rejected").length;
    return { ok: ids.length - failed, failed };
  };

  const archiveMut = useMutation({
    mutationFn: (status: "Archived" | "Active") =>
      runBulk(selectedVisible, (id) =>
        updateProject({ walletAddress: address!, projectId: id, patch: { status } })
      ),
    onSuccess: ({ ok, failed }, status) => {
      qc.invalidateQueries({ queryKey: ["wallet-projects", address] });
      const verb = status === "Archived" ? "Archived" : "Unarchived";
      if (failed) toast.error(`${verb} ${ok}, ${failed} failed`);
      else toast.success(`${verb} ${ok} project${ok === 1 ? "" : "s"}`);
      clear();
    },
    onError: (e: Error) => toast.error("Bulk update failed", { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: () =>
      runBulk(selectedVisible, (id) =>
        deleteProject({ walletAddress: address!, projectId: id })
      ),
    onSuccess: ({ ok, failed }) => {
      qc.invalidateQueries({ queryKey: ["wallet-projects", address] });
      if (failed) toast.error(`Deleted ${ok}, ${failed} failed`);
      else toast.success(`Deleted ${ok} project${ok === 1 ? "" : "s"}`);
      setConfirmDelete(false);
      clear();
    },
    onError: (e: Error) => {
      toast.error("Bulk delete failed", { description: e.message });
      setConfirmDelete(false);
    },
  });

  const mutating = archiveMut.isPending || deleteMut.isPending;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium text-[#ececff]">Projects</h1>
          <p className="text-sm text-[#7975a8]">
            {hasProjects
              ? `${allProjects.length} project${allProjects.length === 1 ? "" : "s"} in your workspace.`
              : "Create your first project."}
          </p>
        </div>
        <CreateProjectButton />
      </header>

      {hasProjects ? (
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search projects by name, goal, or status…"
        />
      ) : null}

      {statusFilter ? (
        <Link
          href="/projects"
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/15"
          aria-label="Clear status filter"
        >
          status: {statusFilter}
          <X className="h-3 w-3" aria-hidden />
        </Link>
      ) : null}

      {isLoading ? <SkeletonCards /> : null}
      {error ? <ErrorBanner message={(error as Error).message} /> : null}

      {!isLoading && !error && projects.length > 0 ? (
        <div className="flex flex-col gap-3">
          {/* Select-all + bulk actions row */}
          <div className="flex flex-wrap items-center gap-3 px-1">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={allChecked ? true : someChecked ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label="Select all projects"
              />
              Select all
            </label>
            {selectedVisible.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-foreground">
                  {selectedVisible.length} selected
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={mutating}
                  onClick={() => archiveMut.mutate("Archived")}
                >
                  <Archive className="h-3.5 w-3.5" /> Archive
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={mutating}
                  onClick={() => archiveMut.mutate("Active")}
                >
                  <ArchiveRestore className="h-3.5 w-3.5" /> Unarchive
                </Button>
                <Button
                  size="xs"
                  variant="destructive"
                  disabled={mutating}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
                <Button size="xs" variant="ghost" disabled={mutating} onClick={clear}>
                  Clear
                </Button>
              </div>
            ) : null}
          </div>

          <ul className="flex flex-col gap-3">
            {projects.map((p) => (
              <ProjectCard
                key={p.id ?? p.name}
                project={p}
                checked={p.id ? selected.has(p.id) : false}
                onToggle={(on) => p.id && toggle(p.id, on)}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {!isLoading && !error && noResults ? (
        <p className="rounded-md border border-dashed border-[#1b1833] px-6 py-10 text-center text-sm text-[#7975a8]">
          No projects match &quot;{query}&quot;.
        </p>
      ) : null}
      {!isLoading && !error && !hasProjects ? <EmptyHint /> : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${selectedVisible.length} project${selectedVisible.length === 1 ? "" : "s"}?`}
        description="This permanently deletes the selected projects and removes them from your workspace. This can't be undone."
        confirmLabel="Delete"
        destructive
        pending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
      />
    </div>
  );
}

function CreateProjectButton() {
  return (
    <Link
      href="/projects/new"
      className="flex items-center justify-center gap-2 rounded-md bg-[#ec1b69] px-5 py-2.5 text-sm font-medium text-[#ececff] transition-opacity hover:opacity-90"
    >
      <PlusIcon />
      <span>Create project</span>
    </Link>
  );
}

function ProjectCard({
  project,
  checked,
  onToggle,
}: {
  project: Project;
  checked: boolean;
  onToggle: (on: boolean) => void;
}) {
  // Take the first letter of each significant word for the avatar
  // (max 2 chars). "DeFi Research" → "DR", "Welcome to PerkOS" → "WP".
  const initials =
    project.name
      .split(/\s+/)
      .filter((w) => w.length > 1 || /[A-Z]/.test(w))
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || project.name.slice(0, 2).toUpperCase();

  // Stable hue per project so each card has its own avatar tint without
  // needing per-project config. Hashes the id (or name fallback) into 0-360.
  const seed = (project.id ?? project.name)
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue = seed % 360;

  return (
    <li
      className={`flex items-center gap-2 rounded-lg border bg-card/60 pl-3 transition-colors ${
        checked ? "border-primary/60" : "border-primary/25 hover:border-primary/50"
      }`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        aria-label={`Select ${project.name}`}
      />
      <Link
        href={`/projects/${encodeURIComponent(project.id ?? "")}`}
        className="glow-card flex flex-1 items-center gap-3 rounded-lg px-2 py-3"
      >
        {/* Project avatar: tinted circle with initials. Glow halo on hover. */}
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-primary/40 font-mono text-sm font-medium text-foreground transition-shadow"
          style={{
            background: `radial-gradient(circle at 30% 30%, hsla(${hue}, 70%, 60%, 0.35), hsla(${hue}, 70%, 35%, 0.15))`,
            boxShadow: `0 0 14px -2px hsla(${hue}, 80%, 55%, 0.45)`,
          }}
          aria-hidden
        >
          {initials}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {project.name}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {project.agents} agent{project.agents === 1 ? "" : "s"}
            <span className="px-1.5">·</span>
            {project.tasks} task{project.tasks === 1 ? "" : "s"}
          </p>
        </div>

        <StatusBadge status={project.status} />
        <ChevronRightIcon />
      </Link>
    </li>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="mt-1 shrink-0 text-[#7975a8]"
      aria-hidden
    >
      <path
        d="m6 3.333 4.667 4.667L6 12.667"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status?.toLowerCase() === "active";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        isActive
          ? "bg-emerald-500/20 text-emerald-300"
          : "bg-[#1b1833] text-[#7975a8]"
      }`}
    >
      {status || "—"}
    </span>
  );
}

function EmptyHint() {
  return (
    <EmptyState
      icon={Folder}
      title="No projects yet"
      description="Projects group your agents, tasks, and chats around a goal. Start by creating one."
      actions={[
        {
          label: "Create project",
          href: "/projects/new",
          icon: Plus,
        },
      ]}
    />
  );
}

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-md border border-[#1b1833] bg-[#0e0716]"
        />
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-[#ec1b69]/40 bg-[#ec1b69]/10 px-4 py-3 text-sm text-[#ec1b69]">
      {message}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8 3.333v9.334M3.333 8h9.334"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
