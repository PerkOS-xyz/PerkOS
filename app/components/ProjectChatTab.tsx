"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Crown,
  Loader2,
  MessageSquarePlus,
  PanelRightClose,
  PanelRightOpen,
  Play,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAppAccount } from "../lib/useAppAccount";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ProjectDetail } from "../lib/perkosApi";
import {
  approvePlan,
  createProjectChatThread,
  ensureProjectChat,
  listProjectChatThreads,
  mentionAgent,
  notifyProjectMention,
  pmTurn,
  requestPlanChanges,
} from "../lib/perkosApi";
import type { ChatIdentity } from "../lib/chatClient";
import {
  useChatClient,
  useChatClientStatus,
  useChatHistory,
  useConversationLiveMessages,
} from "../lib/useChatClient";
import { extractMentions } from "../lib/mentions";
import { useMentionParticipants } from "../lib/useMentionParticipants";
import {
  realtimeAgentStatus,
  STATUS_AVAILABLE,
  STATUS_RESTING,
  type AgentLiveStatus,
  useWalletAgents,
} from "../lib/useWalletAgents";
import { formatRelativeShort } from "../lib/format";
import { entityKey, writeEdge } from "../lib/edges";
import { uploadAttachment } from "../lib/uploadAttachment";
import { projectChatAvailableHeight } from "../lib/projectChatLayout";
import { putMessages as cacheMessages } from "../lib/chatCache";
import { ChatComposer } from "./ChatComposer";
import {
  ConversationMessages,
  type OptimisticMessage,
} from "./ConversationMessages";
import { OfflineBanner } from "./OfflineBanner";
import { AgentOrb } from "./AgentOrb";

