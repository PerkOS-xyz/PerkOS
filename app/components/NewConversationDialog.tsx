"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, Check, Hash, Loader2, MessageSquare, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  agentIdentity,
  createConversation,
  type ConvIdentity,
  type ConvKind,
} from "../lib/conversationsApi";
import { getWalletAgents, getWalletProjects, type Agent } from "../lib/perkosApi";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string | null | undefined;
  /** Pre-select kind on open. Defaults to "dm". */
  defaultKind?: ConvKind;
  /** Optional pre-bound project — hides the project selector when set. */
  projectId?: string;
};

export function NewConversationDialog({
  open,
  onOpenChange,
  walletAddress,
  defaultKind = "dm",
  projectId,
}: Props) {
  const router = useRouter();

  const [kind, setKind] = useState<ConvKind>(defaultKind);
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectId ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setKind(defaultKind);
    setTitle("");
    setSelected(new Set());
    setSelectedProjectId(projectId ?? null);
    setSubmitting(false);
    setError(null);
  }, [open, defaultKind, projectId]);

  const agentsQuery = useQuery({
    queryKey: ["wallet-agents", walletAddress],
    queryFn: () => getWalletAgents(walletAddress!),
    enabled: !!walletAddress && open,
  });

  const projectsQuery = useQuery({
    queryKey: ["wallet-projects", walletAddress],
    queryFn: () => getWalletProjects(walletAddress!),
    enabled: !!walletAddress && open && !projectId,
  });

  const agents = useMemo(
    () => (agentsQuery.data ?? []).filter((a) => a.status !== "failed"),
    [agentsQuery.data],
  );
  const projects = projectsQuery.data?.projects ?? [];

  // For DM kind, single-select. For channel, multi-select.
  function toggleAgent(agent: Agent) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (kind === "dm") {
        next.clear();
        if (!prev.has(agent.name)) next.add(agent.name);
      } else {
        if (next.has(agent.name)) next.delete(agent.name);
        else next.add(agent.name);
      }
      return next;
    });
  }

  // When switching kind, narrow selection if DM has > 1 agent.
  function changeKind(next: ConvKind) {
    setKind(next);
    setSelected((prev) => {
      if (next === "dm" && prev.size > 1) {
        const first = prev.values().next().value as string;
        return new Set([first]);
      }
      return prev;
    });
  }

  const canSubmit =
    !!walletAddress &&
    !submitting &&
    selected.size > 0 &&
    (kind === "dm" ? selected.size === 1 : selected.size >= 1);

  async function submit() {
    if (!canSubmit || !walletAddress) return;
    setSubmitting(true);
    setError(null);
    try {
      const participants: ConvIdentity[] = Array.from(selected).map((name) =>
        agentIdentity(name),
      );
      const conv = await createConversation({
        walletAddress,
        kind,
        title: title.trim() || undefined,
        participants,
        projectId: selectedProjectId ?? undefined,
      });
      onOpenChange(false);
      router.push(`/chat/${encodeURIComponent(conv.id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            Pick an agent for a 1-on-1, or several for a channel. Message
            content lives on the host agent — not in PerkOS cloud.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Kind toggle */}
          <div className="grid grid-cols-2 gap-2">
            <KindButton
              active={kind === "dm"}
              icon={MessageSquare}
              label="Direct message"
              hint="1 agent"
              onClick={() => changeKind("dm")}
            />
            <KindButton
              active={kind === "channel"}
              icon={Hash}
              label="Channel"
              hint="2+ agents"
              onClick={() => changeKind("channel")}
            />
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="conv-title" className="text-xs">
              Title <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="conv-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                kind === "dm"
                  ? "Auto-generated from agent name"
                  : "e.g. growth-q4"
              }
              maxLength={120}
              disabled={submitting}
            />
          </div>

          {/* Agent picker */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">
              {kind === "dm" ? "Agent" : `Agents (${selected.size} selected)`}
            </Label>
            {agentsQuery.isLoading ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading agents…
              </div>
            ) : agents.length === 0 ? (
              <EmptyAgents />
            ) : (
              <ul className="max-h-56 overflow-y-auto rounded-md border border-border bg-card">
                {agents.map((a) => (
                  <AgentRow
                    key={a.id}
                    agent={a}
                    selected={selected.has(a.name)}
                    onToggle={() => toggleAgent(a)}
                    disabled={submitting}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Project picker (hidden if pre-bound) */}
          {!projectId ? (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">
                Project <span className="text-muted-foreground">(optional)</span>
              </Label>
              <select
                value={selectedProjectId ?? ""}
                onChange={(e) => setSelectedProjectId(e.target.value || null)}
                disabled={submitting || projectsQuery.isLoading}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id ?? p.name} value={p.id ?? ""}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Start conversation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KindButton({
  active,
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/30",
      )}
    >
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-sm text-foreground">{label}</span>
      <span className="text-[10px] text-muted-foreground">{hint}</span>
    </button>
  );
}

function AgentRow({
  agent,
  selected,
  onToggle,
  disabled,
}: {
  agent: Agent;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={cn(
          "flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left text-sm transition-colors last:border-b-0",
          selected ? "bg-primary/10" : "hover:bg-muted/40",
          disabled && "opacity-50",
        )}
      >
        <div
          className={cn(
            "grid h-4 w-4 shrink-0 place-items-center rounded border",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border",
          )}
          aria-hidden
        >
          {selected ? <Check className="h-3 w-3" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-foreground">{agent.name}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {agent.runtime}
            {agent.status !== "ready" ? (
              <>
                <span className="px-1">·</span>
                {agent.status}
              </>
            ) : null}
          </div>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "border-0 text-[10px]",
            agent.status === "ready"
              ? "bg-emerald-500/20 text-emerald-300"
              : agent.status === "provisioning"
              ? "bg-amber-500/20 text-amber-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          {agent.status}
        </Badge>
      </button>
    </li>
  );
}

function EmptyAgents() {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border bg-card px-3 py-3">
      <p className="flex items-center gap-2 text-sm text-foreground">
        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
        No agents registered yet.
      </p>
      <p className="text-xs text-muted-foreground">
        Launch your first agent to start a conversation.
      </p>
      <a
        href="/agents/new"
        className="mt-1 inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Plus className="h-3 w-3" />
        Launch agent
      </a>
    </div>
  );
}
