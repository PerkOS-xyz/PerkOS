import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authedFetch: vi.fn() }));
vi.mock("../app/lib/apiClient", () => ({ authedFetch: mocks.authedFetch }));

import { createVoiceGatewayGrantApi } from "../app/lib/perkosApi";

describe("createVoiceGatewayGrantApi", () => {
  beforeEach(() => mocks.authedFetch.mockReset());

  it("uses the documented endpoint and strict body", async () => {
    mocks.authedFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, grant: {
      url: "wss://voice.example.invalid", roomName: "perkos-room",
      token: "sensitive-token", expiresAt: "2030-01-01T00:02:00.000Z",
    } }), { status: 200, headers: { "content-type": "application/json" } }));
    const grant = await createVoiceGatewayGrantApi({
      projectId: "project / one", meetingId: "meeting / one", agentId: "Bragi",
      owner: "0x0000000000000000000000000000000000000001", voiceProcessingConsent: true,
    });
    expect(mocks.authedFetch).toHaveBeenCalledWith(
      "/api/projects/project%20%2F%20one/meetings/meeting%20%2F%20one/voice-gateway-grant",
      expect.objectContaining({ method: "POST" }),
    );
    const init = mocks.authedFetch.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      owner: "0x0000000000000000000000000000000000000001",
      projectId: "project / one", meetingId: "meeting / one", agentId: "Bragi",
      voiceProcessingConsent: true,
    });
    expect(grant.roomName).toBe("perkos-room");
  });

  it("rejects malformed responses without exposing credential values", async () => {
    mocks.authedFetch.mockResolvedValue(new Response(JSON.stringify({
      ok: true, grant: { token: "must-not-appear" },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(createVoiceGatewayGrantApi({
      projectId: "project-1", meetingId: "meeting-1", agentId: "Bragi",
      voiceProcessingConsent: true,
    })).rejects.toThrow("Voice gateway returned an invalid session grant.");
  });
});
