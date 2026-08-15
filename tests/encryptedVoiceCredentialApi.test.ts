import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authedFetch: vi.fn() }));
vi.mock("../app/lib/apiClient", () => ({ authedFetch: mocks.authedFetch }));

import { rotateEncryptedVoiceCredentialDelivery } from "../app/lib/perkosApi";

describe("rotateEncryptedVoiceCredentialDelivery", () => {
  beforeEach(() => mocks.authedFetch.mockReset());

  it("sends only the public key and returns allow-listed delivery metadata", async () => {
    mocks.authedFetch.mockResolvedValue(new Response(JSON.stringify({
      delivery: {
        id: "delivery-id",
        claimId: "claim-id",
        algorithm: "RSA-OAEP-256",
        audience: "perkos-voice-gateway-v1",
        publicKeyFingerprint: "fingerprint",
        expiresAt: "2026-08-15T01:00:00.000Z",
        ciphertext: "must-not-be-forwarded",
        ignoredServerField: "not-forwarded",
      },
      credential: "must-not-be-returned",
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await rotateEncryptedVoiceCredentialDelivery("agent / bragi", "PUBLIC KEY");
    expect(mocks.authedFetch).toHaveBeenCalledWith(
      "/api/agents/agent%20%2F%20bragi/voice-credential/rotate-encrypted-delivery",
      expect.objectContaining({ method: "POST" }),
    );
    const init = mocks.authedFetch.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ publicKeyPem: "PUBLIC KEY" });
    expect(result).toEqual({
      id: "delivery-id", claimId: "claim-id", algorithm: "RSA-OAEP-256",
      audience: "perkos-voice-gateway-v1", publicKeyFingerprint: "fingerprint",
      expiresAt: "2026-08-15T01:00:00.000Z",
    });
  });

  it("fails closed on plaintext-only responses", async () => {
    mocks.authedFetch.mockResolvedValue(new Response(JSON.stringify({
      credential: "must-not-appear-in-error",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(rotateEncryptedVoiceCredentialDelivery("bragi", "PUBLIC KEY"))
      .rejects.toThrow("invalid delivery metadata");
  });
});
