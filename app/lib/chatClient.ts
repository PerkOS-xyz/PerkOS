/**
 * Browser-side client for PerkOS-Chat (wss://chat.perkos.xyz/chat).
 *
 * Plain TypeScript — no React. Wrapped by `ChatClientProvider` (see
 * `useChatClientContext.tsx`) so a single connection serves every chat
 * route within a session.
 *
 * Frame schema mirrors the spec in `PerkOS-Chat/docs/protocol.md`.
 */

export type ChatIdentity = `user:${string}` | `agent:${string}`;

export interface ChatMessage {
  id: string;
  convId: string;
  from: ChatIdentity;
  text: string;
  /** ISO 8601 */
  timestamp: string;
  replyTo?: string | null;
}

export type ChatClientStatus =
  | "idle"
  | "connecting"
  | "authing"
  | "connected"
  | "auth-error"
  | "disconnected";

export type StatusListener = (status: ChatClientStatus, detail?: string) => void;
export type MessageListener = (msg: ChatMessage) => void;
export type AckListener = (ack: { id: string; convId: string; delivered: number; timestamp: string }) => void;

const DEFAULT_URL = "wss://chat.perkos.xyz/chat";
const MIN_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;
const HEARTBEAT_MS = 25_000;
const HISTORY_TIMEOUT_MS = 15_000;

