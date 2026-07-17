/**
 * ChatClient protocol tests.
 *
 * Replaces the global WebSocket with a controllable fake so we can assert
 * the frame-by-frame wire behavior without a real network. Verifies that
 * the receipt round-trip + auth flow behave correctly end-to-end at the
 * client level.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatClient } from "../app/lib/chatClient";

// ---- Fake WebSocket ---------------------------------------------------------

let activeFake: FakeWebSocket | null = null;

class FakeWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState: number = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  constructor(public url: string) {
    activeFake = this;
    // simulate immediate open on next tick
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.onopen?.();
    });
  }
  send(payload: string) {
    this.sent.push(payload);
  }
  close(code = 1000, reason = "") {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }
  /** Simulate the server pushing a frame to the client. */
  push(frame: object) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

// Install global before any test runs.
beforeEach(() => {
  // @ts-expect-error — overriding the global
  globalThis.WebSocket = FakeWebSocket;
  activeFake = null;
});

afterEach(() => {
  vi.useRealTimers();
});

function readSentFrame(idx: number): Record<string, unknown> {
  expect(activeFake?.sent.length).toBeGreaterThan(idx);
  return JSON.parse(activeFake!.sent[idx]);
}

// ---- Tests ------------------------------------------------------------------

describe("ChatClient connection + auth", () => {
  it("sends auth on open with the resolved Firebase ID token", async () => {
    const client = new ChatClient({
      url: "ws://test/chat",
      getToken: async () => "token-xyz",
    });
    client.start();
    // Let microtasks settle: connect → open → getToken → send auth
    await new Promise((r) => setTimeout(r, 5));
    expect(activeFake).not.toBeNull();
    const authFrame = readSentFrame(0);
    expect(authFrame.type).toBe("auth");
    expect(authFrame.role).toBe("user");
    expect(authFrame.idToken).toBe("token-xyz");
    client.stop();
  });

  it("transitions through connecting → authing → connected on auth_ok", async () => {
    const states: string[] = [];
    const client = new ChatClient({
      url: "ws://test/chat",
      getToken: async () => "token",
    });
    client.onStatus((s) => states.push(s));
    client.start();
    await new Promise((r) => setTimeout(r, 5));
    activeFake!.push({
      type: "auth_ok",
      session: { walletAddress: "0xabc" },
    });
    expect(client.getStatus()).toBe("connected");
    expect(client.getSessionWallet()).toBe("0xabc");
    expect(states).toContain("connecting");
    expect(states).toContain("authing");
    expect(states).toContain("connected");
    client.stop();
  });

  it("captures auth_error and surfaces it on status", async () => {
    const states: { status: string; detail?: string }[] = [];
    const client = new ChatClient({
      url: "ws://test/chat",
      getToken: async () => "bad",
    });
    client.onStatus((status, detail) => states.push({ status, detail }));
    client.start();
    await new Promise((r) => setTimeout(r, 5));
    activeFake!.push({ type: "auth_error", code: "BAD_TOKEN", message: "bad" });
    expect(client.getStatus()).toBe("auth-error");
    expect(states.some((s) => s.status === "auth-error" && s.detail === "bad")).toBe(true);
    client.stop();
  });
});

describe("ChatClient receipt round-trip", () => {
  it("resolves requestReceipt with the server's receipt_response", async () => {
    const client = new ChatClient({
      url: "ws://test/chat",
      getToken: async () => "token",
    });
    client.start();
    await new Promise((r) => setTimeout(r, 5));
    activeFake!.push({ type: "auth_ok", session: { walletAddress: "0xabc" } });

    const pending = client.requestReceipt({ convId: "c1" });
    await new Promise((r) => setTimeout(r, 1));

    // The first send was auth; second is receipt_request
    const sentReceipt = readSentFrame(1);
    expect(sentReceipt.type).toBe("receipt_request");
    expect(sentReceipt.convId).toBe("c1");
    const requestId = sentReceipt.id as string;

    // Server sends pending then response
    activeFake!.push({ type: "receipt_pending", id: requestId, convId: "c1" });
    activeFake!.push({
      type: "receipt_response",
      id: requestId,
      convId: "c1",
      hostAgent: "agent:demo",
      transcriptHash: "deadbeef",
      messageCount: 3,
      firstMessageAt: "2026-05-20T10:00:00.000Z",
      lastMessageAt: "2026-05-20T10:05:00.000Z",
      generatedAt: "2026-05-20T10:06:00.000Z",
    });

    const result = await pending;
    expect(result.transcriptHash).toBe("deadbeef");
    expect(result.messageCount).toBe(3);
    expect(result.hostAgent).toBe("agent:demo");
    expect(result.firstMessageAt).toBe("2026-05-20T10:00:00.000Z");
    client.stop();
  });

  it("rejects requestReceipt when the server returns an error correlated by id", async () => {
    const client = new ChatClient({
      url: "ws://test/chat",
      getToken: async () => "token",
    });
    client.start();
    await new Promise((r) => setTimeout(r, 5));
    activeFake!.push({ type: "auth_ok", session: { walletAddress: "0xabc" } });

    const pending = client.requestReceipt({ convId: "c1" });
    await new Promise((r) => setTimeout(r, 1));
    const sent = readSentFrame(1);
    activeFake!.push({
      type: "error",
      id: sent.id,
      code: "HOST_OFFLINE",
      message: "host agent is offline",
    });

    await expect(pending).rejects.toThrow(/HOST_OFFLINE/);
    client.stop();
  });
});