export function ProjectChatTab({
  detail,
  projectId,
  ownerWallet,
  onDesignatePm,
}: {
  detail: ProjectDetail;
  projectId: string;
  ownerWallet?: string;
  onDesignatePm: () => void;
}) {
  const { address, isConnected } = useAppAccount();
  const client = useChatClient();
  const queryClient = useQueryClient();
  const { status } = useChatClientStatus();
  const [draft, setDraft] = useState("");
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [changeRequestPlanId, setChangeRequestPlanId] = useState<string | null>(null);
  const [teamCollapsed, setTeamCollapsed] = useState(false);
  const [mobileTeamOpen, setMobileTeamOpen] = useState(false);
  const chatSectionRef = useRef<HTMLElement>(null);
  const shared = Boolean(
    ownerWallet && ownerWallet.toLowerCase() !== (address ?? "").toLowerCase(),
  );
  const owner = shared ? ownerWallet : undefined;
  const participants = useMentionParticipants(detail, projectId, ownerWallet);
  const { byName: liveAgents } = useWalletAgents(ownerWallet ?? address);
  const pmAgent = detail.project.pmAgent ?? null;
  const workflowPhase = detail.project.workflow?.phase ?? "draft";
  const canStartPlanning = ["draft", "cancelled"].includes(workflowPhase);
  const docsHref = owner
    ? `/projects/${projectId}?owner=${encodeURIComponent(owner)}&tab=docs`
    : `/projects/${projectId}?tab=docs`;

  const conversationQuery = useQuery({
    queryKey: ["project-chat", projectId, owner],
    queryFn: () => ensureProjectChat({ projectId, owner }),
    enabled: Boolean(address),
  });
  const threadsQuery = useQuery({
    queryKey: ["project-chat-threads", projectId, owner],
    queryFn: () => listProjectChatThreads({ projectId, owner }),
    enabled: Boolean(address),
  });
  const convId = activeConvId ?? conversationQuery.data?.convId ?? null;
  const live = useConversationLiveMessages(convId);
  const historyState = useChatHistory(convId);
  const liveIds = useMemo(() => new Set(live.map((message) => message.id)), [live]);
  const pending = useMemo(
    () => optimistic.filter((message) => !liveIds.has(message.id)),
    [optimistic, liveIds],
  );

  const newChat = useMutation({
    mutationFn: () => createProjectChatThread({ projectId, owner }),
    onSuccess: ({ convId: next }) => {
      setActiveConvId(next);
      setOptimistic([]);
      setSendError(null);
      void queryClient.invalidateQueries({ queryKey: ["project-chat-threads", projectId, owner] });
      toast.success("New project chat started");
    },
    onError: (error: Error) => toast.error("Couldn't start a new chat", { description: error.message }),
  });

  const startPlanning = useMutation({
    mutationFn: () => pmTurn({ projectId, trigger: "run-button", owner }),
    onSuccess: () => toast.success("PM is preparing a plan for approval"),
    onError: (error: Error) => toast.error("Couldn't start planning", { description: error.message }),
  });

  const approve = useMutation({
    mutationFn: (planId: string) => approvePlan({ projectId, docId: planId, owner }),
    onSuccess: ({ created }) => {
      toast.success(`Plan approved · ${created} task${created === 1 ? "" : "s"} started`);
      void queryClient.invalidateQueries({ queryKey: ["wallet-project", ownerWallet ?? address, projectId] });
    },
    onError: (error: Error) => toast.error("Couldn't approve the plan", { description: error.message }),
  });

  const requestChanges = useMutation({
    mutationFn: ({ planId, text }: { planId: string; text: string }) =>
      requestPlanChanges({ projectId, docId: planId, text, owner }),
    onSuccess: ({ chatId }, { text }) => {
      if (chatId && address && convId) {
        void cacheMessages(address, convId, [{
          id: chatId,
          from: `user:${address.toLowerCase()}`,
          text,
          timestamp: new Date().toISOString(),
        }]).catch(() => {});
      }
      setChangeRequestPlanId(null);
      toast.success("Changes sent to the PM");
      void queryClient.invalidateQueries({ queryKey: ["wallet-project", ownerWallet ?? address, projectId] });
    },
    onError: (error: Error) => toast.error("Couldn't request changes", { description: error.message }),
  });

  function send(text: string) {
    if (!client || !convId || !address || status !== "connected") return;
    if (changeRequestPlanId) {
      requestChanges.mutate({ planId: changeRequestPlanId, text });
      setDraft("");
      return;
    }
    setSendError(null);
    const mentions = extractMentions(text, participants) as ChatIdentity[];
    const targets: ChatIdentity[] | undefined =
      mentions.length > 0
        ? mentions
        : pmAgent
          ? [`agent:${pmAgent}`]
          : undefined;
    const id = client.send({
      convId,
      text,
      targets,
      onAck: (ack) => {
        setOptimistic((prev) =>
          prev.map((message) =>
            message.id === ack.id ? { ...message, pending: false } : message,
          ),
        );
        void cacheMessages(address, convId, [{
          id: ack.id,
          from: `user:${address.toLowerCase()}`,
          text,
          timestamp: ack.timestamp,
        }]).catch(() => {});
        // A resting PM has no chat socket. When PerkOS-Chat confirms nobody
        // received the message, start the PM workflow so it wakes the agent
        // and advances planning. An online PM already received the chat
        // message, so dispatching a second A2A turn here would duplicate work.
        if (ack.delivered === 0 && pmAgent && mentions.length === 0) {
          void pmTurn({ projectId, trigger: "chat", owner }).catch((error: Error) => {
            toast.error("The PM couldn't process this message", {
              description: error.message,
            });
          });
        }

        // A resting explicitly-mentioned agent has no chat socket. Wake and
        // deliver through A2A only when PerkOS-Chat confirms nobody received it.
        if (ack.delivered === 0) {
          for (const identity of mentions) {
            if (identity.startsWith("agent:")) {
              void mentionAgent({
                projectId,
                agentName: identity.slice("agent:".length),
                text,
                owner,
              });
            }
          }
        }
      },
    });
    setOptimistic((prev) => [
      ...prev,
      {
        id,
        convId,
        from: `user:${address.toLowerCase()}`,
        text,
        timestamp: new Date().toISOString(),
        pending: true,
      },
    ]);
    // The chat router does not echo a user's frame back to that same socket.
    // Persist the optimistic copy immediately so reload/thread switching does
    // not erase an accepted human message.
    void cacheMessages(address, convId, [{
      id,
      from: `user:${address.toLowerCase()}`,
      text,
      timestamp: new Date().toISOString(),
    }]).catch(() => {});
    setDraft("");

    for (const identity of mentions) {
      void writeEdge(ownerWallet ?? address, {
        fromKey: entityKey.user(address),
        toKey: identity,
        rel: "mentions",
        projectId,
        sourceRef: id,
        sourceLabel: text.slice(0, 80),
      });
      if (identity.startsWith("user:") && identity !== `user:${address.toLowerCase()}`) {
        void notifyProjectMention({
          projectId,
          target: identity.slice("user:".length),
          title: "You were mentioned in a project chat",
          body: text.slice(0, 200),
          href: `/projects/${projectId}?tab=chat`,
          owner,
        });
      }
    }
  }

  const disabled = !isConnected || !convId || status !== "connected";
  const disabledReason = conversationQuery.isLoading
    ? "Opening project chat…"
    : status !== "connected"
      ? "Connecting to PerkOS Chat…"
      : !pmAgent
        ? "Designate a PM or mention an agent"
        : undefined;

  // The project header, app chrome and mobile bottom nav all have dynamic
  // heights. A viewport-only calc therefore makes the composer land below the
  // screen on small devices. Measure the section's real top edge and size it to
  // the visible navigation boundary instead. Desktop keeps its stable two-pane
  // height; this measurement only applies below the lg breakpoint.
  useEffect(() => {
    const section = chatSectionRef.current;
    if (!section) return;

    const mobile = window.matchMedia("(max-width: 1023px)");
    const updateHeight = () => {
      if (!mobile.matches) {
        section.style.removeProperty("--project-chat-available-height");
        return;
      }

      const bottomNav = document.querySelector<HTMLElement>(
        "[data-mobile-bottom-nav]",
      );
      const viewportBottom = bottomNav?.getBoundingClientRect().top
        ?? window.visualViewport?.height
        ?? window.innerHeight;
      const height = projectChatAvailableHeight({
        sectionTop: section.getBoundingClientRect().top,
        viewportBottom,
      });
      section.style.setProperty(
        "--project-chat-available-height",
        `${height}px`,
      );
    };

    updateHeight();
    const resizeObserver = new ResizeObserver(updateHeight);
    const mainContent = document.querySelector<HTMLElement>("#main-content");
    if (mainContent) resizeObserver.observe(mainContent);
    window.addEventListener("resize", updateHeight);
    window.addEventListener("scroll", updateHeight, { passive: true });
    window.visualViewport?.addEventListener("resize", updateHeight);
    mobile.addEventListener("change", updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateHeight);
      window.removeEventListener("scroll", updateHeight);
      window.visualViewport?.removeEventListener("resize", updateHeight);
      mobile.removeEventListener("change", updateHeight);
    };
  }, []);

  return (
    <div
      className={cn(
        "relative grid min-h-0 grid-cols-1 gap-3",
        !teamCollapsed && "lg:grid-cols-[minmax(0,1fr)_320px]",
      )}
    >
      <section
        ref={chatSectionRef}
        data-project-chat
        className="flex h-[var(--project-chat-available-height,calc(100dvh-15.5rem))] min-h-72 min-w-0 flex-col overflow-hidden rounded-md border border-border bg-background lg:h-[calc(100dvh-20rem)] lg:min-h-[28rem]"
      >
        <header className="flex shrink-0 flex-col gap-2 border-b border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between md:px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium"># {detail.project.name}</p>
            <p className="text-xs text-muted-foreground">
              {pmAgent ? `${pmAgent} coordinates this project` : "No PM designated"}
            </p>
          </div>
          <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
            <label className="min-w-0 flex-1 sm:max-w-48">
              <span className="sr-only">Conversation history</span>
              <select
                value={convId ?? ""}
                onChange={(event) => {
                  setActiveConvId(event.target.value);
                  setOptimistic([]);
                  setSendError(null);
                }}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                aria-label="Conversation history"
              >
                {threadsQuery.data?.map((thread, index) => (
                  <option key={thread.convId} value={thread.convId}>
                    {formatThreadLabel(thread, index === 0)}
                  </option>
                ))}
                {!threadsQuery.data?.some((thread) => thread.convId === convId) && convId ? (
                  <option value={convId}>Current chat</option>
                ) : null}
              </select>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 lg:hidden"
              aria-expanded={mobileTeamOpen}
              aria-controls="project-team-mobile"
              onClick={() => setMobileTeamOpen(true)}
            >
              <Users className="h-3.5 w-3.5" />
              Team
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 lg:inline-flex"
              aria-label={teamCollapsed ? "Show project team" : "Hide project team"}
              aria-expanded={!teamCollapsed}
              onClick={() => setTeamCollapsed((collapsed) => !collapsed)}
            >
              {teamCollapsed ? (
                <PanelRightOpen className="h-4 w-4" />
              ) : (
                <PanelRightClose className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={newChat.isPending}
              onClick={() => newChat.mutate()}
            >
              {newChat.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquarePlus className="h-3.5 w-3.5" />}
              New chat
            </Button>
            {canStartPlanning ? (
              <Button
                size="sm"
                className="col-span-3 w-full gap-1.5 sm:w-auto"
                disabled={!pmAgent || startPlanning.isPending}
                onClick={() => startPlanning.mutate()}
              >
                {startPlanning.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Plan with PM
              </Button>
            ) : null}
          </div>
        </header>
        {workflowPhase === "awaiting_approval" ? (
          <div className="flex shrink-0 flex-col gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span>The PM&apos;s plan is ready for your decision.</span>
            <div className="flex gap-2">
              {detail.project.workflow?.planId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 flex-1 sm:flex-none"
                  onClick={() => {
                    setChangeRequestPlanId(detail.project.workflow?.planId ?? null);
                    setDraft("");
                  }}
                >
                  Request changes
                </Button>
              ) : null}
              <Link href={docsHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 flex-1 sm:flex-none")}>
                Review in Docs
              </Link>
            </div>
          </div>
        ) : ["approved", "running", "pm_review"].includes(workflowPhase) ? (
          <div className="shrink-0 border-b border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            The approved plan is in progress. Task and PM updates appear here.
          </div>
        ) : workflowPhase === "complete" ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
            <span>Project work is complete.</span>
            <Link href={docsHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open final doc
            </Link>
          </div>
        ) : null}
        {historyState.hostOffline && convId ? (
          <OfflineBanner historyHost={`agent:${pmAgent ?? "unknown"}`} fromCache={historyState.fromCache} />
        ) : null}
        <ConversationMessages
          history={historyState.history}
          live={live}
          pending={pending}
          walletAddress={address ?? ""}
          loadingInitial={conversationQuery.isLoading || historyState.loadingInitial}
          loadingMore={historyState.loadingMore}
          hasMore={historyState.hasMore}
          onLoadOlder={historyState.loadOlder}
          error={conversationQuery.error as Error | null ?? historyState.error}
          onApprovePlan={(planId) => approve.mutate(planId)}
          onRequestPlanChanges={(planId) => {
            setChangeRequestPlanId(planId);
            setDraft("");
          }}
          approvingPlanId={approve.isPending ? approve.variables ?? null : null}
          actionablePlanId={
            workflowPhase === "awaiting_approval"
              ? detail.project.workflow?.planId ?? null
              : null
          }
        />
        {changeRequestPlanId ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
            <span>Describe what the PM should change in this plan.</span>
            <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setChangeRequestPlanId(null)}>
              Cancel
            </Button>
          </div>
        ) : null}
        {sendError ? <p className="shrink-0 px-4 py-2 text-xs text-destructive">{sendError}</p> : null}
        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSend={send}
          disabled={disabled || requestChanges.isPending}
          placeholder={changeRequestPlanId ? "Describe the requested plan changes…" : disabledReason ?? `Message ${pmAgent ?? "the project team"}…`}
          uploadFile={
            address && convId
              ? (file, index) => uploadAttachment({ file, walletAddress: address, conversationId: convId, index })
              : undefined
          }
          className="relative z-10 shrink-0 border-t border-border bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.16)] backdrop-blur"
        />
      </section>

      {!teamCollapsed ? (
        <ProjectTeamPanel
          className="hidden min-h-0 lg:flex"
          participants={participants}
          liveAgents={liveAgents}
          pmAgent={pmAgent}
          currentWallet={address}
          chatConnected={status === "connected"}
          onDesignatePm={onDesignatePm}
        />
      ) : null}

      {mobileTeamOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end p-2 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-background/75 backdrop-blur-sm"
            aria-label="Close project team"
            onClick={() => setMobileTeamOpen(false)}
          />
          <ProjectTeamPanel
            id="project-team-mobile"
            className="relative z-10 h-full w-[min(20rem,calc(100vw-1rem))] rounded-md shadow-2xl"
            participants={participants}
            liveAgents={liveAgents}
            pmAgent={pmAgent}
            currentWallet={address}
            chatConnected={status === "connected"}
            onDesignatePm={onDesignatePm}
            onClose={() => setMobileTeamOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

function formatThreadLabel(
  thread: { title: string; createdAt: string | null },
  latest: boolean,
): string {
  const date = thread.createdAt ? new Date(thread.createdAt) : null;
  const stamp = date && !Number.isNaN(date.getTime())
    ? date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "Saved chat";
  return `${latest ? "Latest · " : ""}${thread.title} · ${stamp}`;
}

export function findLiveAgent(
  name: string,
  liveAgents: Record<string, AgentLiveStatus>,
): AgentLiveStatus | undefined {
  const target = name.trim().toLocaleLowerCase();
  return Object.values(liveAgents).find(
    (agent) => agent.name.trim().toLocaleLowerCase() === target,
  );
}

function humanInitials(label: string): string {
  const words = label.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return "?";
  return words.slice(0, 2).map((word) => word[0]?.toLocaleUpperCase() ?? "").join("");
}

export function ProjectTeamPanel({
  id,
  className,
  participants,
  liveAgents,
  pmAgent,
  currentWallet,
  chatConnected,
  onDesignatePm,
  onClose,
}: {
  id?: string;
  className?: string;
  participants: ReturnType<typeof useMentionParticipants>;
  liveAgents: Record<string, AgentLiveStatus>;
  pmAgent: string | null;
  currentWallet?: string;
  chatConnected: boolean;
  onDesignatePm: () => void;
  onClose?: () => void;
}) {
  const availableAgents = participants.filter((participant) => {
    if (participant.kind !== "agent") return false;
    const live = findLiveAgent(participant.label, liveAgents);
    return realtimeAgentStatus(live).label === STATUS_AVAILABLE;
  }).length;
  const agentCount = participants.filter((participant) => participant.kind === "agent").length;
  const currentIdentity = currentWallet ? `user:${currentWallet.toLowerCase()}` : "";

  return (
    <aside
      id={id}
      className={cn(
        "flex flex-col gap-3 overflow-hidden rounded-md border border-border bg-card p-4",
        className,
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div>
          <span className="text-sm font-medium">Project team</span>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {availableAgents} of {agentCount} agents available
          </p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{participants.length}</span>
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Close project team"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
      {!pmAgent ? (
        <Button size="sm" variant="outline" onClick={onDesignatePm}>Designate PM</Button>
      ) : null}
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {participants.map((participant) => {
          const agentName = participant.kind === "agent" ? participant.id.slice("agent:".length) : "";
          const live = participant.kind === "agent" ? findLiveAgent(agentName, liveAgents) : undefined;
          const presence = realtimeAgentStatus(live);
          const isCoordinator = participant.kind === "agent"
            && pmAgent?.toLocaleLowerCase() === agentName.toLocaleLowerCase();
          const isCurrentUser = participant.id.toLocaleLowerCase() === currentIdentity;
          const detail = participant.kind === "agent"
            ? [live?.runtime, isCoordinator ? "Coordinator" : "Agent"].filter(Boolean).join(" · ")
            : isCurrentUser ? "You · Project member" : "Project member";
          const statusText = participant.kind === "agent"
            ? presence.label
            : isCurrentUser && chatConnected ? "In this chat" : "Member";
          const card = (
            <div className="group flex min-w-0 items-center gap-3 rounded-xl border border-border/80 bg-background/55 px-3 py-2.5 transition-colors hover:border-primary/35 hover:bg-primary/[0.04]">
              <div className="relative shrink-0">
                {participant.kind === "agent" ? (
                  <AgentOrb
                    name={participant.label}
                    presetId={live?.presetId}
                    role={live?.role}
                    size={40}
                    status={presence.label === STATUS_AVAILABLE ? "available" : presence.label === STATUS_RESTING ? "resting" : null}
                  />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-violet-500/15 text-xs font-semibold text-violet-200 ring-1 ring-violet-400/25">
                    {humanInitials(participant.label)}
                  </span>
                )}
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card",
                    participant.kind === "agent"
                      ? presence.color
                      : isCurrentUser && chatConnected
                        ? "bg-emerald-400"
                        : "bg-[#7975a8]",
                  )}
                  aria-hidden
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-foreground">{participant.label}</span>
                  {isCoordinator ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-primary">
                      <Crown className="h-2.5 w-2.5" /> Lead
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-[11px] text-muted-foreground">{detail}</p>
                <p className={cn(
                  "mt-0.5 truncate text-[11px]",
                  statusText === STATUS_AVAILABLE || statusText === "In this chat"
                    ? "text-emerald-400"
                    : presence.label === "Runtime unavailable"
                      ? "text-red-400"
                      : "text-muted-foreground",
                )}>
                  {statusText}
                  {participant.kind === "agent" && statusText !== STATUS_AVAILABLE && live?.lastBridgeSeenMs
                    ? ` · seen ${formatRelativeShort(new Date(live.lastBridgeSeenMs))}`
                    : ""}
                </p>
              </div>
              {participant.kind === "human" ? (
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              ) : null}
            </div>
          );
          return (
            <li key={participant.id}>
              {participant.kind === "agent" && live?.id ? (
                <Link
                  href={`/chat/agent/${encodeURIComponent(live.id)}`}
                  aria-label={`Open chat with ${participant.label}`}
                >
                  {card}
                </Link>
              ) : card}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
