"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppAccount } from "../../../lib/useAppAccount";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
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
  externalRuntimeAvailability,
  hasFreshAgentHeartbeat,
} from "../../../lib/agentHostingPolicy";

import {
  deleteAgent,
  getAgentGateways,
  getHibernationStatusApi,
  getWalletAgents,
  getWalletProject,
  getWalletProjects,
  hibernateAgentApi,
  type Agent,
  type AgentGatewayView,
  type AgentRow,
  type HibernationApiState,
  type HibernationStatus,
  type Task,
} from "../../../lib/perkosApi";
import { formatAddress, formatRelativeShort } from "../../../lib/format";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { BacklinksPanel } from "../../../components/BacklinksPanel";
import { ProvisionPipeline } from "../../../components/ProvisionPipeline";
import { entityKey } from "../../../lib/edges";
import { useActivityFeed, verbPhrase } from "../../../lib/activityEvents";
import { EditAgentDialog } from "../../../components/EditAgentDialog";
import { HibernationPanel } from "./HibernationPanel";
import { InvitedCredentialPanel } from "./InvitedCredentialPanel";
import { WebhookPanel } from "./WebhookPanel";
import { TeamPanel } from "./TeamPanel";
import { UpgradePanel } from "./UpgradePanel";
import { AutoWakeBanner } from "./AutoWakeBanner";
import { AgentChatPanel } from "./AgentChatPanel";
import { AgentVoiceCallController } from "./AgentVoiceCallController";
import { VoiceCredentialDeliveryPanel } from "./VoiceCredentialDeliveryPanel";

type PageProps = {
  params: Promise<{ agentId: string }>;
};

