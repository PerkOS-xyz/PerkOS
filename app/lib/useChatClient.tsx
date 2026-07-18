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
import { getMessages as cacheGet, putMessages as cachePut } from "./chatCache";
import {
  ChatClient,
  type ChatClientStatus,
  type ChatMessage,
} from "./chatClient";
import { useFirebaseUser } from "./useFirebaseUser";
import { upsertLiveMessage } from "./chatMessageMerge";

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
 * Every received message is also persisted to the local IndexedDB cache so
 * scroll-back works offline. Duplicates (same id) are coalesced.
 */
export function useConversationLiveMessages(convId: string | null | undefined): ChatMessage[] {
  const client = useChatClient();
  const wallet = client?.getSessionWallet() ?? null;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    setMessages([]);
    if (!client || !convId) return;
    return client.onMessage(convId, (msg) => {
      setMessages((prev) => upsertLiveMessage(prev, msg));
      if (wallet) {
        void cachePut(wallet, convId, [msg]).catch(() => {});
      }
    });
  }, [client, convId, wallet]);

  return messages;
}

/**
 * One-shot history fetch with IndexedDB-backed cache hydration.
 *
 * Behavior:
 * 1. On mount, immediately hydrate from local cache so the user sees the
 *    last conversation state even if the WS is still authing.
 * 2. Once the WS is connected, request the live history page from the
 *    server (which proxies to the host agent's jsonl).
 * 3. If the server returns HOST_OFFLINE, set `hostOffline` and keep the
 *    cached view. The UI surfaces a banner.
 * 4. Every server-returned message is persisted to cache (id-keyed upsert).
 */
export function useChatHistory(convId: string | null | undefined): {
  history: ChatMessage[];
  loadingInitial: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  hostOffline: boolean;
  fromCache: boolean;
  loadOlder: () => Promise<void>;
} {
  const client = useChatClient();
  const wallet = client?.getSessionWallet() ?? null;
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hostOffline, setHostOffline] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    seenRef.current = new Set();
    setHistory([]);
    setHasMore(false);
    setError(null);
    setHostOffline(false);
    setFromCache(false);
    if (!client || !convId) return;

    let cancelled = false;

    (async () => {
      // 1. Hydrate from cache first (best-effort).
      if (wallet) {
        try {
          const cached = await cacheGet(wallet, convId, { limit: 50 });
          if (!cancelled && cached.messages.length > 0) {
            for (const m of cached.messages) seenRef.current.add(m.id);
            setHistory(cached.messages.map(stripCachedMeta));
            setHasMore(cached.hasMore);
            setFromCache(true);
          }
        } catch {
          /* ignore cache errors */
        }
      }

      // 2. Wait for the WS to settle.
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

      // 3. Fetch live history.
      setLoadingInitial(true);
      try {
        const page = await client.history({ convId });
        if (cancelled) return;
        for (const m of page.messages) seenRef.current.add(m.id);
        setHistory(page.messages);
        setHasMore(page.hasMore);
        setHostOffline(false);
        setFromCache(false);
        if (wallet) {
          void cachePut(wallet, convId, page.messages).catch(() => {});
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (/HOST_OFFLINE/i.test(msg)) {
          setHostOffline(true);
          // Keep showing the cached view.
        } else {
          setError(err instanceof Error ? err : new Error(msg));
        }
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, convId, wallet]);

  const loadOlder = useCallback(async () => {
    if (!client || !convId || loadingMore || !hasMore || history.length === 0) return;
    setLoadingMore(true);
    const before = history[0].timestamp;
    try {
      const page = await client.history({ convId, before });
      const fresh = page.messages.filter((m) => !seenRef.current.has(m.id));
      for (const m of fresh) seenRef.current.add(m.id);
      if (fresh.length > 0) setHistory((prev) => [...fresh, ...prev]);
      setHasMore(page.hasMore);
      setHostOffline(false);
      if (wallet) {
        void cachePut(wallet, convId, page.messages).catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/HOST_OFFLINE/i.test(msg)) {
        setHostOffline(true);
        // Try cache as a fallback.
        if (wallet) {
          try {
            const cached = await cacheGet(wallet, convId, { before, limit: 50 });
            const fresh = cached.messages
              .map(stripCachedMeta)
              .filter((m) => !seenRef.current.has(m.id));
            for (const m of fresh) seenRef.current.add(m.id);
            if (fresh.length > 0) setHistory((prev) => [...fresh, ...prev]);
            setHasMore(cached.hasMore);
          } catch {
            /* ignore */
          }
        }
      } else {
        setError(err instanceof Error ? err : new Error(msg));
      }
    } finally {
      setLoadingMore(false);
    }
  }, [client, convId, history, hasMore, loadingMore, wallet]);

  return useMemo(
    () => ({ history, loadingInitial, loadingMore, hasMore, error, hostOffline, fromCache, loadOlder }),
    [history, loadingInitial, loadingMore, hasMore, error, hostOffline, fromCache, loadOlder],
  );
}

function stripCachedMeta(c: {
  id: string;
  convId: string;
  from: string;
  text: string;
  timestamp: string;
  replyTo: string | null;
}): ChatMessage {
  return {
    id: c.id,
    convId: c.convId,
    from: c.from as ChatMessage["from"],
    text: c.text,
    timestamp: c.timestamp,
    replyTo: c.replyTo,
  };
}
