import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authedFetch: vi.fn() }));
vi.mock("../app/lib/apiClient", () => ({ authedFetch: mocks.authedFetch }));

import { rotateEncryptedVoiceCredential } from "../app/lib/perkosApi";

describe("rotateEncryptedVoiceCredential", () => {
  beforeEach(() => mocks.authedFetch.mockReset());

  it("sends only the public key and returns allow-listed ciphertext", async () => {
    mocks.authedFetch.mockResolvedValue(new Response(JSON.stringify({
      encryptedCredential: {
        algorithm: "RSA-OAEP-256",
        ciphertext: "base64-ciphertext",
        ignoredServerField: "not-forwarded",
      },
      credential: "must-not-be-returned",
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await rotateEncryptedVoiceCredential("agent / bragi", "PUBLIC KEY");
    expect(mocks.authedFetch).toHaveBeenCalledWith(
      "/api/agents/agent%20%2F%20bragi/voice-credential/rotate-encrypted",
      expect.objectContaining({ method: "POST" }),
    );
    const init = mocks.authedFetch.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ publicKeyPem: "PUBLIC KEY" });
    expect(result).toEqual({ algorithm: "RSA-OAEP-256", ciphertext: "base64-ciphertext" });
  });

  it("fails closed on plaintext-only responses", async () => {
    mocks.authedFetch.mockResolvedValue(new Response(JSON.stringify({
      credential: "must-not-appear-in-error",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    await expect(rotateEncryptedVoiceCredential("bragi", "PUBLIC KEY"))
      .rejects.toThrow("invalid encrypted envelope");
  });
});
