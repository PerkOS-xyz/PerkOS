"use client";

import { useCallback, useEffect, useState } from "react";

export type AgentChatMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
  createdAt: number;
};

function storageKey(agentId: string) {
  return `swarm.agentChat.${agentId}.v1`;
}

function load(agentId: string): AgentChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(agentId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AgentChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useAgentChatHistory(agentId: string) {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);

  useEffect(() => {
    setMessages(load(agentId));
  }, [agentId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey(agentId), JSON.stringify(messages));
    } catch {
      // ignore quota errors
    }
  }, [agentId, messages]);

  const append = useCallback((msg: AgentChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, append, clear };
}

export function genMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
