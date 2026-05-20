"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { firebaseAuth } from "./firebase";
import {
  ChatClient,
  type ChatClientStatus,
  type ChatMessage,
} from "./chatClient";
import { useFirebaseUser } from "./useFirebaseUser";

const ChatClientContext = createContext<ChatClient | null>(null);

/**
 * Wraps the chat tree with a single ChatClient instance scoped to the
 * current Firebase user. On sign-out the client is stopped; on a new
 * sign-in a new client is created.
 *
 * The chat WebSocket URL comes from `NEXT_PUBLIC_PERKOS_CHAT_URL` and
 * falls back to `wss://chat.perkos.xyz/chat`.
 */
export function ChatClientProvider({ children }: { children: ReactNode }) {
  const { user } = useFirebaseUser();
  const [client, setClient] = useState<ChatClient | null>(null);

  useEffect(() => {
    if (!user) {
      setClient((prev) => {
        prev?.stop();
        return null;
      });
      return;
    }

    const c = new ChatClient({
      url: process.env.NEXT_PUBLIC_PERKOS_CHAT_URL,
      getToken: async () => {
        try {
          return await firebaseAuth().currentUser?.getIdToken(/* forceRefresh */ false) ?? null;
        } catch {
          return null;
        }
      },
    });
    c.start();
    setClient(c);
    return () => {
      c.stop();
    };
  }, [user]);

  return (
    <ChatClientContext.Provider value={client}>
      {children}
    </ChatClientContext.Provider>
  );
}

/** Get the active ChatClient (may be null before sign-in / during sign-out). */
export function useChatClient(): ChatClient | null {
  return useContext(ChatClientContext);
}

/** Subscribe to status changes. */
export function useChatClientStatus(): { status: ChatClientStatus; detail?: string } {
  const client = useChatClient();
  const [state, setState] = useState<{ status: ChatClientStatus; detail?: string }>({
    status: client?.getStatus() ?? "idle",
  });
  useEffect(() => {
    if (!client) {
      setState({ status: "idle" });
      return;
    }
    return client.onStatus((status, detail) => setState({ status, detail }));
  }, [client]);
  return state;
}

/**
 * Subscribe to live messages for a single conversation. The hook keeps
 * an internal buffer of messages received via WS for this conv; combine
 * with `useChatHistory` for the older page.
 *
 * Duplicates (same id) are coalesced.
 */
export function useConversationLiveMessages(convId: string | null | undefined): ChatMessage[] {
  const client = useChatClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Use a ref to keep set of seen IDs without re-rendering.
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    seenRef.current = new Set();
    setMessages([]);
    if (!client || !convId) return;
    return client.onMessage(convId, (msg) => {
      if (seenRef.current.has(msg.id)) return;
      seenRef.current.add(msg.id);
      setMessages((prev) => insertChronological(prev, msg));
    });
  }, [client, convId]);

  return messages;
}

/**
 * One-shot history fetch. Re-fires when `convId` changes. Returns the
 * accumulated history, a loader for older pages, and the loading state.
 */
export function useChatHistory(convId: string | null | undefined): {
  history: ChatMessage[];
  loadingInitial: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  loadOlder: () => Promise<void>;
} {
  const client = useChatClient();
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    seenRef.current = new Set();
    setHistory([]);
    setHasMore(false);
    setError(null);
    if (!client || !convId) return;

    let cancelled = false;
    (async () => {
      // Wait for the connection if it's still authing.
      if (client.getStatus() !== "connected") {
        await new Promise<void>((resolve) => {
          const unsub = client.onStatus((s) => {
            if (s === "connected" || s === "auth-error") {
              unsub();
              resolve();
            }
          });
        });
      }
      if (cancelled) return;
      setLoadingInitial(true);
      try {
        const page = await client.history({ convId });
        if (cancelled) return;
        for (const m of page.messages) seenRef.current.add(m.id);
        setHistory(page.messages);
        setHasMore(page.hasMore);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, convId]);

  const loadOlder = useCallback(async () => {
    if (!client || !convId || loadingMore || !hasMore || history.length === 0) return;
    setLoadingMore(true);
    try {
      const before = history[0].timestamp;
      const page = await client.history({ convId, before });
      const fresh = page.messages.filter((m) => !seenRef.current.has(m.id));
      for (const m of fresh) seenRef.current.add(m.id);
      if (fresh.length > 0) setHistory((prev) => [...fresh, ...prev]);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoadingMore(false);
    }
  }, [client, convId, history, hasMore, loadingMore]);

  return useMemo(
    () => ({ history, loadingInitial, loadingMore, hasMore, error, loadOlder }),
    [history, loadingInitial, loadingMore, hasMore, error, loadOlder],
  );
}

function insertChronological(list: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  if (list.length === 0) return [msg];
  // Common case: newer than last.
  if (msg.timestamp >= list[list.length - 1].timestamp) return [...list, msg];
  // Otherwise binary-search insertion point.
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].timestamp <= msg.timestamp) lo = mid + 1;
    else hi = mid;
  }
  return [...list.slice(0, lo), msg, ...list.slice(lo)];
}
