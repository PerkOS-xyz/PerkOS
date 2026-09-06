"use client";

/**
 * React hook for the user side of chat.perkos.xyz.
 *
 * Opens a WebSocket to `wss://chat.perkos.xyz/chat`, authenticates with
 * the current Firebase user's ID token, and exposes `send(text)` plus
 * an `onMessage` callback for incoming `chat_message` frames from the
 * other side of the conversation (the PerkOS Assistant agent today).
 *
 * What we do NOT do here:
 *   - History loading (`history` / `history_chunk` frames) — v2
 *   - Typing indicators — v2
 *   - Receipt requests — v2
 * v1 is one user ↔ one agent live messaging.
 *
 * Reconnect policy: on any unexpected close, exponential backoff up to
 * 30s between attempts. Stops once the consumer disables (`enabled: false`)
 * or unmounts.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { firebaseAuth } from "./firebase";
import type { AgentChatProgress } from "./agentChatTurns";

const DEFAULT_CHAT_URL =
  process.env.NEXT_PUBLIC_PERKOS_CHAT_URL ?? "wss://chat.perkos.xyz/chat";

const MIN_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

export type ChatPerkosMessage = {
  /** Server-assigned id; stable for de-duping echoes of our own sends. */
  id: string;
  /** Frame sender, e.g. `user:0xc256…` or `agent:PerkOS-Assistant`. */
  from: string;
  text: string;
  /** ISO timestamp from the server. */
  timestamp: string;
  /** Optional id of the message this one replies to. */
  replyTo?: string | null;
  /** Safe provenance metadata used to distinguish persisted voice turns. */
  event?: { domain?: string; type?: string } | null;
};

function safeEvent(value: unknown): ChatPerkosMessage["event"] {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  return {
    domain: typeof raw.domain === "string" ? raw.domain : undefined,
    type: typeof raw.type === "string" ? raw.type : undefined,
  };
}

export type ChatPerkosState = {
  /** WebSocket is open and we've completed `auth_ok`. */
  authed: boolean;
  /** Most recent connection-level error message, if any. */
  error: string | null;
  /**
   * Queue a message for the conversation. Returns the local id used in
   * the `send` frame — useful if the caller wants to optimistically
   * render the message and reconcile when the server echoes it back.
   * If the WS isn't authed yet, the message is buffered and sent on
   * the next successful auth.
   */
  send: (text: string) => string;
  /**
   * Ask the historyHost agent for past messages. Returns the request id.
   * The reply arrives as a `history_chunk` frame routed back to the
   * `onHistory` callback. Pass `before` (ISO) to paginate further back;
   * leave undefined for the most recent page. No-op if not authed.
   */
  requestHistory: (opts?: { before?: string; limit?: number }) => string | null;
};

export type ChatPerkosHistoryChunk = {
  /** Request id from the matching `requestHistory()` call. */
  requestId: string | null;
  /** Server-side pagination flag: another chunk follows if true. */
  hasMore: boolean;
  /** Messages in chronological order (oldest first within the chunk). */
  messages: ChatPerkosMessage[];
};

type Options = {
  /** ConvId from `/api/concierge/ensure-conv`. WS opens only when set. */
  convId: string | null;
  /** Master switch — close the WS when the panel is closed/unmounted. */
  enabled: boolean;
  /** Called once per incoming `chat_message` frame. */
  onMessage: (msg: ChatPerkosMessage) => void;
  /** Optional. Called when a `history_chunk` arrives in response to a
   *  prior `requestHistory()` call (or any in-flight history pull). */
  onHistory?: (chunk: ChatPerkosHistoryChunk) => void;
  onProgress?: (progress: AgentChatProgress) => void;
};

function newId(): string {
  // Wide enough to avoid collisions across sessions; not crypto-strong.
  return Math.random().toString(36).slice(2, 14);
}

/** User sockets receive frames for every joined conversation. Keep panels isolated. */
export function frameBelongsToConversation(
  frame: Record<string, unknown>,
  convId: string,
): boolean {
  return typeof frame.convId === "string" && frame.convId === convId;
}

