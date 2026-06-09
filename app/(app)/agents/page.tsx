"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { Bot, FolderPlus, Loader2, Moon, Pause, Play, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  assignAgentsToProject,
  deleteAgent,
  getHibernationStatusApi,
  getWalletAgents,
  getWalletProjects,
  hibernateAgentApi,
  wakeAgentApi,
  type Agent,
  type AgentRow,
  type HibernationApiState,
} from "../../lib/perkosApi";
import { SearchInput, matchesQuery } from "../../components/SearchInput";
import { EmptyState } from "../../components/EmptyState";
import { ConfirmDialog } from "../../components/ConfirmDialog";
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
      if (failed) toast.error(`Deleted ${ok}, ${failed} failed`);
      else toast.success(`Deleted ${ok} agent${ok === 1 ? "" : "s"}`);
      setConfirmDelete(false);
      clear();
    },
    onError: (e: Error) => {
      toast.error("Bulk delete failed", { description: e.message });
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
        toast.error(`Hibernated ${ok}, ${failed} failed`, {
          description: "Agents not deployed on PerkOS infra can't hibernate.",
        });
      else toast.success(`Hibernated ${ok} agent${ok === 1 ? "" : "s"}`);
      clear();
    },
    onError: (e: Error) => toast.error("Bulk hibernate failed", { description: e.message }),
  });

  const wakeMut = useMutation({
    mutationFn: () =>
      Promise.allSettled(selectedIds.map((id) => wakeAgentApi({ agentId: id }))),
    onSuccess: (r) => {
      invalidateAgents();
      const { ok, failed } = summarize(r);
      if (failed)
        toast.error(`Woke ${ok}, ${failed} failed`, {
          description: "Agents not deployed on PerkOS infra can't wake.",
        });
      else toast.success(`Woke ${ok} agent${ok === 1 ? "" : "s"}`);
      clear();
    },
    onError: (e: Error) => toast.error("Bulk wake failed", { description: e.message }),
  });

  const mutating =
    deleteMut.isPending || hibernateMut.isPending || wakeMut.isPending;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium text-[#ececff]">Agent team</h1>
          <p className="max-w-xl text-sm text-[#7975a8]">
            Connect your agents, assign them to projects, and put them to work.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/agents/invite"
            className="flex items-center justify-center gap-2 rounded-md border border-[#1b1833] px-4 py-2.5 text-sm font-medium text-[#ececff] transition-colors hover:border-[#7975a8]/50"
          >
            <UserPlus className="h-4 w-4" />
            Invite agent
          </Link>
          <Link
            href="/agents/new"
            className="flex items-center justify-center gap-2 rounded-md bg-[#ec1b69] px-5 py-2.5 text-sm font-medium text-[#ececff] transition-opacity hover:opacity-90"
          >
            <PlusIcon />
            Create agent
          </Link>
        </div>
      </header>

      {hasAgents ? (
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search agents by name, runtime, or capability…"
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
                aria-label="Select all agents"
              />
              Select all
            </label>
            {selectedIds.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-foreground">
                  {selectedIds.length} selected
                </span>
                <Button size="xs" variant="outline" disabled={mutating} onClick={() => setAssignOpen(true)}>
                  <FolderPlus className="h-3.5 w-3.5" /> Assign to project
                </Button>
                {selectedAllHibernatable ? (
                  <>
                    <Button size="xs" variant="outline" disabled={mutating} onClick={() => hibernateMut.mutate()}>
                      <Moon className="h-3.5 w-3.5" /> Hibernate
                    </Button>
                    <Button size="xs" variant="outline" disabled={mutating} onClick={() => wakeMut.mutate()}>
                      <Play className="h-3.5 w-3.5" /> Wake
                    </Button>
                  </>
                ) : null}
                <Button size="xs" variant="destructive" disabled={mutating} onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
                <Button size="xs" variant="ghost" disabled={mutating} onClick={clear}>
                  Clear
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
              />
            ))}
          </ul>
        </div>
      ) : null}

      {!isLoading && !error && noResults ? (
        <p className="rounded-md border border-dashed border-[#1b1833] px-6 py-10 text-center text-sm text-[#7975a8]">
          No agents match &quot;{query}&quot;.
        </p>
      ) : null}

      {!isLoading && !error && !hasAgents ? <EmptyHint /> : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${selectedIds.length} agent${selectedIds.length === 1 ? "" : "s"}?`}
        description="Tears down each running container, revokes its LLM key, and clears its records (including the relay registry). Billing stops immediately. This can't be undone."
        confirmLabel="Delete"
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
      const name = projects.find((p) => p.id === projectId)?.name ?? "project";
      toast.success(
        added > 0
          ? `Assigned ${agentNames.length} agent${agentNames.length === 1 ? "" : "s"} to ${name}`
          : `Already on ${name} — nothing to add`
      );
      onAssigned();
    },
    onError: (e: Error) => toast.error("Assign failed", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign to project</DialogTitle>
          <DialogDescription>
            Add {agentNames.length} selected agent{agentNames.length === 1 ? "" : "s"} to a
            project&apos;s roster.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <label htmlFor="assign-project" className="text-xs text-muted-foreground">
            Project
          </label>
          <select
            id="assign-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="h-10 w-full appearance-none rounded-md border border-input bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id ?? p.name} value={p.id ?? ""}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={assignMut.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!projectId || assignMut.isPending}
            onClick={() => assignMut.mutate()}
          >
            {assignMut.isPending ? "Assigning…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgentCard({
  agent,
  checked,
  onToggle,
}: {
  agent: AgentRow;
  checked: boolean;
  onToggle: (on: boolean) => void;
}) {
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
              aria-label={`Select ${agent.name}`}
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
                title="Runs on your own infra (invited / self-hosted) — PerkOS can't hibernate it"
              >
                External
              </span>
            ) : null}
            <StatusBadge
              status={agent.status}
              hibernationState={hibState}
              syncing={syncing}
            />
          </div>
        </div>

        {agent.status === "provisioning" ? (
          <p className="flex items-center gap-1.5 text-xs text-amber-300/90">
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
            Setting up your agent — usually under a minute. This updates on its
            own.
          </p>
        ) : null}

        <p className="text-xs leading-relaxed text-[#7975a8]">
          {agent.plugins.length > 0
            ? `Capabilities: ${agent.plugins.join(", ")}`
            : "No capabilities configured yet."}
        </p>

        <div className="flex items-center justify-between text-xs text-[#7975a8]">
          <span>Projects: 0</span>
          <span>Capabilities: {agent.plugins.length}</span>
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
        hibernated ? `Waking ${agent.name}…` : `Hibernating ${agent.name}…`,
        {
          description: hibernated
            ? "Boots + connects in ~2–3 min."
            : "Scaling down to save cost.",
        },
      );
    },
    onError: (e: Error) =>
      toast.error("Couldn't change power state", { description: e.message }),
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
      aria-label={hibernated ? `Wake ${agent.name}` : `Hibernate ${agent.name}`}
      title={
        busy ? "Working…" : hibernated ? "Wake agent" : "Hibernate agent"
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
}: {
  status: Agent["status"];
  hibernationState?: HibernationApiState;
  syncing?: boolean;
}) {
  // Live hibernation status still loading — don't assert "Online".
  if (syncing) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#7975a8]/20 px-2 py-0.5 text-xs font-medium text-[#7975a8]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Syncing…
      </span>
    );
  }
  // A hibernated/waking ECS agent still reports status==="ready" — surface the
  // live hibernation state instead of a misleading "Online".
  if (status === "ready" && hibernationState && hibernationState !== "active") {
    const sleep =
      hibernationState === "hibernated"
        ? { tone: "bg-[#7975a8]/20 text-[#7975a8]", label: "Hibernated", spin: false }
        : hibernationState === "hibernating"
        ? { tone: "bg-amber-500/20 text-amber-300", label: "Hibernating…", spin: true }
        : { tone: "bg-sky-500/20 text-sky-300", label: "Waking…", spin: true };
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
      ? "Online"
      : status === "failed"
      ? "Failed"
      : provisioning
      ? "Provisioning"
      : "Unknown";
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
  return (
    <EmptyState
      icon={Bot}
      title="No agents yet"
      description="Create a Hermes or OpenClaw agent on PerkOS, or invite an agent you already run elsewhere into your org."
      actions={[
        {
          label: "Create agent",
          href: "/agents/new",
          icon: Plus,
        },
        {
          label: "Invite agent",
          href: "/agents/invite",
          icon: UserPlus,
          variant: "outline",
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