export const agentDetailResponsiveLayout = {
  tabs: "xl:hidden",
  conversationBase: "min-h-0 flex-col gap-2 xl:flex xl:gap-6",
  conversationActive:
    "flex h-[calc(100svh-18rem)] overflow-hidden md:h-[calc(100dvh-11.5rem)] xl:h-auto xl:overflow-visible",
  settingsBase: "flex-col gap-6 xl:flex",
} as const;

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
  const { t } = useTranslation();
  const { agentId } = use(params);
  const queryClient = useQueryClient();
  const { address } = useAppAccount();
  const [mobileView, setMobileView] = useState<"conversation" | "settings">("conversation");

  const agentsQuery = useQuery({
    queryKey: ["wallet-agents", address],
    queryFn: () => getWalletAgents(address!),
    enabled: Boolean(address),
    // External invitations become online when their bridge posts its first
    // authenticated heartbeat. Keep the detail view live while an invited
    // agent is open so the user does not have to guess when to press Refresh.
    refetchInterval: (query) => {
      const agents = query.state.data as AgentRow[] | undefined;
      return agents?.some((candidate) => candidate.id === agentId && candidate.invited)
        ? 5_000
        : false;
    },
  });

  const agent = agentsQuery.data?.find((a) => a.id === agentId);

  const gatewaysQuery = useQuery({
    queryKey: ["agent-gateways", agentId],
    queryFn: () => getAgentGateways(agentId),
    enabled: Boolean(address) && Boolean(agent),
  });

  const projectsQuery = useQuery({
    queryKey: ["wallet-projects", address],
    queryFn: () => getWalletProjects(address!),
    enabled: Boolean(address),
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
      enabled: Boolean(address) && Boolean(pid),
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

  const voiceProject = useMemo(() => agent ? projectDetails.map((query) => query.data).find((detail) => detail?.project.agentIds?.includes(agent.name)) : undefined, [agent, projectDetails]);

  const channels = useMemo(
    () => (gatewaysQuery.data?.gateways ?? []).filter((gateway) => gateway.enabled),
    [gatewaysQuery.data],
  );

  const capabilities = useMemo(() => {
    if (!agent) return [] as string[];
    const configured = agent.plugins.filter((p) => !p.startsWith("channel:"));
    if (configured.length > 0 || agent.external) return configured;

    // Managed agents always receive these platform capabilities even when the
    // runtime does not expose optional plugin names in its registry payload.
    return ["Project chat", "Project tools", "Docs workspace"];
  }, [agent]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["wallet-agents", address] });
    queryClient.invalidateQueries({ queryKey: ["wallet-projects", address] });
    queryClient.invalidateQueries({ queryKey: ["agent-gateways", agentId] });
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
          {t("agentDetail.notFound")}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-4 xl:gap-6">
      <div className={cn("sticky top-0 z-30 grid grid-cols-2 gap-1 rounded-xl border border-border bg-background/95 p-1 shadow-sm backdrop-blur", agentDetailResponsiveLayout.tabs)} role="tablist" aria-label="Agent view">
        <button type="button" role="tab" aria-selected={mobileView === "conversation"} onClick={() => setMobileView("conversation")} className={cn("min-h-11 rounded-lg border px-3 text-sm font-semibold transition-colors", mobileView === "conversation" ? "border-primary/60 bg-primary text-primary-foreground shadow-sm" : "border-transparent text-muted-foreground hover:bg-muted")}>Conversation</button>
        <button type="button" role="tab" aria-selected={mobileView === "settings"} onClick={() => setMobileView("settings")} className={cn("min-h-11 rounded-lg border px-3 text-sm font-semibold transition-colors", mobileView === "settings" ? "border-primary/60 bg-primary text-primary-foreground shadow-sm" : "border-transparent text-muted-foreground hover:bg-muted")}>Settings</button>
      </div>

      <div className="hidden flex-col gap-6 xl:flex">
        <BackLink />
        <AgentHeader agent={agent} onRefresh={refresh} refreshing={agentsQuery.isFetching} walletAddress={address ?? ""} />
      </div>

      <section role="tabpanel" aria-label="Conversation" className={cn(agentDetailResponsiveLayout.conversationBase, mobileView === "conversation" ? agentDetailResponsiveLayout.conversationActive : "hidden")}>

      {agent.status === "provisioning" ||
      agent.status === "failed" ||
      (agent.status === "ready" && !agent.bridgeConnected && !agent.invited) ? (
        <section className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <h2 className="mb-2 text-sm font-medium text-foreground">
            {t("agentDetail.whatHappensNext")}
          </h2>
          <ProvisionPipeline
            status={agent.status}
            bridgeConnected={agent.bridgeConnected}
          />
        </section>
      ) : null}

      {!isExternalAgent(agent) ? (
        <AutoWakeBanner
          agentId={agent.id}
          agentName={agent.name}
          ecsDeployed={agent.status === "ready"}
        />
      ) : null}

      <AgentVoiceCallController agentId={agent.id} agentName={agent.name} project={voiceProject} chatCommitScopeKind="direct" />

      <AgentChatPanel
        agentId={agent.id}
        agentName={agent.name}
        chatEnabled={agent.status === "ready"}
        hibernationEnabled={agent.status === "ready" && !isExternalAgent(agent)}
        externalAgent={isExternalAgent(agent)}
        runtimeKind={agent.runtime}
        runtimeAvailability={isExternalAgent(agent)
          ? externalRuntimeAvailability(agent)
          : undefined}
      />

      </section>

      <section role="tabpanel" aria-label="Settings" className={cn(agentDetailResponsiveLayout.settingsBase, mobileView === "settings" ? "flex" : "hidden")}>
      <div className="flex flex-col gap-4 xl:hidden">
        <BackLink />
        <AgentHeader agent={agent} onRefresh={refresh} refreshing={agentsQuery.isFetching} walletAddress={address ?? ""} />
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <MetadataCard agent={agent} />
        {!isExternalAgent(agent) ? <CapabilitiesCard capabilities={capabilities} /> : null}
      </section>

      <ChannelsSection
        channels={channels}
        runtime={agent.runtime}
        loading={gatewaysQuery.isLoading}
        error={gatewaysQuery.error instanceof Error ? gatewaysQuery.error.message : undefined}
      />

      {agent.invited ? <InvitedCredentialPanel agent={agent} /> : null}

      {agent.invited ? (
        <VoiceCredentialDeliveryPanel
          agentId={agent.id}
          agentName={agent.name}
          owner={Boolean(address) && address!.toLowerCase() === agent.walletAddress.toLowerCase()}
        />
      ) : null}

      <WebhookPanel agent={agent} />

      <TeamPanel agent={agent} />

      {!isExternalAgent(agent) ? (
        <HibernationPanel
          agentId={agent.id}
          agentName={agent.name}
          ecsDeployed={agent.status === "ready"}
        />
      ) : null}

      {!isExternalAgent(agent) ? (
        <UpgradePanel
          agentId={agent.id}
          agentName={agent.name}
          ecsDeployed={agent.status === "ready"}
        />
      ) : null}

      <TasksSection
        tasks={assignedTasks}
        ready={projectDetailsReady}
        agentName={agent.name}
      />

      <AgentActivitySection agentName={agent.name} walletAddress={address} />

      <BacklinksPanel
        walletAddress={address}
        entityKey={entityKey.agent(agent.name)}
      />

      <ActionsPanel agent={agent} />
      </section>
    </div>
  );
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link
      href="/agents"
      className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {t("agentDetail.backLink")}
    </Link>
  );
}