export function useChatPerkosClient(opts: Options): ChatPerkosState {
  const { convId, enabled, onMessage, onHistory, onProgress } = opts;
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live refs for the WebSocket + the latest handlers so the
  // open/close effect doesn't need to re-tear-down the socket every
  // time the caller re-renders.
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  const onHistoryRef = useRef(onHistory);
  const onProgressRef = useRef(onProgress);
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onHistoryRef.current = onHistory; }, [onHistory]);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);

  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Array<{ id: string; text: string }>>([]);

  // Flush queued messages once we're authed.
  const flushPending = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const pending = pendingRef.current;
    pendingRef.current = [];
    for (const msg of pending) {
      try {
        ws.send(
          JSON.stringify({
            type: "send",
            convId,
            text: msg.text,
            id: msg.id,
          }),
        );
      } catch {
        // Drop on error; reconnect logic will retry the flush after next auth.
        pendingRef.current.push(msg);
      }
    }
  }, [convId]);

  useEffect(() => {
    if (!enabled || !convId) {
      // Tear down any existing connection when disabled.
      if (wsRef.current) {
        wsRef.current.close(1000, "disabled");
        wsRef.current = null;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- disabling the socket must synchronously clear its authenticated UI state
      setAuthed(false);
      return;
    }
    const activeConvId = convId;

    let cancelled = false;

    async function open() {
      // Fresh Firebase token per connection — they expire after 1h and
      // chat.perkos.xyz validates them at auth time.
      const user = firebaseAuth().currentUser;
      if (!user) {
        setError("Not signed in. Connect your wallet first.");
        return;
      }
      let idToken: string;
      try {
        idToken = await user.getIdToken();
      } catch (err) {
        setError(
          err instanceof Error
            ? `Couldn't get Firebase token: ${err.message}`
            : "Couldn't get Firebase token.",
        );
        return;
      }
      if (cancelled) return;

      let ws: WebSocket;
      try {
        ws = new WebSocket(DEFAULT_CHAT_URL);
      } catch (err) {
        setError(
          err instanceof Error
            ? `WS construct failed: ${err.message}`
            : "WS construct failed.",
        );
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        if (cancelled) return;
        // First frame MUST be auth per the chat.perkos.xyz protocol.
        ws.send(
          JSON.stringify({ type: "auth", role: "user", idToken }),
        );
      });

      ws.addEventListener("message", (evt) => {
        if (cancelled) return;
        let frame: { type?: string; [k: string]: unknown };
        try {
          frame = JSON.parse(typeof evt.data === "string" ? evt.data : "");
        } catch {
          return;
        }
        switch (frame.type) {
          case "auth_ok":
            setAuthed(true);
            setError(null);
            reconnectAttemptsRef.current = 0;
            flushPending();
            return;

          case "auth_error":
            setError(
              `Chat auth failed: ${
                (frame.message as string | undefined) ??
                (frame.code as string | undefined) ??
                "unknown"
              }`,
            );
            // No reconnect on auth failure — likely a stale token or a
            // wallet that the chat server doesn't allowlist. The next
            // useEffect run (e.g. on token refresh) will retry.
            return;

          case "chat_message": {
            // Server-broadcast of a message in the conversation, sent to
            // every participant including the original sender.
            if (!frameBelongsToConversation(frame, activeConvId)) return;
            const fromValue = frame.from as string | undefined;
            const textValue = frame.text as string | undefined;
            if (!fromValue || typeof textValue !== "string") return;
            onMessageRef.current({
              id: (frame.id as string | undefined) ?? newId(),
              from: fromValue,
              text: textValue,
              timestamp:
                (frame.timestamp as string | undefined) ??
                new Date().toISOString(),
              replyTo: (frame.replyTo as string | null | undefined) ?? null,
              event: safeEvent(frame.event),
            });
            return;
          }

          case "history_chunk": {
            // Agent's reply to a previous `requestHistory()` (or to the
            // server's auto-fanout when the user joins). Server already
            // verified the requester is a participant, so we just forward.
            if (!frameBelongsToConversation(frame, activeConvId)) return;
            const rawMessages = Array.isArray(frame.messages)
              ? (frame.messages as Array<Record<string, unknown>>)
              : [];
            const messages: ChatPerkosMessage[] = rawMessages
              .map((m) => ({
                id: typeof m.id === "string" ? m.id : newId(),
                from: typeof m.from === "string" ? m.from : "",
                text: typeof m.text === "string" ? m.text : "",
                timestamp:
                  typeof m.timestamp === "string"
                    ? m.timestamp
                    : new Date().toISOString(),
                replyTo:
                  typeof m.replyTo === "string"
                    ? m.replyTo
                    : null,
                event: safeEvent(m.event),
              }))
              .filter((m) => m.from && m.text);
            onHistoryRef.current?.({
              requestId: (frame.id as string | undefined) ?? null,
              hasMore: Boolean(frame.hasMore),
              messages,
            });
            return;
          }

          case "history_pending":
            // Server ack of our history request — agent is being asked.
            // Nothing to do until the chunk arrives.
            return;

          case "typing": {
            if (!frameBelongsToConversation(frame, activeConvId) || typeof frame.from !== "string") return;
            const phase = ["accepted", "running", "recovering", "completed", "uncertain"].includes(String(frame.phase))
              ? frame.phase as AgentChatProgress["phase"] : undefined;
            onProgressRef.current?.({ from: frame.from, replyTo: typeof frame.replyTo === "string" ? frame.replyTo : null,
              state: frame.state === "stop" ? "stop" : "start", phase });
            return;
          }
          case "ack":
          case "presence":
            // Not used by v1 of this panel.
            return;

          default:
            // Unknown frame type — log for debugging, ignore otherwise.
            // Unknown frames may contain private payloads; do not log them.
        }
      });

      ws.addEventListener("close", (evt) => {
        if (cancelled) return;
        setAuthed(false);
        if (evt.code === 1000) return; // clean shutdown
        scheduleReconnect();
      });

      ws.addEventListener("error", () => {
        if (cancelled) return;
        // Browser WebSocket errors are intentionally opaque; the close
        // event right after will carry the actionable info.
        setError("WS error (see console)");
      });
    }

    function scheduleReconnect() {
      if (cancelled) return;
      const attempt = ++reconnectAttemptsRef.current;
      const delay = Math.min(MIN_RECONNECT_MS * 2 ** (attempt - 1), MAX_RECONNECT_MS);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(open, delay);
    }

    open();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, "unmount");
        wsRef.current = null;
      }
      pendingRef.current = [];
      setAuthed(false);
    };
  }, [enabled, convId, flushPending]);

  const send = useCallback(
    (text: string): string => {
      const id = newId();
      const trimmed = text.trim();
      if (!trimmed) return id;

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN && authed) {
        ws.send(
          JSON.stringify({
            type: "send",
            convId,
            text: trimmed,
            id,
          }),
        );
      } else {
        pendingRef.current.push({ id, text: trimmed });
      }
      return id;
    },
    [convId, authed],
  );

  const requestHistory = useCallback(
    (opts: { before?: string; limit?: number } = {}): string | null => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !authed || !convId) {
        return null;
      }
      const id = newId();
      ws.send(
        JSON.stringify({
          type: "history",
          id,
          convId,
          before: opts.before ?? null,
          limit: opts.limit ?? 50,
        }),
      );
      return id;
    },
    [convId, authed],
  );

  return { authed, error, send, requestHistory };
}
