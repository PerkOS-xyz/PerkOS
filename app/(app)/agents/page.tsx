"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { Bot, FolderPlus, Loader2, Moon, Pause, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import {
  assignAgentsToProject,
  deleteAgent,
  getHibernationStatusApi,
  getWalletAgents,
  getWalletProjects,
  hibernateAgentApi,
  wakeAgentApi,
  type AgentRow,
  type HibernationApiState,
} from "../../lib/perkosApi";
import { SearchInput, matchesQuery } from "../../components/SearchInput";
import { EmptyState } from "../../components/EmptyState";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ProvisionPipeline } from "../../components/ProvisionPipeline";
import { formatRelativeShort } from "../../lib/format";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function AgentsPage() {
  const { t } = useTranslation();
  const { address } = useConnection();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet-agents", address],
    queryFn: () => getWalletAgents(address!),
    enabled: Boolean(address),
    // While any agent is still provisioning, poll so the card flips to
    // "Online" on its own once the runtime's bridge connects (the heartbeat
    // sets status:"ready") — no manual refresh needed.
    refetchInterval: (q) =>
      (q.state.data ?? []).some((a) => a.status === "provisioning") ? 4000 : false,
  });

  // Project membership per agent — replaces the old hardcoded "Projects: 0".
  const projectsQuery = useQuery({
    queryKey: ["wallet-projects", address],
    queryFn: () => getWalletProjects(address!),
    enabled: Boolean(address),
    staleTime: 60_000,
  });
  const projectCountByAgent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of projectsQuery.data?.projects ?? []) {
      for (const name of p.agentIds ?? []) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return counts;
  }, [projectsQuery.data]);

  const allAgents = useMemo(() => data ?? [], [data]);
  const agents = allAgents.filter((a) =>
    matchesQuery(query, [a.name, a.runtime, a.status, ...a.plugins])
  );
  const hasAgents = allAgents.length > 0;
  const noResults = hasAgents && agents.length === 0;

  const visibleIds = agents.map((a) => a.id);
  const selectedIds = visibleIds.filter((id) => selected.has(id));
  const allChecked = visibleIds.length > 0 && selectedIds.length === visibleIds.length;
  const someChecked = selectedIds.length > 0 && !allChecked;
  const byId = useMemo(() => new Map(allAgents.map((a) => [a.id, a])), [allAgents]);
  const selectedNames = selectedIds
    .map((id) => byId.get(id)?.name)
    .filter((n): n is string => Boolean(n));
  // Hibernate/Wake is ECS scale-to-0 — only for agents on PerkOS infra. Hide
  // those actions when any selected agent is external (invited / self-hosted /
  // imported), since PerkOS doesn't control their hosting.
  const selectedAllHibernatable =
    selectedIds.length > 0 && selectedIds.every((id) => !byId.get(id)?.external);

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

  const summarize = (r: PromiseSettledResult<unknown>[]) => {
    const failed = r.filter((x) => x.status === "rejected").length;
    return { ok: r.length - failed, failed };
  };
  const invalidateAgents = () =>
    qc.invalidateQueries({ queryKey: ["wallet-agents", address] });

  const deleteMut = useMutation({
    mutationFn: () =>
      Promise.allSettled(
        selectedIds.map((id) => deleteAgent({ walletAddress: address!, agentId: id }))
      ),
    onSuccess: (r) => {
      invalidateAgents();
      const { ok, failed } = summarize(r);
      if (failed) toast.error(t("agents.toast.deletedSomeFailed", { ok, failed }));
      else toast.success(t("agents.toast.deletedSuccess", { count: ok }));
      setConfirmDelete(false);
      clear();
    },
    onError: (e: Error) => {
      toast.error(t("agents.toast.bulkDeleteFailed"), { description: e.message });
      setConfirmDelete(false);
    },
  });

  const hibernateMut = useMutation({
    mutationFn: () =>
      Promise.allSettled(selectedIds.map((id) => hibernateAgentApi({ agentId: id }))),
    onSuccess: (r) => {
      invalidateAgents();
      const { ok, failed } = summarize(r);
      if (failed)
        toast.error(t("agents.toast.hibernatedSomeFailed", { ok, failed }), {
          description: t("agents.toast.hibernatedSomeFailedDesc"),
        });
      else toast.success(t("agents.toast.hibernatedSuccess", { count: ok }));
      clear();
    },
    onError: (e: Error) => toast.error(t("agents.toast.bulkHibernateFailed"), { description: e.message }),
  });

  const wakeMut = useMutation({
    mutationFn: () =>
      Promise.allSettled(selectedIds.map((id) => wakeAgentApi({ agentId: id }))),
    onSuccess: (r) => {
      invalidateAgents();
      const { ok, failed } = summarize(r);
      if (failed)
        toast.error(t("agents.toast.wokeSomeFailed", { ok, failed }), {
          description: t("agents.toast.wokeSomeFailedDesc"),
        });
      else toast.success(t("agents.toast.wokeSuccess", { count: ok }));
      clear();
    },
    onError: (e: Error) => toast.error(t("agents.toast.bulkWakeFailed"), { description: e.message }),
  });

  const mutating =
    deleteMut.isPending || hibernateMut.isPending || wakeMut.isPending;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium text-[#ececff]">{t("agents.header.title")}</h1>
          <p className="max-w-xl text-sm text-[#7975a8]">
            {t("agents.header.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/agents/new"
            className="flex items-center justify-center gap-2 rounded-md bg-[#ec1b69] px-5 py-2.5 text-sm font-medium text-[#ececff] transition-opacity hover:opacity-90"
          >
            <PlusIcon />
            {t("agents.header.addAgent")}
          </Link>
        </div>
      </header>

      {hasAgents ? (
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={t("agents.search.placeholder")}
        />
      ) : null}

      {isLoading ? <SkeletonGrid /> : null}
      {error ? <ErrorBanner message={(error as Error).message} /> : null}

      {!isLoading && !error && agents.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={allChecked ? true : someChecked ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label={t("agents.bulk.selectAllAria")}
              />
              {t("agents.bulk.selectAll")}
            </label>
            {selectedIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-foreground">
                  {t("agents.bulk.selectedCount", { count: selectedIds.length })}
                </span>
                <Button size="xs" variant="outline" disabled={mutating} onClick={() => setAssignOpen(true)}>
                  <FolderPlus className="h-3.5 w-3.5" /> {t("agents.bulk.assignToProject")}
                </Button>
                {selectedAllHibernatable ? (
                  <>
                    <Button size="xs" variant="outline" disabled={mutating} onClick={() => hibernateMut.mutate()}>
                      <Moon className="h-3.5 w-3.5" /> {t("agents.bulk.hibernate")}
                    </Button>
                    <Button size="xs" variant="outline" disabled={mutating} onClick={() => wakeMut.mutate()}>
                      <Play className="h-3.5 w-3.5" /> {t("agents.bulk.wake")}
                    </Button>
                  </>
                ) : null}
                <Button size="xs" variant="destructive" disabled={mutating} onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> {t("agents.bulk.delete")}
                </Button>
                <Button size="xs" variant="ghost" disabled={mutating} onClick={clear}>
                  {t("agents.bulk.clear")}
                </Button>
              </div>
            ) : null}
          </div>

          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {agents.map((a) => (
              <AgentCard
                key={a.id}
                agent={a}
                checked={selected.has(a.id)}
                onToggle={(on) => toggle(a.id, on)}
                projectCount={projectCountByAgent.get(a.name) ?? 0}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {!isLoading && !error && noResults ? (
        <p className="rounded-md border border-dashed border-[#1b1833] px-6 py-10 text-center text-sm text-[#7975a8]">
          {t("agents.search.noResults", { query })}
        </p>
      ) : null}

      {!isLoading && !error && !hasAgents ? <EmptyHint /> : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("agents.confirmDelete.title", { count: selectedIds.length })}
        description={t("agents.confirmDelete.description")}
        confirmLabel={t("agents.confirmDelete.confirmLabel")}
        destructive
        pending={deleteMut.isPending}
        onConfirm={() => deleteMut.mutate()}
      />

      <AssignToProjectDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        agentNames={selectedNames}
        onAssigned={() => {
          setAssignOpen(false);
          clear();
        }}
      />
    </div>
  );
}

function AssignToProjectDialog({
  open,
  onOpenChange,
  agentNames,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  agentNames: string[];
  onAssigned: () => void;
}) {
  const { t } = useTranslation();
  const { address } = useConnection();
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState("");

  const { data } = useQuery({
    queryKey: ["wallet-projects", address],
    queryFn: () => getWalletProjects(address!),
    enabled: open && Boolean(address),
  });
  const projects = data?.projects ?? [];

  const assignMut = useMutation({
    mutationFn: () =>
      assignAgentsToProject({ walletAddress: address!, projectId, agentNames }),
    onSuccess: ({ added }) => {
      qc.invalidateQueries({ queryKey: ["wallet-projects", address] });
      qc.invalidateQueries({ queryKey: ["wallet-project", address, projectId] });
      const name =
        projects.find((p) => p.id === projectId)?.name ??
        t("agents.assignDialog.projectFallback");
      toast.success(
        added > 0
          ? t("agents.assignDialog.assignedSuccess", { count: agentNames.length, name })
          : t("agents.assignDialog.alreadyOn", { name })
      );
      onAssigned();
    },
    onError: (e: Error) => toast.error(t("agents.assignDialog.assignFailed"), { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("agents.assignDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("agents.assignDialog.description", { count: agentNames.length })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <label htmlFor="assign-project" className="text-xs text-muted-foreground">
            {t("agents.assignDialog.projectLabel")}
          </label>
          <select
            id="assign-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="h-10 w-full appearance-none rounded-md border border-input bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">{t("agents.assignDialog.selectPlaceholder")}</option>
            {projects.map((p) => (
              <option key={p.id ?? p.name} value={p.id ?? ""}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={assignMut.isPending}>
            {t("agents.assignDialog.cancel")}
          </Button>
          <Button
            disabled={!projectId || assignMut.isPending}
            onClick={() => assignMut.mutate()}
          >
            {assignMut.isPending ? t("agents.assignDialog.assigning") : t("agents.assignDialog.assign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * An invited agent that has never connected within ~30 min reads as stale —
 * surface it so a broken bridge setup doesn't masquerade as a fresh invite.
 * Kept out of the render body so it doesn't trip the react-hooks/purity rule.
 */
function isInvitedStale(agent: AgentRow): boolean {
  if (agent.invited !== true || agent.revoked) return false;
  if (agent.bridgeConnected === true || agent.lastBridgeSeenAt) return false;
  if (!agent.createdAt) return false;
  return Date.now() - Date.parse(agent.createdAt) > 30 * 60 * 1000;
}

function AgentCard({
  agent,
  checked,
  onToggle,
  projectCount,
}: {
  agent: AgentRow;
  checked: boolean;
  onToggle: (on: boolean) => void;
  projectCount: number;
}) {
  const { t } = useTranslation();
  // Cross-reference the live hibernation status so a scaled-to-0 agent shows
  // "Hibernated" instead of a stale "Online" (agent.status stays "ready").
  // Shares the react-query cache with the detail page's query for this agent.
  // External (invited/self-hosted) agents have no ECS service, so skip it.
  const hibQuery = useQuery({
    queryKey: ["agent-hibernation", agent.id],
    queryFn: () => getHibernationStatusApi({ agentId: agent.id }),
    enabled: agent.status === "ready" && !agent.external,
    // While a wake/hibernate is mid-flight, poll so the badge + power button
    // converge to the settled state without a manual refresh.
    refetchInterval: (q) => {
      const s = q.state.data?.state;
      return s === "waking" || s === "hibernating" ? 5000 : false;
    },
  });
  const hibState = hibQuery.data?.state;
  const syncing = agent.status === "ready" && hibQuery.isLoading;
  return (
    <li>
      <Link
        href={`/agents/${encodeURIComponent(agent.id)}`}
        className={`flex flex-col gap-3 rounded-md border bg-[#0e0716] p-4 transition-colors ${
          checked ? "border-primary/60" : "border-[#1b1833] hover:border-[#530922]"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={checked}
              onCheckedChange={onToggle}
              aria-label={t("agents.card.selectAria", { name: agent.name })}
            />
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ec1b69]/20 text-xs font-medium text-[#ec1b69]">
              {initials(agent.name)}
            </span>
            <div className="flex flex-col">
              <span className="text-sm text-[#ececff]">{agent.name}</span>
              <span className="text-xs text-[#7975a8]">{agent.runtime}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AgentPowerToggle agent={agent} hibState={hibState} />
            {agent.external ? (
              <span
                className="rounded border border-[#1b1833] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#7975a8]"
                title={t("agents.card.externalTitle")}
              >
                {t("agents.card.external")}
              </span>
            ) : null}
            <StatusBadge
              status={agent.status}
              hibernationState={hibState}
              syncing={syncing}
              invited={agent.invited}
              revoked={agent.revoked}
              invitedStale={isInvitedStale(agent)}
            />
          </div>
        </div>

        {agent.status === "provisioning" ? (
          <ProvisionPipeline
            status={agent.status}
            bridgeConnected={agent.bridgeConnected}
            className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5"
          />
        ) : null}

        <p className="text-xs leading-relaxed text-[#7975a8]">
          {agent.plugins.length > 0
            ? t("agents.card.capabilities", { list: agent.plugins.join(", ") })
            : t("agents.card.noCapabilities")}
        </p>

        <div className="flex items-center justify-between text-xs text-[#7975a8]">
          <span>
            {t("agents.card.projects", { count: projectCount })}
          </span>
          <span>
            {agent.lastBridgeSeenAt
              ? t("agents.card.active", { time: formatRelativeShort(agent.lastBridgeSeenAt) })
              : agent.createdAt
                ? t("agents.card.created", { time: formatRelativeShort(agent.createdAt) })
                : t("agents.card.capabilitiesCount", { count: agent.plugins.length })}
          </span>
        </div>
      </Link>
    </li>
  );
}

// Per-agent power control. Play = wake (scale 0→1), Pause = hibernate
// (scale 1→0). Only shown for PerkOS-infra agents that finished provisioning;
// external/BYOK agents (no ECS) get no control. Lives inside the card's Link,
// so it stops propagation like the Checkbox already does.
function AgentPowerToggle({
  agent,
  hibState,
}: {
  agent: AgentRow;
  hibState?: HibernationApiState;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const controllable = agent.status === "ready" && !agent.external;
  const transitioning = hibState === "waking" || hibState === "hibernating";
  const hibernated = hibState === "hibernated";

  const mut = useMutation({
    mutationFn: () =>
      hibernated
        ? wakeAgentApi({ agentId: agent.id })
        : hibernateAgentApi({ agentId: agent.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-hibernation", agent.id] });
      toast.success(
        hibernated
          ? t("agents.power.waking", { name: agent.name })
          : t("agents.power.hibernating", { name: agent.name }),
        {
          description: hibernated
            ? t("agents.power.wakingDesc")
            : t("agents.power.hibernatingDesc"),
        },
      );
    },
    onError: (e: Error) =>
      toast.error(t("agents.power.error"), { description: e.message }),
  });

  if (!controllable) return null;

  const busy = mut.isPending || transitioning;
  const Icon = busy ? Loader2 : hibernated ? Play : Pause;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!busy) mut.mutate();
      }}
      disabled={busy}
      aria-label={hibernated ? t("agents.power.wakeAria", { name: agent.name }) : t("agents.power.hibernateAria", { name: agent.name })}
      title={
        busy ? t("agents.power.working") : hibernated ? t("agents.power.wakeTitle") : t("agents.power.hibernateTitle")
      }
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#1b1833] text-[#7975a8] transition-colors hover:border-[#530922] hover:text-[#ececff] disabled:opacity-60"
    >
      <Icon className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
    </button>
  );
}

function StatusBadge({
  status,
  hibernationState,
  syncing,
  invited,
  revoked,
  invitedStale,
}: {
  status: AgentRow["status"];
  hibernationState?: HibernationApiState;
  syncing?: boolean;
  invited?: boolean;
  revoked?: boolean;
  invitedStale?: boolean;
}) {
  const { t } = useTranslation();
  // Invited external agents: their lifecycle is "invited" → (connect) → "ready",
  // or "revoked" if the owner killed the credential. Surface those explicitly
  // instead of letting them fall through to a meaningless "Unknown". (These
  // states live in flags, not `status`, since the shared enum omits them.)
  if (revoked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#ec1b69]/20 px-2 py-0.5 text-xs font-medium text-[#ec1b69]">
        {t("agents.status.revoked")}
      </span>
    );
  }
  if (invited && status !== "ready") {
    return invitedStale ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
        {t("agents.status.neverConnected")}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2 py-0.5 text-xs font-medium text-sky-300">
        {t("agents.status.invited")}
      </span>
    );
  }
  // Live hibernation status still loading — don't assert "Online".
  if (syncing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#7975a8]/20 px-2 py-0.5 text-xs font-medium text-[#7975a8]">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("agents.status.syncing")}
      </span>
    );
  }
  // A hibernated/waking ECS agent still reports status==="ready" — surface the
  // live hibernation state instead of a misleading "Online".
  if (status === "ready" && hibernationState && hibernationState !== "active") {
    const sleep =
      hibernationState === "hibernated"
        ? { tone: "bg-[#7975a8]/20 text-[#7975a8]", label: t("agents.status.hibernated"), spin: false }
        : hibernationState === "hibernating"
        ? { tone: "bg-amber-500/20 text-amber-300", label: t("agents.status.hibernating"), spin: true }
        : { tone: "bg-sky-500/20 text-sky-300", label: t("agents.status.waking"), spin: true };
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${sleep.tone}`}
      >
        {sleep.spin ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Moon className="h-3 w-3" />
        )}
        {sleep.label}
      </span>
    );
  }
  const provisioning = status === "provisioning";
  const tone =
    status === "ready"
      ? "bg-emerald-500/20 text-emerald-300"
      : status === "failed"
      ? "bg-[#ec1b69]/20 text-[#ec1b69]"
      : provisioning
      ? "bg-amber-500/20 text-amber-300"
      : "bg-[#7975a8]/20 text-[#7975a8]";
  const label =
    status === "ready"
      ? t("agents.status.online")
      : status === "failed"
      ? t("agents.status.failed")
      : provisioning
      ? t("agents.status.provisioning")
      : t("agents.status.unknown");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {provisioning ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      {status === "ready" ? (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      ) : null}
      {label}
    </span>
  );
}

function EmptyHint() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={Bot}
      title={t("agents.empty.title")}
      description={t("agents.empty.description")}
      actions={[
        {
          label: t("agents.empty.action"),
          href: "/agents/new",
          icon: Plus,
        },
      ]}
    />
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-md border border-[#1b1833] bg-[#0e0716]"
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

function initials(name: string): string {
  return name
    .split(/\s+|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 3.333v9.334M3.333 8h9.334"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
