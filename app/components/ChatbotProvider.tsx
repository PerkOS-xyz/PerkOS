"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useConnection } from "wagmi";

import { ensureAssistantConv } from "../lib/perkosApi";

export type ChatRole = "user" | "agent";

export type ChatBubble = {
  id: string;
  role: ChatRole;
  text: string;
};

type ChatbotState = {
  open: boolean;
  messages: ChatBubble[];
  /** ConvId of the user ↔ PerkOS Assistant conversation, lazily fetched
   *  the first time the panel opens. Null until ready. */
  convId: string | null;
  /** True while ensureAssistantConv is in-flight. */
  loadingConv: boolean;
  /** Most recent error from ensureAssistantConv, if any. */
  convError: string | null;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  appendMessage: (msg: ChatBubble) => void;
  /** Insert a batch of older messages at the head of the list (used by
   *  history loading; the historyHost agent returns chronologically-
   *  ordered batches oldest-first within a chunk). */
  prependMessages: (msgs: ChatBubble[]) => void;
  resetConversation: () => void;
};

const Ctx = createContext<ChatbotState | null>(null);

export function ChatbotProvider({ children }: { children: ReactNode }) {
  const { isConnected } = useConnection();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [convId, setConvId] = useState<string | null>(null);
  const [loadingConv, setLoadingConv] = useState(false);
  const [convError, setConvError] = useState<string | null>(null);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const appendMessage = useCallback(
    (msg: ChatBubble) => setMessages((prev) => [...prev, msg]),
    []
  );

  const prependMessages = useCallback((msgs: ChatBubble[]) => {
    if (msgs.length === 0) return;
    setMessages((prev) => {
      // De-dupe by id — history pulls may overlap with live messages
      // the user already saw via chat_message broadcasts.
      const seen = new Set(prev.map((m) => m.id));
      const filtered = msgs.filter((m) => !seen.has(m.id));
      return [...filtered, ...prev];
    });
  }, []);

  const resetConversation = useCallback(() => setMessages([]), []);

  // Lazily fetch (or create) the Assistant conv the first time the user
  // opens the panel while signed in. Cached for the rest of the session;
  // a fresh page load will re-fetch (it's idempotent server-side, so the
  // existing doc is returned).
  //
  // loadingConv is intentionally NOT in the deps even though we read it
  // for guarding: including it caused a deadlock where the effect's own
  // setLoadingConv(true) re-triggered the effect, the cleanup fired
  // cancelled=true on the in-flight request, and the .finally (gated on
  // !cancelled) never reset loadingConv — leaving the panel stuck in
  // "Opening chat…" forever. The cancelled guard still protects against
  // stale state updates (e.g. panel closed mid-flight).
  useEffect(() => {
    if (!open || !isConnected || convId || loadingConv) return;
    let cancelled = false;
    setLoadingConv(true);
    setConvError(null);
    ensureAssistantConv()
      .then((conv) => {
        if (cancelled) return;
        setConvId(conv.convId);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setConvError(err.message ?? "Couldn't open Assistant chat.");
      })
      .finally(() => {
        // Always reset — never gate on cancelled here. If the effect
        // re-ran for any reason, the next run will early-return on
        // !convId (already set) or fire a fresh request (which is the
        // intended behavior). Leaving loadingConv true on cancellation
        // is what caused the original deadlock.
        setLoadingConv(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isConnected, convId]);

  return (
    <Ctx.Provider
      value={{
        open,
        messages,
        convId,
        loadingConv,
        convError,
        setOpen,
        toggle,
        appendMessage,
        prependMessages,
        resetConversation,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useChatbot() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useChatbot must be used inside ChatbotProvider");
  return ctx;
}
