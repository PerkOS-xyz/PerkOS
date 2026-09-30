import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ mint: vi.fn(), activity: vi.fn(), auth: {} }));
vi.mock("firebase/auth", () => ({ signInWithCustomToken: mocks.mint }));
vi.mock("../app/lib/firebase", () => ({ firebaseAuth: () => mocks.auth }));
vi.mock("../app/lib/activityTelemetry", () => ({ recordActivity: mocks.activity }));
import { signInWithWallet } from "../app/lib/walletAuth";

// Public test fixture, not a user's account.
const solana = "So11111111111111111111111111111111111111112";
const evm = "0xABCDEFabcdef1234567890123456789012345678";
const fetchMock = vi.fn();
const signer = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_SOLANA_LOGIN_ENABLED", "true");
  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ nonce: "challenge", message: "Sign this challenge" }) });
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ token: "test-custom-token" }) });
  signer.mockResolvedValue("signature");
  mocks.mint.mockResolvedValue({ user: { uid: "test-user" } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("wallet authentication routing", () => {
  it("preserves the Solana address and declares its chain to the central verifier", async () => {
    await signInWithWallet({ address: solana, signMessage: signer });
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/platform/auth/nonce?address=${solana}`);
    const [url, request] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/platform/auth/wallet-signin");
    expect(JSON.parse(request.body)).toEqual({ address: solana, nonce: "challenge", signature: "signature", chain: "solana" });
    expect(signer).toHaveBeenCalledWith("Sign this challenge");
    expect(mocks.mint).toHaveBeenCalledWith(mocks.auth, "test-custom-token");
  });
  it("preserves the existing EVM endpoint and lowercase identity without adding a chain field", async () => {
    await signInWithWallet({ address: evm, signMessage: signer });
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/auth/nonce?address=${evm.toLowerCase()}`);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/wallet-signin");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ address: evm.toLowerCase(), nonce: "challenge", signature: "signature" });
  });
  it("fails closed before network or wallet prompts when Solana is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_SOLANA_LOGIN_ENABLED", "false");
    await expect(signInWithWallet({ address: solana, signMessage: signer })).rejects.toThrow("not available");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(signer).not.toHaveBeenCalled();
  });
  it("rejects invalid addresses before fetching", async () => {
    await expect(signInWithWallet({ address: "bad/path", signMessage: signer })).rejects.toThrow("Invalid wallet");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not exchange a token if the user rejects signing", async () => {
    signer.mockRejectedValueOnce(new Error("User rejected"));
    await expect(signInWithWallet({ address: solana, signMessage: signer })).rejects.toThrow("User rejected");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.mint).not.toHaveBeenCalled();
  });
  it("surfaces central verifier errors without signing into Firebase", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ nonce: "n", message: "m" }) });
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: "Nonce expired" } }) });
    await expect(signInWithWallet({ address: solana, signMessage: signer })).rejects.toThrow("Nonce expired");
    expect(mocks.mint).not.toHaveBeenCalled();
  });
});
