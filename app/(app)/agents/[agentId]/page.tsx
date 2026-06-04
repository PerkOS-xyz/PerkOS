"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { toast } from "sonner";
import {
  ArrowLeft,
  RefreshCw,
  Pencil,
  Trash2,
  Send,
  Hash,
  MessageSquare,
  Bot,
  Wallet,
  Calendar,
  Server,
  KeyRound,
  Layers,
  Boxes,
  Power,
  Loader2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  deleteAgent,
  getHibernationStatusApi,
  getWalletAgents,
  getWalletProject,
  getWalletProjects,
  hibernateAgentApi,
  type Agent,
  type HibernationApiState,
  type Task,
} from "../../../lib/perkosApi";
import { formatAddress } from "../../../lib/format";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { EditAgentDialog } from "../../../components/EditAgentDialog";
import { HibernationPanel } from "./HibernationPanel";
import { UpgradePanel } from "./UpgradePanel";
import { AutoWakeBanner } from "./AutoWakeBanner";
import { AgentChatPanel } from "./AgentChatPanel";

type PageProps = {
  params: Promise<{ agentId: string }>;
};

function initials(name: string): string {
  return name
    .split(/\s+|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function formatDate(value?: string): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

const CHANNEL_LABELS: Record<string, { label: string; Icon: typeof Send }> = {
  telegram: { label: "Telegram", Icon: Send },
  discord: { label: "Discord", Icon: Hash },
  whatsapp: { label: "WhatsApp", Icon: MessageSquare },
  slack: { label: "Slack", Icon: MessageSquare },
  x: { label: "X / Twitter", Icon: MessageSquare },
  email: { label: "Email", Icon: MessageSquare },
};

export default function AgentDetailPage({ params }: PageProps) {
  const { agentId } = use(params);
  const queryClient = useQueryClient();
  const { address, isConnected } = useConnection();

  const agentsQuery = useQuery({
    queryKey: ["wallet-agents", address],
    queryFn: () => getWalletAgents(address!),
    enabled: isConnected && Boolean(address),
  });

  const agent = agentsQuery.data?.find((a) => a.id === agentId);

  const projectsQuery = useQuery({
    queryKey: ["wallet-projects", address],
    queryFn: () => getWalletProjects(address!),
    enabled: isConnected && Boolean(address),
  });

  const projectIds = useMemo(
    () =>
      (projectsQuery.data?.projects ?? [])
        .map((p) => p.id)
        .filter((id): id is string => Boolean(id)),
    [projectsQuery.data]
  );

  const projectDetails = useQueries({
    queries: projectIds.map((pid) => ({
      queryKey: ["wallet-project", address, pid],
      queryFn: () =>
        getWalletProject({ walletAddress: address!, projectId: pid }),
      enabled: isConnected && Boolean(address) && Boolean(pid),
    })),
  });

  const projectDetailsReady = projectDetails.every((q) => !q.isLoading);

  const assignedTasks = useMemo(() => {
    if (!agent) return [] as { task: Task; projectId: string; projectName: string }[];
    const out: { task: Task; projectId: string; projectName: string }[] = [];
    for (const q of projectDetails) {
      const detail = q.data;
      if (!detail) continue;
      for (const task of detail.tasks) {
        if (task.agentId === agent.id || task.agent === agent.name) {
          out.push({
            task,
            projectId: detail.project.id ?? "",
            projectName: detail.project.name,
          });
        }
      }
    }
    return out;
  }, [agent, projectDetails]);

  const channels = useMemo(() => {
    if (!agent) return [] as { id: string; label: string; Icon: typeof Send }[];
    return agent.plugins
      .filter((p) => p.startsWith("channel:"))
      .map((p) => p.slice("channel:".length))
      .map((id) => ({
        id,
        label: CHANNEL_LABELS[id]?.label ?? id,
        Icon: CHANNEL_LABELS[id]?.Icon ?? MessageSquare,
      }));
  }, [agent]);

  const capabilities = useMemo(() => {
    if (!agent) return [] as string[];
    return agent.plugins.filter((p) => !p.startsWith("channel:"));
  }, [agent]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["wallet-agents", address] });
    queryClient.invalidateQueries({ queryKey: ["wallet-projects", address] });
    projectIds.forEach((pid) =>
      queryClient.invalidateQueries({
        queryKey: ["wallet-project", address, pid],
      })
    );
  };

  if (agentsQuery.isLoading) {
    return <SkeletonDetail />;
  }

  if (agentsQuery.error) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {(agentsQuery.error as Error).message}
        </p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <div className="rounded-md border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          Agent not found in your team.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <AgentHeader
        agent={agent}
        onRefresh={refresh}
        refreshing={agentsQuery.isFetching}
        walletAddress={address ?? ""}
      />

      <AutoWakeBanner
        agentId={agent.id}
        agentName={agent.name}
        ecsDeployed={agent.status === "ready"}
      />

      <AgentChatPanel
        agentId={agent.id}
        agentName={agent.name}
        ecsDeployed={agent.status === "ready"}
      />

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <MetadataCard agent={agent} />
        <CapabilitiesCard capabilities={capabilities} />
      </section>

      <ChannelsSection channels={channels} runtime={agent.runtime} />

      <HibernationPanel
        agentId={agent.id}
        agentName={agent.name}
        ecsDeployed={agent.status === "ready"}
      />

      <UpgradePanel
        agentId={agent.id}
        agentName={agent.name}
        ecsDeployed={agent.status === "ready"}
      />

      <TasksSection
        tasks={assignedTasks}
        ready={projectDetailsReady}
        agentName={agent.name}
      />

      <ActionsPanel agent={agent} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/agents"
      className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Agent team
    </Link>
  );
}

