"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type ChatRole = "user" | "agent";

export type ChatBubble = {
  id: string;
  role: ChatRole;
  text: string;
};

type ChatbotState = {
  open: boolean;
  messages: ChatBubble[];
  setOpen: (open: boolean) => void;
  toggle: () => void;
  appendMessage: (msg: ChatBubble) => void;
  resetConversation: () => void;
};

const Ctx = createContext<ChatbotState | null>(null);

export function ChatbotProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatBubble[]>([]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const appendMessage = useCallback(
    (msg: ChatBubble) => setMessages((prev) => [...prev, msg]),
    []
  );

  const resetConversation = useCallback(() => setMessages([]), []);

  return (
    <Ctx.Provider
      value={{ open, messages, setOpen, toggle, appendMessage, resetConversation }}
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
