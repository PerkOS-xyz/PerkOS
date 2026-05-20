"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useMutation } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import {
  X,
  ArrowUp,
  Plus,
  Folder,
  ListTodo,
  Bot,
  Loader2,
  Copy,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Mic,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { assistantChat } from "../lib/perkosApi";
import { useSpeechToText } from "../lib/useSpeechToText";
import { useChatbot, type ChatBubble } from "./ChatbotProvider";
import { Markdown } from "./Markdown";

type QuickAction = {
  id: string;
  label: string;
  href: string;
  Icon: typeof Folder;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "project", label: "Create a project", href: "/projects/new", Icon: Folder },
  { id: "task", label: "Create a task", href: "/tasks/new", Icon: ListTodo },
  { id: "agent", label: "Register an agent", href: "/agents/new", Icon: Bot },
];

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export function ChatbotPanel() {
  const { open, setOpen, messages, appendMessage, resetConversation } = useChatbot();
  const router = useRouter();
  const { address, isConnected } = useConnection();
  const [draft, setDraft] = useState("");

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

  const mutation = useMutation({
    mutationFn: async (text: string) => {
      if (!isConnected || !address) {
        throw new Error("Connect a wallet to chat with the assistant.");
      }
      const history = messages.map((m) => ({
        role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: m.text,
      }));
      return assistantChat({ walletAddress: address, message: text, history });
    },
    onSuccess: (data) => {
      appendMessage({ id: genId(), role: "agent", text: data.reply });
    },
    onError: (error: Error) => {
      appendMessage({
        id: genId(),
        role: "agent",
        text: `⚠ ${error.message}`,
      });
    },
  });

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages.length, mutation.isPending]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || mutation.isPending) return;
    appendMessage({ id: genId(), role: "user", text: trimmed });
    setDraft("");
    mutation.mutate(trimmed);
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
        aria-label="PerkOS Agent"
        className={cn(
          "fixed z-50 flex flex-col border border-primary/40 bg-card shadow-[0_0_32px_rgba(236,27,105,0.25)]",
          // Mobile: near-fullscreen sheet (small gap at the top to peek the page behind)
          "inset-x-0 bottom-0 top-4 rounded-t-2xl",
          // Desktop: corner panel
          "md:inset-auto md:bottom-8 md:right-8 md:top-auto md:h-[600px] md:max-h-[calc(100vh-6rem)] md:w-[400px] md:rounded-2xl"
        )}
      >
        <Header
          title="PerkOS Agent"
          subtitle={isEmpty ? "Online" : "New chat"}
          onClose={() => setOpen(false)}
          onReset={isEmpty ? undefined : resetConversation}
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
              {mutation.isPending ? <TypingBubble /> : null}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-card/95 px-5 py-3">
          {speech.error ? (
            <p className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Dictation: {speech.error}
            </p>
          ) : null}

          <form onSubmit={onSubmit}>
            <div className="flex items-end gap-2 rounded-lg border border-input bg-background px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
              <button
                type="button"
                aria-label="Attach"
                disabled
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground/60"
                title="Attachments coming soon"
              >
                <Plus className="h-4 w-4" />
              </button>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
                placeholder={speech.listening ? (speech.interimText || "Listening…") : "Write a message…"}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
              {speech.supported && draft.trim().length === 0 ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={speech.toggle}
                  disabled={mutation.isPending}
                  className={cn(
                    "h-8 w-8 rounded-full text-muted-foreground hover:text-primary",
                    speech.listening && "animate-pulse text-primary",
                  )}
                  aria-label={speech.listening ? "Stop dictation" : "Dictate"}
                  title={speech.listening ? "Stop dictation" : "Dictate with microphone"}
                >
                  <Mic className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  disabled={mutation.isPending}
                  className="h-8 w-8 rounded-full"
                  aria-label="Send"
                >
                  {mutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
              )}
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
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onReset?: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-3">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Image
            src="/agent.svg"
            alt=""
            width={28}
            height={28}
          />
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
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
            aria-label="Reset conversation"
            title="Start a new conversation"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onAction }: { onAction: (href: string) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary/85">
          <Image
            src="/agent.svg"
            alt=""
            width={36}
            height={36}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-medium leading-snug text-foreground">
            Hi, how can I help you today?
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            I&apos;m the PerkOS Agent. I help you learn the platform and set up
            the work agents you&apos;ll use across your projects.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Quick actions
        </span>
        {QUICK_ACTIONS.map(({ id, label, href, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onAction(href)}
            className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-primary/10"
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            {label}
          </button>
        ))}
        <p className="mt-2 px-2 text-xs text-muted-foreground">
          Or ask me anything about PerkOS — projects, agents, runtimes — and
          I&apos;ll guide you.
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
  function copy() {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <button
        type="button"
        onClick={copy}
        className="grid h-6 w-6 place-items-center rounded-md hover:bg-primary/10 hover:text-foreground"
        aria-label="Copy"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="grid h-6 w-6 place-items-center rounded-md hover:bg-primary/10 hover:text-foreground"
        aria-label="Thumbs up"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="grid h-6 w-6 place-items-center rounded-md hover:bg-primary/10 hover:text-foreground"
        aria-label="Thumbs down"
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
