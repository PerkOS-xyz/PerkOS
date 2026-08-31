"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppAccount } from "../../lib/useAppAccount";
import { Archive, ArchiveRestore, Folder, Plus, Trash2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  deleteProject,
  getOrgProjects,
  updateProject,
  type Project,
} from "../../lib/perkosApi";
import { useActiveOrg } from "../../lib/useActiveOrg";
import { formatRelativeShort } from "../../lib/format";
import { SearchInput, matchesQuery } from "../../components/SearchInput";
import { EmptyState } from "../../components/EmptyState";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  CollectionViewToggle,
  useCollectionViewMode,
  type CollectionViewMode,
} from "../../components/CollectionViewToggle";

export default function ProjectsPage() {
  const { t } = useTranslation();
  const { address } = useAppAccount();
  const { activeOrgId, defaultOrgId, activeOrg } = useActiveOrg();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewMode, setViewMode] = useCollectionViewMode("perkos:projects:view");
  const searchParams = useSearchParams();
  // Status filter via ?status=. Currently "active" is the only value the
  // dashboard sends; other values silently pass through.
  const statusFilter = searchParams.get("status");

  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet-projects", address, activeOrgId],
    queryFn: () =>
      getOrgProjects({
        org: activeOrg!,
        myWallet: address!,
        defaultOrgId: defaultOrgId ?? undefined,
      }),
    enabled: Boolean(address) && Boolean(activeOrg),
  });

  const allProjects = data ?? [];
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
      if (status === "Archived") {
        if (failed) toast.error(t("projects.toast.archivedSomeFailed", { ok, failed }));
        else toast.success(t("projects.toast.archivedSuccess", { count: ok }));
      } else {
        if (failed) toast.error(t("projects.toast.unarchivedSomeFailed", { ok, failed }));
        else toast.success(t("projects.toast.unarchivedSuccess", { count: ok }));
      }
      clear();
    },
    onError: (e: Error) =>
      toast.error(t("projects.toast.bulkUpdateFailed"), { description: e.message }),
  });

  const deleteMut = useMutation({
    mutationFn: () =>
      runBulk(selectedVisible, (id) =>
        deleteProject({ walletAddress: address!, projectId: id })
      ),
    onSuccess: ({ ok, failed }) => {
      qc.invalidateQueries({ queryKey: ["wallet-projects", address] });
      if (failed) toast.error(t("projects.toast.deletedSomeFailed", { ok, failed }));
      else toast.success(t("projects.toast.deletedSuccess", { count: ok }));
      setConfirmDelete(false);
      clear();
    },
    onError: (e: Error) => {
      toast.error(t("projects.toast.bulkDeleteFailed"), { description: e.message });
      setConfirmDelete(false);
    },
  });

  const mutating = archiveMut.isPending || deleteMut.isPending;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium text-[#ececff]">{t("projects.header.title")}</h1>
          <p className="text-sm text-[#7975a8]">
            {hasProjects
              ? t("projects.header.countInWorkspace", { count: allProjects.length })
              : t("projects.header.createFirst")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CreateProjectButton />
        </div>
      </header>

      {hasProjects ? (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={t("projects.search.placeholder")}
            />
          </div>
          <CollectionViewToggle
            mode={viewMode}
            onChange={setViewMode}
            cardsLabel={t("common.cardsView")}
            listLabel={t("common.listView")}
          />
        </div>
      ) : null}

      {statusFilter ? (
        <Link
          href="/projects"
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/15"
          aria-label={t("projects.filter.clearStatusAria")}
        >
          {t("projects.filter.statusPill", { status: statusFilter })}
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
                aria-label={t("projects.bulk.selectAllAria")}
              />
              {t("projects.bulk.selectAll")}
            </label>
            {selectedVisible.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-foreground">
                  {t("projects.bulk.selectedCount", { count: selectedVisible.length })}
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={mutating}
                  onClick={() => archiveMut.mutate("Archived")}
                >
                  <Archive className="h-3.5 w-3.5" /> {t("projects.bulk.archive")}
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={mutating}
                  onClick={() => archiveMut.mutate("Active")}
                >
                  <ArchiveRestore className="h-3.5 w-3.5" /> {t("projects.bulk.unarchive")}
                </Button>
                <Button
                  size="xs"
                  variant="destructive"
                  disabled={mutating}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t("projects.bulk.delete")}
                </Button>
                <Button size="xs" variant="ghost" disabled={mutating} onClick={clear}>
                  {t("projects.bulk.clear")}
                </Button>
              </div>
            ) : null}
          </div>

          <ul className={viewMode === "cards" ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3"}>
            {projects.map((p) => (
              <ProjectCard
                key={p.id ?? p.name}
                project={p}
                checked={p.id ? selected.has(p.id) : false}
                onToggle={(on) => p.id && toggle(p.id, on)}
                ownerWallet={
                  activeOrg?.shared ? activeOrg.ownerWallet : undefined
                }
                viewMode={viewMode}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {!isLoading && !error && noResults ? (
        <p className="rounded-md border border-dashed border-[#1b1833] px-6 py-10 text-center text-sm text-[#7975a8]">
          {t("projects.search.noResults", { query })}
        </p>
      ) : null}
      {!isLoading && !error && !hasProjects ? <EmptyHint /> : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("projects.confirmDelete.title", { count: selectedVisible.length })}
        description={t("projects.confirmDelete.description")}
        confirmLabel={t("projects.confirmDelete.confirmLabel")}
        destructive
        pending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
      />
    </div>
  );
}

function CreateProjectButton() {
  const { t } = useTranslation();
  return (
    <Link
      href="/projects/new"
      className="flex items-center justify-center gap-2 rounded-md bg-[#ec1b69] px-5 py-2.5 text-sm font-medium text-[#ececff] transition-opacity hover:opacity-90"
    >
      <PlusIcon />
      <span>{t("projects.header.newProject")}</span>
    </Link>
  );
}

function ProjectCard({
  project,
  checked,
  onToggle,
  ownerWallet,
  viewMode,
}: {
  project: Project;
  checked: boolean;
  onToggle: (on: boolean) => void;
  /** Set when this project is in a SHARED org — links carry ?owner so the
   *  detail page reads from the owner's subtree. */
  ownerWallet?: string;
  viewMode: CollectionViewMode;
}) {
  const { t } = useTranslation();
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
      className={`flex min-w-0 gap-2 rounded-lg border bg-card/60 pl-3 transition-colors ${
        viewMode === "cards" ? "items-start" : "items-center"
      } ${
        checked ? "border-primary/60" : "border-primary/25 hover:border-primary/50"
      }`}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        aria-label={t("projects.card.selectAria", { name: project.name })}
      />
      <Link
        href={`/projects/${encodeURIComponent(project.id ?? "")}${ownerWallet ? `?owner=${ownerWallet}` : ""}`}
        className={viewMode === "cards"
          ? "glow-card flex min-w-0 flex-1 flex-col items-stretch gap-3 rounded-lg px-3 py-4"
          : "glow-card flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-3"}
      >
        <div className={viewMode === "cards" ? "flex items-start justify-between gap-3" : "contents"}>
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
          {viewMode === "cards" ? <StatusBadge status={project.status} /> : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {project.name}
            </span>
          </div>
          {viewMode === "cards" && project.goal ? (
            <p className="line-clamp-2 min-h-8 break-words text-xs leading-relaxed text-muted-foreground">
              {project.goal}
            </p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            {t("projects.card.agentCount", { count: project.agents })}
            <span className="px-1.5">·</span>
            {t("projects.card.taskCount", { count: project.tasks })}
            {project.updatedAt ? (
              <>
                <span className="px-1.5">·</span>
                {t("projects.card.active", { time: formatRelativeShort(project.updatedAt) })}
              </>
            ) : null}
          </p>
        </div>

        {viewMode === "list" ? <StatusBadge status={project.status} /> : null}
        {viewMode === "list" ? <ChevronRightIcon /> : null}
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
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={Folder}
      title={t("projects.empty.title")}
      description={t("projects.empty.description")}
      actions={[
        {
          label: t("projects.header.newProject"),
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