describe("ChatClient message routing", () => {
  it("sends directed project messages and preserves workflow events", async () => {
    const client = new ChatClient({
      url: "ws://test/chat",
      getToken: async () => "token",
    });
    client.start();
    await new Promise((r) => setTimeout(r, 5));
    activeFake!.push({ type: "auth_ok", session: { walletAddress: "0xabc" } });

    client.send({
      convId: "project-1",
      text: "Review this plan",
      targets: ["agent:morpheus"],
      event: {
        domain: "project_workflow",
        type: "plan_proposed",
        projectId: "1",
        planId: "plan-1",
      },
    });
    expect(readSentFrame(1)).toMatchObject({
      type: "send",
      convId: "project-1",
      targets: ["agent:morpheus"],
      event: { type: "plan_proposed", planId: "plan-1" },
    });

    const seen: unknown[] = [];
    client.onMessage("project-1", (message) => seen.push(message.event));
    activeFake!.push({
      type: "chat_message",
      id: "event-1",
      convId: "project-1",
      from: "service:perkos-api",
      text: "Plan approved",
      timestamp: "2026-07-17T10:00:00.000Z",
      event: {
        domain: "project_workflow",
        type: "plan_approved",
        projectId: "1",
      },
    });
    expect(seen).toEqual([
      expect.objectContaining({ domain: "project_workflow", type: "plan_approved" }),
    ]);
    client.stop();
  });

  it("delivers chat_message frames to the registered conv listener", async () => {
    const client = new ChatClient({
      url: "ws://test/chat",
      getToken: async () => "token",
    });
    client.start();
    await new Promise((r) => setTimeout(r, 5));
    activeFake!.push({ type: "auth_ok", session: { walletAddress: "0xabc" } });

    const received: string[] = [];
    const unsub = client.onMessage("c1", (msg) => received.push(msg.text));

    activeFake!.push({
      type: "chat_message",
      id: "m1",
      convId: "c1",
      from: "agent:apollo",
      text: "hello",
      timestamp: "2026-05-20T10:00:00.000Z",
    });
    activeFake!.push({
      type: "chat_message",
      id: "m2",
      convId: "OTHER",
      from: "agent:apollo",
      text: "irrelevant",
      timestamp: "2026-05-20T10:01:00.000Z",
    });

    expect(received).toEqual(["hello"]);

    unsub();
    activeFake!.push({
      type: "chat_message",
      id: "m3",
      convId: "c1",
      from: "agent:apollo",
      text: "should-not-arrive",
      timestamp: "2026-05-20T10:02:00.000Z",
    });
    expect(received).toEqual(["hello"]);
    client.stop();
  });

  it("threads toolCalls through chat_message frames and drops malformed entries", async () => {
    const client = new ChatClient({
      url: "ws://test/chat",
      getToken: async () => "token",
    });
    client.start();
    await new Promise((r) => setTimeout(r, 5));
    activeFake!.push({ type: "auth_ok", session: { walletAddress: "0xabc" } });

    const seen: Array<{ id: string; toolCalls?: unknown }> = [];
    client.onMessage("c1", (msg) => seen.push({ id: msg.id, toolCalls: msg.toolCalls }));

    activeFake!.push({
      type: "chat_message",
      id: "tc1",
      convId: "c1",
      from: "agent:apollo",
      text: "ran ls",
      timestamp: "2026-05-20T10:00:00.000Z",
      toolCalls: [
        { id: "a", name: "Bash", status: "ok", summary: "ls", durationMs: 12 },
        { id: "b", name: "Read", status: "not-a-real-status" }, // status falls back to "ok"
        { name: "MissingId", status: "ok" }, // dropped
        "not-an-object", // dropped
      ],
    });
    activeFake!.push({
      type: "chat_message",
      id: "tc2",
      convId: "c1",
      from: "agent:apollo",
      text: "no tools",
      timestamp: "2026-05-20T10:01:00.000Z",
      toolCalls: [], // empty array normalizes to undefined
    });
    activeFake!.push({
      type: "chat_message",
      id: "tc3",
      convId: "c1",
      from: "agent:apollo",
      text: "no field",
      timestamp: "2026-05-20T10:02:00.000Z",
    });

    expect(seen).toHaveLength(3);
    const tc1 = seen[0].toolCalls as Array<{ id: string; status: string; durationMs?: number }>;
    expect(tc1).toHaveLength(2);
    expect(tc1[0]).toMatchObject({ id: "a", status: "ok", durationMs: 12 });
    expect(tc1[1]).toMatchObject({ id: "b", status: "ok" });

    expect(seen[1].toolCalls).toBeUndefined();
    expect(seen[2].toolCalls).toBeUndefined();
    client.stop();
  });
});
