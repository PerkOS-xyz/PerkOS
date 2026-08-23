"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useAppAccount } from "../lib/useAppAccount";
import { useTranslation } from "react-i18next";
import {
  X,
  ArrowUp,
  Plus,
  Folder,
  ListTodo,
  Bot,
  Loader2,
  Copy,
  History,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Mic,
  Paperclip,
  Pause,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useChatPerkosClient } from "../lib/useChatPerkosClient";
import { useSpeechToText } from "../lib/useSpeechToText";
import { useChatbot, type ChatBubble } from "./ChatbotProvider";
import { Markdown } from "./Markdown";
import {
  attachmentMarkdown,
  uploadAttachment,
  type Attachment,
} from "../lib/uploadAttachment";

// `label` holds a translation key, resolved via t() at render.
type QuickAction = {
  id: string;
  label: string;
  href: string;
  Icon: typeof Folder;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "project", label: "chat.assistant.quickActions.project", href: "/projects/new", Icon: Folder },
  { id: "task", label: "chat.assistant.quickActions.task", href: "/tasks/new", Icon: ListTodo },
  { id: "agent", label: "chat.assistant.quickActions.agent", href: "/agents/new", Icon: Bot },
];

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export function ChatbotPanel() {
  const { t } = useTranslation();
  const {
    open,
    setOpen,
    messages,
    appendMessage,
    prependMessages,
    resetConversation,
    convId,
    loadingConv,
    convError,
  } = useChatbot();
  const router = useRouter();
  const { address, isConnected } = useAppAccount();
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Track which message ids the user just sent so the server echo
  // (chat_message broadcast back to all participants, including us)
  // doesn't render a duplicate bubble.
  const sentIdsRef = useRef<Set<string>>(new Set());
  // True while we're waiting for an Assistant reply after sending —
  // toggles the typing bubble. Cleared when any non-self message arrives.
  const [awaitingReply, setAwaitingReply] = useState(false);

  // Dictation (Web Speech API). Appends transcribed phrases to the draft.
  const speech = useSpeechToText({
    onFinal: (chunk) => {
      const cleaned = chunk.trim();
      if (!cleaned) return;
      setDraft((prev) => {
        const sep = !prev || /[.,;:!?\s]$/.test(prev) ? "" : " ";
        return `${prev}${sep}${cleaned}`;
      });
    },
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  const isEmpty = messages.length === 0;

  // WebSocket client. Opens to chat.perkos.xyz when the panel is open
  // and a convId is loaded; routes incoming `chat_message` frames into
  // the message list, skipping echoes of our own sends.
  const chat = useChatPerkosClient({
    convId,
    enabled: open && isConnected,
    onMessage: (msg) => {
      if (sentIdsRef.current.has(msg.id)) {
        // Our own message echoing back from the server broadcast — skip.
        sentIdsRef.current.delete(msg.id);
        return;
      }
      const isFromAgent = msg.from.startsWith("agent:");
      appendMessage({
        id: msg.id,
        role: isFromAgent ? "agent" : "user",
        text: msg.text,
      });
      if (isFromAgent) setAwaitingReply(false);
    },
    onHistory: (chunk) => {
      // history_chunk arrives chronologically (oldest first within the
      // chunk). Map identities to bubble roles + prepend to the list,
      // skipping ids we've already rendered live. We don't request more
      // pages today; one chunk is enough for the typical session.
      const bubbles: ChatBubble[] = chunk.messages.map((m) => ({
        id: m.id,
        role: m.from.startsWith("agent:") ? "agent" : "user",
        text: m.text,
      }));
      prependMessages(bubbles);
    },
  });

  // History is OPT-IN: the panel always opens to a fresh conversation
  // (we no longer auto-pull the server history on auth). The user loads
  // the previous messages on demand via the History button; "Clear" wipes
  // the current view back to the greeting.
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const loadHistory = useCallback(() => {
    if (chat.requestHistory({ limit: 50 })) setHistoryLoaded(true);
  }, [chat]);

  // Re-enable history loading after a wallet switch (new convId) or a
  // fresh panel open, so the button works again on the next session.
  useEffect(() => {
    if (!open || !convId) setHistoryLoaded(false);
  }, [open, convId]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages.length, awaitingReply]);

  // If the WS connection drops, also clear the typing indicator so the
  // user doesn't see a stale "Assistant is typing…" forever.
  useEffect(() => {
    if (!chat.authed) setAwaitingReply(false);
  }, [chat.authed]);

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0 || !address || !convId) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files).map((file, i) =>
          uploadAttachment({
            file,
            walletAddress: address,
            conversationId: convId,
            index: i,
          }),
        ),
      );
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      toast.error(t("chat.composer.uploadFailed"), {
        description: err instanceof Error ? err.message : t("chat.composer.unknownError"),
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(url: string) {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (!isConnected || !address) {
      appendMessage({
        id: genId(),
        role: "agent",
        text: t("chat.assistant.system.connectWallet"),
      });
      return;
    }
    if (loadingConv || !convId) {
      appendMessage({
        id: genId(),
        role: "agent",
        text: t("chat.assistant.system.stillOpening"),
      });
      return;
    }
    if (convError) {
      appendMessage({
        id: genId(),
        role: "agent",
        text: t("chat.assistant.system.openError", { error: convError }),
      });
      return;
    }
    // Compose the outgoing body: text + each attachment as markdown.
    const body = [trimmed, ...attachments.map(attachmentMarkdown)]
      .filter(Boolean)
      .join("\n\n");
    // Optimistically render the user's bubble immediately; the WS
    // server-echo carries the same id which the onMessage handler
    // de-dupes against sentIdsRef.
    const id = chat.send(body);
    sentIdsRef.current.add(id);
    appendMessage({ id, role: "user", text: body });
    setDraft("");
    setAttachments([]);
    setAwaitingReply(true);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send(draft);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(draft);
    }
  }

  function onQuickAction(href: string) {
    setOpen(false);
    router.push(href);
  }

  const lastAgentIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "agent") return i;
    }
    return -1;
  }, [messages]);

  if (!open) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
        aria-hidden
      />

      <div
        role="dialog"
        aria-label="PerkOS"
        className={cn(
          "fixed z-50 flex flex-col border border-primary/40 bg-card shadow-[0_0_32px_rgba(236,27,105,0.25)]",
          // Mobile: near-fullscreen sheet (small gap at the top to peek the page behind)
          "inset-x-0 bottom-0 top-4 rounded-t-2xl",
          // Desktop: corner panel
          "md:inset-auto md:bottom-8 md:right-8 md:top-auto md:h-[600px] md:max-h-[calc(100vh-6rem)] md:w-[400px] md:rounded-2xl"
        )}
      >
        <Header
          title="PerkOS"
          subtitle={
            loadingConv
              ? t("chat.assistant.status.openingChat")
              : chat.error
                ? t("chat.assistant.status.offline")
                : chat.authed
                  ? t("chat.assistant.status.online")
                  : t("chat.assistant.status.connecting")
          }
          onClose={() => setOpen(false)}
          onReset={isEmpty ? undefined : resetConversation}
          onHistory={chat.authed && !historyLoaded ? loadHistory : undefined}
        />

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-4"
        >
          {isEmpty ? (
            <EmptyState onAction={onQuickAction} />
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m, idx) => (
                <Bubble
                  key={m.id}
                  bubble={m}
                  showReactions={m.role === "agent" && idx === lastAgentIndex}
                />
              ))}
              {awaitingReply ? <TypingBubble /> : null}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-card/95 px-5 py-3">
          {speech.error ? (
            <p className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {t("chat.composer.dictationError", { error: speech.error })}
            </p>
          ) : null}

          {attachments.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((a) => (
                <span
                  key={a.url}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
                >
                  {a.isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt="" className="h-5 w-5 rounded object-cover" />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="max-w-[160px] truncate">{a.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(a.url)}
                    aria-label={t("chat.composer.removeAttachment", { name: a.name })}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <form onSubmit={onSubmit}>
            <div className="flex items-end gap-2 rounded-lg border border-input bg-background px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
              <button
                type="button"
                aria-label={t("chat.composer.attachFiles")}
                disabled={uploading || !convId}
                onClick={() => fileInputRef.current?.click()}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
                title={t("chat.composer.attachFiles")}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </button>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
                placeholder={speech.listening ? (speech.interimText || t("chat.composer.listening")) : t("chat.composer.messagePlaceholder")}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
              <div className="flex shrink-0 items-center gap-1">
                {speech.supported ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={speech.toggle}
                    disabled={awaitingReply}
                    className={cn(
                      "h-8 w-8 rounded-full text-muted-foreground hover:text-primary",
                      speech.listening &&
                        "animate-pulse bg-primary/10 text-primary",
                    )}
                    aria-label={speech.listening ? t("chat.composer.pauseDictation") : t("chat.composer.dictate")}
                    title={
                      speech.listening
                        ? t("chat.composer.pauseDictation")
                        : t("chat.composer.dictateWithMic")
                    }
                  >
                    {speech.listening ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  size="icon"
                  disabled={awaitingReply || draft.trim().length === 0}
                  className="h-8 w-8 rounded-full"
                  aria-label={t("chat.composer.send")}
                >
                  {awaitingReply ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function Header({
  title,
  subtitle,
  onClose,
  onReset,
  onHistory,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onReset?: () => void;
  onHistory?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-3">
      <div className="flex items-center gap-2">
        <div className="relative">
          <span className="relative inline-block h-7 w-7 overflow-hidden rounded-full ring-1 ring-primary/40">
            <Image src="/logo.png" alt="PerkOS" fill sizes="28px" className="object-cover" />
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 grid h-2.5 w-2.5 place-items-center rounded-full bg-emerald-500 ring-2 ring-card" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium leading-tight text-foreground">
            {title}
          </span>
          {subtitle ? (
            <span className="text-xs leading-tight text-muted-foreground">
              {subtitle}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {onHistory ? (
          <button
            type="button"
            onClick={onHistory}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
            aria-label={t("chat.assistant.header.loadHistory")}
            title={t("chat.assistant.header.loadHistory")}
          >
            <History className="h-4 w-4" />
          </button>
        ) : null}
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
            aria-label={t("chat.assistant.header.clearAria")}
            title={t("chat.assistant.header.clearTitle")}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
          aria-label={t("chat.assistant.header.close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onAction }: { onAction: (href: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <span className="relative inline-block h-14 w-14 shrink-0 overflow-hidden rounded-full ring-1 ring-primary/40">
          <Image src="/logo.png" alt="PerkOS" fill sizes="56px" className="object-cover" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-medium leading-snug text-foreground">
            {t("chat.assistant.empty.greeting")}
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("chat.assistant.empty.intro")}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {t("chat.assistant.empty.quickActionsLabel")}
        </span>
        {QUICK_ACTIONS.map(({ id, label, href, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onAction(href)}
            className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-primary/10"
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            {t(label)}
          </button>
        ))}
        <p className="mt-2 px-2 text-xs text-muted-foreground">
          {t("chat.assistant.empty.footer")}
        </p>
      </div>
    </div>
  );
}

function Bubble({
  bubble,
  showReactions,
}: {
  bubble: ChatBubble;
  showReactions: boolean;
}) {
  if (bubble.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary/15 px-3 py-2 text-sm text-foreground">
          {bubble.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Markdown className="leading-relaxed">{bubble.text}</Markdown>
      {showReactions ? <Reactions text={bubble.text} /> : null}
    </div>
  );
}

function Reactions({ text }: { text: string }) {
  const { t } = useTranslation();
  function copy() {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <button
        type="button"
        onClick={copy}
        className="grid h-6 w-6 place-items-center rounded-md hover:bg-primary/10 hover:text-foreground"
        aria-label={t("chat.assistant.reactions.copy")}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="grid h-6 w-6 place-items-center rounded-md hover:bg-primary/10 hover:text-foreground"
        aria-label={t("chat.assistant.reactions.thumbsUp")}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="grid h-6 w-6 place-items-center rounded-md hover:bg-primary/10 hover:text-foreground"
        aria-label={t("chat.assistant.reactions.thumbsDown")}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
    </div>
  );
}
