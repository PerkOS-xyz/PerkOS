import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { redeemSolanaAccessCode } from "../app/lib/redeemSolanaAccessCode";

const address = "So11111111111111111111111111111111111111112";
const input = { address, code: "test20", email: "test@example.com", username: "tester" };
const fetchMock = vi.fn();
const signer = vi.fn();
let controller: AbortController;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
beforeEach(() => {
  vi.clearAllMocks(); fetchMock.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SOLANA_LOGIN_ENABLED", "true"); vi.stubGlobal("fetch", fetchMock);
  controller = new AbortController(); signer.mockResolvedValue("test-signature");
  fetchMock.mockResolvedValueOnce(json({ nonce: "nonce", message: "Redeem an access code" }));
  fetchMock.mockResolvedValueOnce(json({ granted: true }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Solana signed access code client", () => {
  it("uses the dedicated proof endpoints and preserves exact wallet case", async () => {
    await redeemSolanaAccessCode(input, signer, controller.signal);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/platform/auth/access-code/nonce");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ address });
    expect(signer).toHaveBeenCalledWith("Redeem an access code");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/platform/auth/access-code/redeem");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ ...input, nonce: "nonce", signature: "test-signature" });
  });
  it("fails closed with the flag disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOLANA_LOGIN_ENABLED", "false");
    await expect(redeemSolanaAccessCode(input, signer, controller.signal)).rejects.toThrow("not available");
    expect(fetchMock).not.toHaveBeenCalled(); expect(signer).not.toHaveBeenCalled();
  });
  it("rejects EVM and malformed addresses without requesting a signature", async () => {
    for (const address of ["invalid", "0xabcdefabcdef1234567890123456789012345678"]) {
      await expect(redeemSolanaAccessCode({ ...input, address }, signer, controller.signal)).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not redeem when signing is rejected", async () => {
    signer.mockRejectedValueOnce(new Error("Rejected"));
    await expect(redeemSolanaAccessCode(input, signer, controller.signal)).rejects.toThrow("Rejected");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("does not redeem a late signature after wallet change or logout", async () => {
    let complete!: (value: string) => void;
    signer.mockImplementationOnce(() => new Promise<string>(resolve => { complete = resolve; }));
    const pending = redeemSolanaAccessCode(input, signer, controller.signal);
    await vi.waitFor(() => expect(signer).toHaveBeenCalledTimes(1));
    controller.abort(); complete("late-signature");
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("surfaces API denials and does not treat missing granted as success", async () => {
    fetchMock.mockReset().mockResolvedValueOnce(json({ error: { message: "Disabled" } }, 403));
    await expect(redeemSolanaAccessCode(input, signer, controller.signal)).rejects.toThrow("Disabled");
    expect(signer).not.toHaveBeenCalled();
    fetchMock.mockReset().mockResolvedValueOnce(json({ nonce: "nonce", message: "Sign" })).mockResolvedValueOnce(json({}));
    await expect(redeemSolanaAccessCode(input, signer, controller.signal)).rejects.toThrow("not granted");
  });
});