function AgentHeader({
  agent,
  onRefresh,
  refreshing,
  walletAddress,
}: {
  agent: Agent;
  onRefresh: () => void;
  refreshing: boolean;
  walletAddress: string;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();

  // "Stop" hibernates the agent (ECS scale-to-0). It's reversible — the next
  // chat message wakes it — so no confirm dialog; the toast says as much.
  // Only offered while the agent is Online (status==="ready").
  const stopMutation = useMutation({
    mutationFn: () => hibernateAgentApi({ agentId: agent.id }),
    onSuccess: (result) => {
      toast.success(
        result.previousDesiredCount === 0
          ? `${agent.name} was already stopped.`
          : `${agent.name} stopped — it'll wake automatically on your next message.`
      );
      queryClient.invalidateQueries({ queryKey: ["agent-hibernation", agent.id] });
      queryClient.invalidateQueries({ queryKey: ["wallet-agents", walletAddress] });
    },
    onError: (err: Error) =>
      toast.error("Couldn't stop agent", { description: err.message }),
  });

  // Hibernation state lives in a separate live query (shared cache with the
  // HibernationPanel / AutoWakeBanner). It takes priority over `agent.status`:
  // a scaled-to-0 agent still reads status==="ready" in Firestore, so without
  // this the header would show "Online" + a "Stop" button on a sleeping agent.
  const hibQuery = useQuery({
    queryKey: ["agent-hibernation", agent.id],
    queryFn: () => getHibernationStatusApi({ agentId: agent.id }),
    enabled: agent.status === "ready",
  });
  const hibState = hibQuery.data?.state;
  const sleeping =
    hibState === "hibernated" ||
    hibState === "hibernating" ||
    hibState === "waking";
  const isRunning = agent.status === "ready" && !sleeping;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="relative">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-base font-medium text-primary">
            {initials(agent.name)}
          </div>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 grid h-3 w-3 place-items-center rounded-full ring-2 ring-background",
              isRunning
                ? "bg-emerald-400"
                : sleeping
                ? "bg-slate-400"
                : agent.status === "failed"
                ? "bg-destructive"
                : "bg-amber-400"
            )}
            aria-hidden
          />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium leading-tight text-foreground">
            {agent.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="border-0 bg-muted">
              {agent.runtime}
            </Badge>
            <StatusBadge status={agent.status} hibernationState={hibState} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isRunning ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => stopMutation.mutate()}
            disabled={stopMutation.isPending}
            className="gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
          >
            {stopMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Power className="h-3.5 w-3.5" />
            )}
            Stop
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
          />
          Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditOpen(true)}
          disabled={!walletAddress}
          className="gap-1.5"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </div>

      {walletAddress ? (
        <EditAgentDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          agent={agent}
          walletAddress={walletAddress}
        />
      ) : null}
    </div>
  );
}

function StatusBadge({
  status,
  hibernationState,
}: {
  status: Agent["status"];
  hibernationState?: HibernationApiState;
}) {
  // A hibernated/waking ECS agent still reports status==="ready", so surface
  // the live hibernation state instead of a misleading "Online".
  if (status === "ready" && hibernationState && hibernationState !== "active") {
    const sleep =
      hibernationState === "hibernated"
        ? { tone: "bg-slate-500/20 text-slate-300", label: "Hibernated" }
        : hibernationState === "hibernating"
        ? { tone: "bg-amber-500/20 text-amber-300", label: "Hibernating…" }
        : { tone: "bg-sky-500/20 text-sky-300", label: "Waking…" };
    return (
      <Badge variant="secondary" className={cn("border-0", sleep.tone)}>
        {sleep.label}
      </Badge>
    );
  }
  const tone =
    status === "ready"
      ? "bg-emerald-500/20 text-emerald-300"
      : status === "failed"
      ? "bg-destructive/20 text-destructive"
      : "bg-amber-500/20 text-amber-300";
  const label =
    status === "ready"
      ? "Online"
      : status === "failed"
      ? "Failed"
      : status === "provisioning"
      ? "Provisioning"
      : "Unknown";
  return (
    <Badge variant="secondary" className={cn("border-0", tone)}>
      {label}
    </Badge>
  );
}