/**
 * External = the user's own hosting (invited / self-hosted / imported BYO).
 * Hibernation/wake/upgrade are ECS-only (PerkOS infra), so they don't apply.
 */
function isExternalAgent(a: { external?: boolean; deployMode?: string | null }): boolean {
  return (
    a.external === true ||
    a.deployMode === "invited" ||
    a.deployMode === "self-hosted" ||
    a.deployMode === "imported"
  );
}

export function agentHeaderActionPolicy(input: { external: boolean; authorized: boolean }) {
  return {
    refreshLabel: "Refresh status",
    showManage: !input.external && input.authorized,
    manageLabel: "Manage agent",
  } as const;
}

function AgentHeader({
  agent,
  onRefresh,
  refreshing,
  walletAddress,
}: {
  agent: AgentRow;
  onRefresh: () => void;
  refreshing: boolean;
  walletAddress: string;
}) {
  const { t } = useTranslation();
  const [editOpen, setEditOpen] = useState(false);
  const queryClient = useQueryClient();
  const isExternal = isExternalAgent(agent);
  const externalAvailability = isExternal
    ? externalRuntimeAvailability(agent)
    : undefined;
  const displayName = agent.displayName ?? agent.name;
  const actionPolicy = agentHeaderActionPolicy({ external: isExternal, authorized: Boolean(walletAddress) });

  // "Stop" hibernates the agent (ECS scale-to-0). It's reversible — the next
  // chat message wakes it — so no confirm dialog; the toast says as much.
  // Only offered while the agent is Online (status==="ready").
  const stopMutation = useMutation({
    mutationFn: () => hibernateAgentApi({ agentId: agent.id }),
    onSuccess: (result) => {
      toast.success(
        result.previousDesiredCount === 0
          ? t("agentDetail.header.alreadyStopped", { name: agent.name })
          : t("agentDetail.header.stopping", { name: agent.name })
      );
      // Optimistically flip to "hibernating" so the badge updates instantly and
      // the chat panel's status poll kicks in. Without this the live ECS status
      // lags the drain (desiredCount=0 but the task takes up to ~2 min to stop),
      // so the cached "active" would otherwise leave the badge stuck on "Online".
      queryClient.setQueryData<HibernationStatus>(
        ["agent-hibernation", agent.id],
        (old) => (old ? { ...old, state: "hibernating" } : old)
      );
      queryClient.invalidateQueries({ queryKey: ["agent-hibernation", agent.id] });
      queryClient.invalidateQueries({ queryKey: ["wallet-agents", walletAddress] });
    },
    onError: (err: Error) =>
      toast.error(t("agentDetail.header.stopError"), { description: err.message }),
  });

  // Hibernation state lives in a separate live query (shared cache with the
  // HibernationPanel / AutoWakeBanner). It takes priority over `agent.status`:
  // a scaled-to-0 agent still reads status==="ready" in Firestore, so without
  // this the header would show "Online" + a "Stop" button on a sleeping agent.
  const hibQuery = useQuery({
    queryKey: ["agent-hibernation", agent.id],
    queryFn: () => getHibernationStatusApi({ agentId: agent.id }),
    enabled: agent.status === "ready" && !isExternal,
  });
  const hibState = hibQuery.data?.state;
  // While the live hibernation status is still loading we don't yet know if a
  // "ready" agent is actually running or hibernated — show a neutral "Syncing…"
  // instead of flashing "Online" then snapping to "Hibernated".
  const hibSyncing = agent.status === "ready" && hibQuery.isLoading;
  const sleeping =
    hibState === "hibernated" ||
    hibState === "hibernating" ||
    hibState === "waking";
  // Only offer Stop once we KNOW it's running (not mid-sync) — avoids a
  // Stop button flashing in then disappearing on a hibernated agent. External
  // agents (own infra) are never hibernatable, so never show Stop.
  const isRunning =
    agent.status === "ready" && !sleeping && !hibSyncing && !isExternal;

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="relative">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-base font-medium text-primary">
            {initials(displayName)}
          </div>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 grid h-3 w-3 place-items-center rounded-full ring-2 ring-background",
              isRunning || externalAvailability === "online"
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
            {displayName}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={isExternal ? "border-sky-400/40 text-sky-200" : "border-violet-400/40 text-violet-200"}>
              {isExternal ? "External agent" : "PerkOS infrastructure"}
            </Badge>
            <Badge variant="secondary" className="border-0 bg-muted">
              {agent.runtime}
            </Badge>
            <StatusBadge
              status={agent.status}
              external={isExternal}
              bridgeConnected={agent.bridgeConnected}
              lastBridgeSeenAt={agent.lastBridgeSeenAt}
              runtimeStatus={agent.runtimeStatus}
              runtimeHealthCheckedAt={agent.runtimeHealthCheckedAt}
              hibernationState={hibState}
              syncing={hibSyncing}
            />
          </div>
          {isExternal && externalAvailability && externalAvailability !== "unverified" ? (
            <p className="max-w-xl text-xs text-muted-foreground">
              Declared availability: {externalAvailability}. Runtime, skills, and provider configuration remain owner-operated.
            </p>
          ) : !isExternal ? (
            <p className="max-w-xl text-xs text-muted-foreground">
              Hosted and operated on PerkOS infrastructure. Authorized controls and declared capabilities appear below.
            </p>
          ) : null}
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
            {t("agentDetail.header.stop")}
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
          {actionPolicy.refreshLabel}
        </Button>
        {actionPolicy.showManage ? <Button
          variant="outline"
          size="sm"
          onClick={() => setEditOpen(true)}
          disabled={!walletAddress}
          className="gap-1.5"
        >
          <Pencil className="h-3.5 w-3.5" />
          {actionPolicy.manageLabel}
        </Button> : null}
      </div>

      {actionPolicy.showManage ? (
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
  external,
  bridgeConnected,
  lastBridgeSeenAt,
  runtimeStatus,
  runtimeHealthCheckedAt,
  hibernationState,
  syncing,
}: {
  status: Agent["status"];
  external?: boolean;
  bridgeConnected?: boolean;
  lastBridgeSeenAt?: string | null;
  runtimeStatus?: AgentRow["runtimeStatus"];
  runtimeHealthCheckedAt?: string | null;
  hibernationState?: HibernationApiState;
  syncing?: boolean;
}) {
  const { t } = useTranslation();
  if (external && status === "ready") {
    const availability = externalRuntimeAvailability({
      bridgeConnected,
      lastBridgeSeenAt,
      runtimeStatus,
      runtimeHealthCheckedAt,
    });
    const state = availability === "online"
      ? { tone: "bg-emerald-500/20 text-emerald-300", label: t("agentDetail.status.online") }
      : availability === "unavailable"
        ? { tone: "bg-red-500/20 text-red-300", label: "Runtime unavailable" }
        : availability === "unverified"
          ? { tone: "bg-amber-500/20 text-amber-300", label: "Runtime unverified" }
          : { tone: "bg-muted text-muted-foreground", label: t("agentDetail.status.offline") };
    return (
      <Badge variant="secondary" className={cn("border-0", state.tone)}>
        {state.label}
      </Badge>
    );
  }
  // Don't assert "Online" while the live hibernation status is still loading —
  // it may resolve to "Hibernated". Show a neutral syncing state instead.
  if (syncing) {
    return (
      <Badge
        variant="secondary"
        className="inline-flex items-center gap-1 border-0 bg-muted text-muted-foreground"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        {t("agentDetail.status.syncing")}
      </Badge>
    );
  }
  // A hibernated/waking ECS agent still reports status==="ready", so surface
  // the live hibernation state instead of a misleading "Online".
  if (status === "ready" && hibernationState && hibernationState !== "active") {
    const sleep =
      hibernationState === "hibernated"
        ? { tone: "bg-slate-500/20 text-slate-300", label: t("agentDetail.status.hibernated") }
        : hibernationState === "hibernating"
        ? { tone: "bg-amber-500/20 text-amber-300", label: t("agentDetail.status.hibernating") }
        : { tone: "bg-sky-500/20 text-sky-300", label: t("agentDetail.status.waking") };
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
      ? t("agentDetail.status.online")
      : status === "failed"
      ? t("agentDetail.status.failed")
      : status === "provisioning"
      ? t("agentDetail.status.provisioning")
      : t("agentDetail.status.unknown");
  return (
    <Badge variant="secondary" className={cn("border-0", tone)}>
      {label}
    </Badge>
  );
}

/**
 * The agent's slice of the workspace activity stream — what THIS agent did
 * recently, in plain language. Client-side filter over the latest events
 * (no composite index needed at this volume).
 */
function AgentActivitySection({
  agentName,
  walletAddress,
}: {
  agentName: string;
  walletAddress?: string;
}) {
  const { t } = useTranslation();
  const { events } = useActivityFeed(walletAddress, 150);
  const mine = events.filter((e) => e.actor === agentName).slice(0, 8);
  if (mine.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("agentDetail.activity.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col">
          {mine.map((e) => (
            <li
              key={e.id}
              className="flex items-baseline gap-1.5 border-b border-border/40 py-2 text-xs last:border-0"
            >
              <span className="text-muted-foreground">{verbPhrase(e.verb, t)}</span>
              <span className="min-w-0 flex-1 truncate text-foreground/90">
                {e.object}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {e.tsMs ? formatRelativeShort(new Date(e.tsMs)) : ""}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function MetadataCard({ agent }: { agent: AgentRow }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("agentDetail.metadata.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <MetaRow Icon={Bot} label={t("agentDetail.metadata.agentId")}>
          <span className="font-mono">{formatAddress(agent.id)}</span>
        </MetaRow>
        <MetaRow Icon={Wallet} label={t("agentDetail.metadata.ownerWallet")}>
          <span className="font-mono">{formatAddress(agent.walletAddress)}</span>
        </MetaRow>
        <MetaRow Icon={Calendar} label={t("agentDetail.metadata.created")}>
          {formatDate(agent.createdAt)}
        </MetaRow>
        <MetaRow Icon={Calendar} label={t("agentDetail.metadata.lastActive")}>
          {agent.lastBridgeSeenAt ? (
            <span title={agent.lastBridgeSeenAt}>
              {formatRelativeShort(agent.lastBridgeSeenAt)}
              {hasFreshAgentHeartbeat(agent) ? (
                <span className="ml-1.5 text-emerald-300">{t("agentDetail.metadata.connectedNow")}</span>
              ) : null}
            </span>
          ) : (
            <span className="text-muted-foreground">{t("agentDetail.metadata.neverConnected")}</span>
          )}
        </MetaRow>
        <MetaRow Icon={Server} label={t("agentDetail.metadata.endpoint")}>
          {agent.endpoint ? (
            <span className="break-all font-mono text-xs">
              {agent.endpoint}
            </span>
          ) : (
            <span className="text-muted-foreground">{t("agentDetail.metadata.notProvisioned")}</span>
          )}
        </MetaRow>
        <MetaRow Icon={Boxes} label={t("agentDetail.metadata.runtimeVersion")}>
          {agent.upstreamVersion ? (
            <span className="font-mono text-xs">
              {agent.runtime} {agent.upstreamVersion}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </MetaRow>
        {isExternalAgent(agent) ? (
          <MetaRow Icon={Server} label="Runtime health">
            <span className={cn(
              "text-xs",
              agent.runtimeStatus === "healthy"
                ? "text-emerald-300"
                : agent.runtimeStatus === "unreachable"
                  ? "text-red-300"
                  : "text-amber-300",
            )}>
              {agent.runtimeStatus === "healthy"
                ? "Available"
                : agent.runtimeStatus === "unreachable"
                  ? "Unavailable"
                  : "Unverified"}
            </span>
          </MetaRow>
        ) : null}
        <MetaRow Icon={KeyRound} label={t("agentDetail.metadata.modelKey")}>
          {isExternalAgent(agent) ? (
            <span className="text-muted-foreground">{t("agentDetail.metadata.runtimeOwned")}</span>
          ) : agent.modelKeyProvided ? (
            <span className="text-emerald-300">{t("agentDetail.metadata.byok")}</span>
          ) : (
            <span className="text-muted-foreground">{t("agentDetail.metadata.perkosManaged")}</span>
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
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4 text-muted-foreground" />
          {t("agentDetail.capabilities.title")}
        </CardTitle>
        <CardDescription>
          {t("agentDetail.capabilities.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {capabilities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("agentDetail.capabilities.empty")}
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
  loading,
  error,
}: {
  channels: AgentGatewayView[];
  runtime: string;
  loading: boolean;
  error?: string;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("agentDetail.channels.title")}</CardTitle>
        <CardDescription>
          {t("agentDetail.channels.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading channels…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("agentDetail.channels.none", { runtime })}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {channels.map((channel) => {
              const channelMeta = CHANNEL_LABELS[channel.type];
              const Icon = channelMeta?.Icon ?? MessageSquare;
              return (
              <li
                key={channel.adapterId ?? channel.type}
                className="flex flex-col gap-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span>{channelMeta?.label ?? channel.type}</span>
                  <Badge variant="outline" className="ml-auto capitalize">
                    {channel.status}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {channel.framework ?? runtime} · {channel.transportMode ?? "native"}
                  {channel.requiresAlwaysOn ? " · always on" : ""}
                </span>
                {channel.statusMessage ? (
                  <span className="text-xs text-muted-foreground">
                    {channel.statusMessage}
                  </span>
                ) : null}
              </li>
              );
            })}
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
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("agentDetail.tasks.title", { name: agentName })}</CardTitle>
        <CardDescription>
          {t("agentDetail.tasks.description")}
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
            {t("agentDetail.tasks.empty")}
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
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { address } = useAppAccount();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!address) throw new Error(t("agentDetail.lifecycle.connectWallet"));
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
      toast.success(t("agentDetail.lifecycle.deletedTitle"), {
        description: hasWarnings
          ? t("agentDetail.lifecycle.deletedWithWarnings", { name: agent.name })
          : t("agentDetail.lifecycle.deleted", { name: agent.name }),
      });
      router.replace("/agents");
    },
    onError: (err: Error) => {
      toast.error(t("agentDetail.lifecycle.deleteError"), { description: err.message });
      setConfirmOpen(false);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("agentDetail.lifecycle.title")}</CardTitle>
        <CardDescription>
          {t("agentDetail.lifecycle.description")}
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
          {t("agentDetail.lifecycle.delete")}
        </Button>
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("agentDetail.lifecycle.confirmTitle", { name: agent.name })}
        description={t("agentDetail.lifecycle.confirmDescription")}
        confirmLabel={t("agentDetail.lifecycle.confirmLabel")}
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
