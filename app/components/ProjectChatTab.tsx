"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  MessageSquarePlus,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useConnection } from "wagmi";

import { Button } from "@/components/ui/button";
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
import { entityKey, writeEdge } from "../lib/edges";
import { uploadAttachment } from "../lib/uploadAttachment";
import { projectChatAvailableHeight } from "../lib/projectChatLayout";
import { ChatComposer } from "./ChatComposer";
import {
  ConversationMessages,
  type OptimisticMessage,
} from "./ConversationMessages";
import { OfflineBanner } from "./OfflineBanner";

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
  const { address, isConnected } = useConnection();
  const client = useChatClient();
  const queryClient = useQueryClient();
  const { status } = useChatClientStatus();
  const [draft, setDraft] = useState("");
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [teamCollapsed, setTeamCollapsed] = useState(false);
  const [mobileTeamOpen, setMobileTeamOpen] = useState(false);
  const chatSectionRef = useRef<HTMLElement>(null);
  const shared = Boolean(
    ownerWallet && ownerWallet.toLowerCase() !== (address ?? "").toLowerCase(),
  );
  const owner = shared ? ownerWallet : undefined;
  const participants = useMentionParticipants(detail, projectId);
  const pmAgent = detail.project.pmAgent ?? null;

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
    onSuccess: ({ created }) => toast.success(
      `Plan approved · ${created} task${created === 1 ? "" : "s"} started`,
    ),
    onError: (error: Error) => toast.error("Couldn't approve the plan", { description: error.message }),
  });

  function send(text: string) {
    if (!client || !convId || !address || status !== "connected") return;
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
        !teamCollapsed && "lg:grid-cols-[minmax(0,1fr)_280px]",
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
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
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
                    {index === 0 ? "Latest · " : ""}{thread.title}
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
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!pmAgent || startPlanning.isPending}
              onClick={() => startPlanning.mutate()}
            >
              {startPlanning.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Start
            </Button>
          </div>
        </header>
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
          approvingPlanId={approve.isPending ? approve.variables ?? null : null}
        />
        {sendError ? <p className="shrink-0 px-4 py-2 text-xs text-destructive">{sendError}</p> : null}
        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSend={send}
          disabled={disabled}
          placeholder={disabledReason ?? `Message ${pmAgent ?? "the project team"}…`}
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
          pmAgent={pmAgent}
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
            pmAgent={pmAgent}
            onDesignatePm={onDesignatePm}
            onClose={() => setMobileTeamOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

function ProjectTeamPanel({
  id,
  className,
  participants,
  pmAgent,
  onDesignatePm,
  onClose,
}: {
  id?: string;
  className?: string;
  participants: ReturnType<typeof useMentionParticipants>;
  pmAgent: string | null;
  onDesignatePm: () => void;
  onClose?: () => void;
}) {
  return (
    <aside
      id={id}
      className={cn(
        "flex flex-col gap-3 overflow-hidden rounded-md border border-border bg-card p-4",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <span className="text-sm font-medium">Project team</span>
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
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {participants.map((participant) => (
          <li key={participant.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{participant.label}</span>
            <span className="text-[10px] uppercase text-muted-foreground">{participant.kind}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