function MetadataCard({ agent }: { agent: Agent }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Runtime metadata</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <MetaRow Icon={Bot} label="Agent ID">
          <span className="font-mono">{formatAddress(agent.id)}</span>
        </MetaRow>
        <MetaRow Icon={Wallet} label="Owner wallet">
          <span className="font-mono">{formatAddress(agent.walletAddress)}</span>
        </MetaRow>
        <MetaRow Icon={Calendar} label="Created">
          {formatDate(agent.createdAt)}
        </MetaRow>
        <MetaRow Icon={Server} label="Endpoint">
          {agent.endpoint ? (
            <span className="break-all font-mono text-xs">
              {agent.endpoint}
            </span>
          ) : (
            <span className="text-muted-foreground">Not provisioned yet</span>
          )}
        </MetaRow>
        <MetaRow Icon={Boxes} label="Runtime version">
          {agent.upstreamVersion ? (
            <span className="font-mono text-xs">
              {agent.runtime} {agent.upstreamVersion}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </MetaRow>
        <MetaRow Icon={KeyRound} label="Model key">
          {agent.modelKeyProvided ? (
            <span className="text-emerald-300">User-provided (BYOK)</span>
          ) : (
            <span className="text-muted-foreground">PerkOS managed</span>
          )}
        </MetaRow>
      </CardContent>
    </Card>
  );
}

function MetaRow({
  Icon,
  label,
  children,
}: {
  Icon: typeof Bot;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="max-w-[60%] text-right text-foreground">{children}</div>
    </div>
  );
}

function CapabilitiesCard({ capabilities }: { capabilities: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4 text-muted-foreground" />
          Capabilities
        </CardTitle>
        <CardDescription>
          Plugins this agent can call on while running tasks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {capabilities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No plugins configured yet. Use Edit to add some.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {capabilities.map((c) => (
              <Badge
                key={c}
                variant="secondary"
                className="border-0 bg-muted text-foreground"
              >
                {c}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChannelsSection({
  channels,
  runtime,
}: {
  channels: { id: string; label: string; Icon: typeof Send }[];
  runtime: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Connected channels</CardTitle>
        <CardDescription>
          Where users can reach this agent in addition to inside PerkOS.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None configured. {runtime} agents can be wired to channels like
            Telegram, Discord, Slack, or WhatsApp.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {channels.map(({ id, label, Icon }) => (
              <li
                key={id}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <Icon className="h-4 w-4 text-primary" />
                {label}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TasksSection({
  tasks,
  ready,
  agentName,
}: {
  tasks: { task: Task; projectId: string; projectName: string }[];
  ready: boolean;
  agentName: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tasks assigned to {agentName}</CardTitle>
        <CardDescription>
          Across all your projects. Click a task to see its detail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!ready ? (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-md border border-border bg-card"
              />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tasks assigned to this agent yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map(({ task, projectId, projectName }) => (
              <li key={task.id ?? `${projectId}-${task.name}`}>
                <Link
                  href={`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(task.id ?? "")}`}
                  className="flex items-center justify-between gap-4 rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-foreground">
                      {task.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {projectName}
                    </span>
                  </div>
                  <TaskStatusBadge status={task.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TaskStatusBadge({ status }: { status: string }) {
  const tone =
    status === "Done"
      ? "bg-emerald-500/20 text-emerald-300"
      : status === "In progress" || status === "Review"
      ? "bg-amber-500/20 text-amber-300"
      : "bg-muted text-muted-foreground";
  return (
    <Badge variant="secondary" className={cn("shrink-0 border-0", tone)}>
      {status || "Backlog"}
    </Badge>
  );
}

function ActionsPanel({ agent }: { agent: Agent }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { address } = useConnection();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!address) throw new Error("Connect a wallet.");
      return deleteAgent({ walletAddress: address, agentId: agent.id });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["wallet-agents", address] });
      // The DELETE handler tore down ECS + Secrets + LLM key + Firestore. If
      // any best-effort step had a non-fatal hiccup, surface it so the user
      // can ping support — but the agent IS gone from their view either way.
      const hasWarnings = result.warnings.length > 0;
      if (hasWarnings) {
        console.warn("[deleteAgent] warnings:", result.warnings);
      }
      toast.success("Agent deleted", {
        description: hasWarnings
          ? `${agent.name} was removed. Some cleanup tasks reported warnings (see console).`
          : `${agent.name} was removed from your team.`,
      });
      router.replace("/agents");
    },
    onError: (err: Error) => {
      toast.error("Couldn't delete agent", { description: err.message });
      setConfirmOpen(false);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lifecycle</CardTitle>
        <CardDescription>
          Remove this agent from your team.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          className="gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${agent.name}?`}
        description="Tears down the running container, revokes its LLM key, and clears its records. Billing stops immediately. Conversations and tasks it was assigned to keep their history but lose this assignment. This can't be undone."
        confirmLabel="Delete agent"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </Card>
  );
}

function SkeletonDetail() {
  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 animate-pulse rounded-full bg-muted" />
        <div className="flex flex-col gap-2">
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-5 w-32 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="h-48 animate-pulse rounded-md border border-border bg-card" />
        <div className="h-48 animate-pulse rounded-md border border-border bg-card" />
      </div>
    </div>
  );
}
