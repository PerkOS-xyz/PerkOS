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

  const resetConversation = useCallback(() => setMessages([]), []);

  // Lazily fetch (or create) the Assistant conv the first time the user
  // opens the panel while signed in. Cached for the rest of the session;
  // a fresh page load will re-fetch (it's idempotent server-side, so the
  // existing doc is returned).
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
        if (!cancelled) setLoadingConv(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isConnected, convId, loadingConv]);

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
