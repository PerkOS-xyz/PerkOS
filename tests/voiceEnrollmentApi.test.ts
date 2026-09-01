import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authedFetch: vi.fn() }));
vi.mock("../app/lib/apiClient", () => ({ authedFetch: mocks.authedFetch }));

import { rotateVoiceGatewayCredential } from "../app/lib/perkosApi";

describe("rotateVoiceGatewayCredential", () => {
  beforeEach(() => mocks.authedFetch.mockReset());

  it("rotates an agent-scoped credential only after an explicit call", async () => {
    mocks.authedFetch.mockResolvedValue(new Response(JSON.stringify({
      credential: "vgc_test_abcdefghijklmnopqrstuvwxyz",
      audience: "perkos-voice-gateway-grant:v1",
      expiresAt: "2026-09-02T12:00:00.000Z",
      ignored: "not-forwarded",
    }), { status: 200, headers: { "content-type": "application/json" } }));

    await expect(rotateVoiceGatewayCredential("agent / athena")).resolves.toEqual({
      credential: "vgc_test_abcdefghijklmnopqrstuvwxyz",
      audience: "perkos-voice-gateway-grant:v1",
      expiresAt: "2026-09-02T12:00:00.000Z",
    });
    expect(mocks.authedFetch).toHaveBeenCalledWith(
      "/api/agents/agent%20%2F%20athena/voice-credential/rotate",
      { method: "POST" },
    );
  });

  it("fails closed when the response is not the expected credential contract", async () => {
    mocks.authedFetch.mockResolvedValue(new Response(JSON.stringify({ credential: "short" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    await expect(rotateVoiceGatewayCredential("athena")).rejects.toThrow("invalid enrollment data");
  });
});
