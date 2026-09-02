import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authedFetch: vi.fn() }));
vi.mock("../app/lib/apiClient", () => ({ authedFetch: mocks.authedFetch }));

import { createA2AMaintenanceUpdate, getA2AMaintenanceUpdate, prepareA2AVoiceEnrollment, requestVoiceSupportProbe, rotateVoiceGatewayCredential } from "../app/lib/perkosApi";

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

describe("A2A Voice enrollment API", () => {
  beforeEach(() => mocks.authedFetch.mockReset());

  it("prepares only a fixed non-secret prompt", async () => {
    mocks.authedFetch.mockResolvedValue(new Response(JSON.stringify({
      prompt: "PERKOS_VOICE_ENROLL",
      capability: { state: "enrolling", updatedAt: "2026-09-01T12:00:00.000Z" },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(prepareA2AVoiceEnrollment("athena")).resolves.toEqual({
      prompt: "PERKOS_VOICE_ENROLL",
      capability: { state: "enrolling", updatedAt: "2026-09-01T12:00:00.000Z" },
    });
    expect(mocks.authedFetch).toHaveBeenCalledWith("/api/agents/athena/voice-credential/prepare-a2a", { method: "POST" });
  });

  it("requests a support probe without minting credentials", async () => {
    mocks.authedFetch.mockResolvedValue(new Response(JSON.stringify({
      prompt: "PERKOS_VOICE_PROBE",
      capability: { state: "unknown", updatedAt: "2026-09-01T12:00:00.000Z" },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(requestVoiceSupportProbe("athena")).resolves.toMatchObject({ prompt: "PERKOS_VOICE_PROBE" });
    expect(JSON.stringify(mocks.authedFetch.mock.calls)).not.toContain("credential\":");
  });
});

describe("managed A2A maintenance API", () => {
  beforeEach(() => mocks.authedFetch.mockReset());

  const request = {
    requestId: "1e1719e8-7e50-4dad-a7cf-754a86699d7d",
    state: "pending",
    targetVersion: "0.12.64",
    createdAt: "2026-09-02T12:00:00.000Z",
    expiresAt: "2026-09-02T12:10:00.000Z",
  };
  const bridgeInstanceId = "16df04b5-706e-4dad-b303-3c78f67b989f";

  it("creates an instance-bound opaque marker without a command or credential", async () => {
    const marker = `PERKOS_A2A_UPDATE:${request.requestId}:${bridgeInstanceId}`;
    mocks.authedFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, marker, request }), { status: 201 }));
    await expect(createA2AMaintenanceUpdate("agent / athena")).resolves.toEqual({ marker, request });
    expect(mocks.authedFetch).toHaveBeenCalledWith("/api/agents/agent%20%2F%20athena/maintenance/a2a-update", { method: "POST" });
    expect(marker).not.toMatch(/npx|relayApiKey|rk_/i);
  });

  it.each([
    `PERKOS_A2A_UPDATE:${request.requestId}`,
    `PERKOS_A2A_UPDATE:${request.requestId}:not-an-instance`,
    `PERKOS_A2A_UPDATE:${request.requestId}:${bridgeInstanceId}:extra`,
  ])("fails closed for a marker outside the instance-bound contract: %s", async (marker) => {
    mocks.authedFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, marker, request }), { status: 201 }));
    await expect(createA2AMaintenanceUpdate("athena")).rejects.toThrow("invalid marker");
  });

  it("loads the durable request state", async () => {
    mocks.authedFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, request: { ...request, state: "completed", installedVersion: "0.12.63" } }), { status: 200 }));
    await expect(getA2AMaintenanceUpdate("athena", request.requestId)).resolves.toMatchObject({ state: "completed", installedVersion: "0.12.63" });
    expect(mocks.authedFetch).toHaveBeenCalledWith(`/api/agents/athena/maintenance/a2a-update/${request.requestId}`, { method: "GET" });
  });
});