interface PendingHistory {
  resolve: (page: { messages: ChatMessage[]; hasMore: boolean }) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class ChatClient {
  private ws: WebSocket | null = null;
  private url: string;
  private getToken: () => Promise<string | null>;
  private status: ChatClientStatus = "idle";
  private statusListeners = new Set<StatusListener>();
  /** convId -> Set of listeners. */
  private messageListeners = new Map<string, Set<MessageListener>>();
  /** sender-side ack listener for a specific outbound message id. */
  private ackListeners = new Map<string, AckListener>();
  private pendingHistory = new Map<string, PendingHistory>();
  private reconnectMs = MIN_RECONNECT_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;
  private currentSession: { walletAddress: string } | null = null;

  constructor(opts: { url?: string; getToken: () => Promise<string | null> }) {
    this.url = opts.url || DEFAULT_URL;
    this.getToken = opts.getToken;
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  getStatus(): ChatClientStatus {
    return this.status;
  }

  getSessionWallet(): string | null {
    return this.currentSession?.walletAddress ?? null;
  }

  /** Open the connection (idempotent). */
  start(): void {
    if (this.ws || this.stopped === false && this.status === "connected") return;
    this.stopped = false;
    this.connect();
  }

  /** Close the connection and stop reconnecting. */
  stop(): void {
    this.stopped = true;
    this.clearTimers();
    if (this.ws) {
      try {
        this.ws.close(1000, "client shutdown");
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.setStatus("idle");
    this.currentSession = null;
    // Reject pending history queries.
    for (const p of this.pendingHistory.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("client stopped"));
    }
    this.pendingHistory.clear();
    this.ackListeners.clear();
  }

  /** Subscribe to status changes; returns an unsubscriber. */
  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  /** Subscribe to messages for a single conv. */
  onMessage(convId: string, fn: MessageListener): () => void {
    let set = this.messageListeners.get(convId);
    if (!set) {
      set = new Set();
      this.messageListeners.set(convId, set);
    }
    set.add(fn);
    return () => {
      set?.delete(fn);
      if (set && set.size === 0) this.messageListeners.delete(convId);
    };
  }

  /**
   * Send a message. Returns the generated id immediately. The caller
   * should render the message optimistically; the server will broadcast
   * back as a `chat_message` event with the same id.
   *
   * Optional `onAck` is invoked once when the server confirms routing.
   */
  send(input: { convId: string; text: string; onAck?: AckListener }): string {
    const id = makeId();
    if (input.onAck) this.ackListeners.set(id, input.onAck);
    this.sendFrame({
      type: "send",
      id,
      convId: input.convId,
      text: input.text,
    });
    return id;
  }

  /**
   * Request a history page. Resolves with the chunk; rejects on timeout
   * or HOST_OFFLINE / other server errors.
   */
  history(input: { convId: string; before?: string | null; limit?: number }): Promise<{
    messages: ChatMessage[];
    hasMore: boolean;
  }> {
    return new Promise((resolve, reject) => {
      const id = makeId();
      const timer = setTimeout(() => {
        this.pendingHistory.delete(id);
        reject(new Error("history request timed out"));
      }, HISTORY_TIMEOUT_MS);
      this.pendingHistory.set(id, { resolve, reject, timer });
      this.sendFrame({
        type: "history",
        id,
        convId: input.convId,
        before: input.before ?? null,
        limit: input.limit ?? 50,
      });
    });
  }

  // ---------------------------------------------------------------------
  // Internal: connection lifecycle
  // ---------------------------------------------------------------------

  private async connect(): Promise<void> {
    if (this.stopped) return;
    this.setStatus("connecting");

    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      this.setStatus("disconnected", errMsg(err));
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = async () => {
      this.setStatus("authing");
      const token = await this.getToken().catch(() => null);
      if (!token) {
        this.setStatus("auth-error", "no Firebase ID token");
        try { this.ws?.close(4401, "no token"); } catch { /* ignore */ }
        return;
      }
      this.sendFrame({ type: "auth", role: "user", idToken: token });
    };

    this.ws.onmessage = (ev) => {
      let frame: Record<string, unknown>;
      try {
        frame = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
      } catch {
        return;
      }
      this.handleFrame(frame);
    };

    this.ws.onclose = (ev) => {
      this.clearTimers();
      this.ws = null;
      if (this.stopped) return;
      // 4401 = auth failure; don't churn-reconnect.
      if (ev.code === 4401) {
        this.setStatus("auth-error", String(ev.reason || "auth failed"));
        return;
      }
      this.setStatus("disconnected", String(ev.reason || `code ${ev.code}`));
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // The close handler will fire shortly after — no need to duplicate.
    };
  }

  private handleFrame(frame: Record<string, unknown>): void {
    const type = String(frame.type ?? "");

    if (type === "auth_ok") {
      const session = (frame.session ?? {}) as { walletAddress?: string };
      this.currentSession = session.walletAddress
        ? { walletAddress: session.walletAddress.toLowerCase() }
        : null;
      this.reconnectMs = MIN_RECONNECT_MS;
      this.setStatus("connected");
      this.startHeartbeat();
      return;
    }

    if (type === "auth_error") {
      this.setStatus("auth-error", String(frame.message ?? frame.code ?? "auth failed"));
      try { this.ws?.close(4401, String(frame.code ?? "")); } catch { /* ignore */ }
      return;
    }

    if (type === "chat_message" || type === "chat_deliver") {
      const msg: ChatMessage = {
        id: String(frame.id),
        convId: String(frame.convId),
        from: String(frame.from) as ChatIdentity,
        text: String(frame.text),
        timestamp: String(frame.timestamp),
        replyTo: (frame.replyTo as string | null | undefined) ?? null,
      };
      const set = this.messageListeners.get(msg.convId);
      if (set) for (const fn of set) fn(msg);
      return;
    }

    if (type === "ack") {
      const id = String(frame.id);
      const fn = this.ackListeners.get(id);
      if (fn) {
        this.ackListeners.delete(id);
        fn({
          id,
          convId: String(frame.convId),
          delivered: Number(frame.delivered ?? 0),
          timestamp: String(frame.timestamp),
        });
      }
      return;
    }

    if (type === "history_chunk") {
      const id = String(frame.id);
      const pending = this.pendingHistory.get(id);
      if (!pending) return;
      this.pendingHistory.delete(id);
      clearTimeout(pending.timer);
      const messages = Array.isArray(frame.messages)
        ? (frame.messages as unknown[]).map((m) => normalizeMessage(m as Record<string, unknown>, String(frame.convId)))
        : [];
      pending.resolve({ messages, hasMore: !!frame.hasMore });
      return;
    }

    if (type === "history_pending") {
      // server acknowledged the request; we still wait for history_chunk
      return;
    }

    if (type === "error") {
      const code = String(frame.code ?? "");
      const message = String(frame.message ?? "");
      // If the error is in response to a known pending history, reject it.
      // We try by message-id correlation when the server echoes the id.
      const id = String(frame.id ?? "");
      if (id && this.pendingHistory.has(id)) {
        const pending = this.pendingHistory.get(id)!;
        this.pendingHistory.delete(id);
        clearTimeout(pending.timer);
        pending.reject(new Error(`${code}: ${message}`));
      }
      // Otherwise surface via status if it's serious.
      if (code === "HOST_OFFLINE" || code === "NOT_FOUND") {
        this.setStatus(this.status, `${code}: ${message}`);
      }
      return;
    }

    if (type === "pong" || type === "history_pending") return;
  }

  private sendFrame(frame: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
    // Frames sent before OPEN are silently dropped — callers should retry
    // after `status === "connected"`.
  }

  private setStatus(s: ChatClientStatus, detail?: string): void {
    this.status = s;
    for (const fn of this.statusListeners) fn(s, detail);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.sendFrame({ type: "ping" });
    }, HEARTBEAT_MS);
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    const delay = this.reconnectMs;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
    this.reconnectMs = Math.min(delay * 2, MAX_RECONNECT_MS);
  }

  private clearTimers(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
  }
}

function makeId(): string {
  // crypto.randomUUID is broadly available; fall back for old runtimes.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeMessage(raw: Record<string, unknown>, fallbackConvId: string): ChatMessage {
  return {
    id: String(raw.id ?? makeId()),
    convId: String(raw.convId ?? fallbackConvId),
    from: String(raw.from ?? "agent:unknown") as ChatIdentity,
    text: String(raw.text ?? ""),
    timestamp: String(raw.timestamp ?? new Date().toISOString()),
    replyTo: (raw.replyTo as string | null | undefined) ?? null,
  };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
