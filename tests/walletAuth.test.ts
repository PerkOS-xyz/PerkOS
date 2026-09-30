import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ mint: vi.fn(), activity: vi.fn(), signOut: vi.fn(), auth: { currentUser: null as { uid: string } | null } }));
vi.mock("firebase/auth", () => ({ signInWithCustomToken: mocks.mint, signOut: mocks.signOut }));
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
  mocks.auth.currentUser = null;
  mocks.signOut.mockResolvedValue(undefined);
  mocks.mint.mockResolvedValue({ user: { uid: solana } });
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
    mocks.mint.mockResolvedValueOnce({ user: { uid: evm.toLowerCase() } });
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("account-bound sign-in cancellation", () => {
  it("does not request a nonce for an already cancelled attempt", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(signInWithWallet({ address: solana, signMessage: signer, signal: controller.signal })).rejects.toHaveProperty("name", "AbortError");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"] as const)("detaches from a cancelled wallet prompt and consumes its late %s", async outcome => {
    const prompt = deferred<string>();
    signer.mockReturnValueOnce(prompt.promise);
    const controller = new AbortController();
    const attempt = signInWithWallet({ address: solana, signMessage: signer, signal: controller.signal });
    const rejection = expect(attempt).rejects.toHaveProperty("name", "AbortError");
    await vi.waitFor(() => expect(signer).toHaveBeenCalledOnce());
    controller.abort();
    await rejection;
    if (outcome === "resolve") prompt.resolve("late signature");
    else prompt.reject(new Error("late provider rejection"));
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mocks.mint).not.toHaveBeenCalled();
  });

  it.each(["nonce", "exchange"] as const)("does not advance after a stale %s response body", async stage => {
    const body = deferred<object>();
    fetchMock.mockReset();
    if (stage === "exchange") fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ nonce: "n", message: "m" }) });
    const json = vi.fn(() => body.promise);
    fetchMock.mockResolvedValueOnce({ ok: true, json });
    const controller = new AbortController();
    const attempt = signInWithWallet({ address: solana, signMessage: signer, signal: controller.signal });
    const rejection = expect(attempt).rejects.toHaveProperty("name", "AbortError");
    await vi.waitFor(() => expect(json).toHaveBeenCalledOnce());
    controller.abort();
    body.resolve(stage === "nonce" ? { nonce: "n", message: "m" } : { token: "late-token" });
    await rejection;
    expect(mocks.mint).not.toHaveBeenCalled();
    if (stage === "nonce") expect(signer).not.toHaveBeenCalled();
  });

  it("removes a late non-cancellable Firebase commit before completing cancellation", async () => {
    const commit = deferred<{ user: { uid: string } }>();
    mocks.mint.mockReturnValueOnce(commit.promise);
    const controller = new AbortController();
    const attempt = signInWithWallet({ address: solana, signMessage: signer, signal: controller.signal });
    const rejection = expect(attempt).rejects.toHaveProperty("name", "AbortError");
    await vi.waitFor(() => expect(mocks.mint).toHaveBeenCalledOnce());
    controller.abort();
    commit.resolve({ user: { uid: solana } });
    await rejection;
    expect(mocks.signOut).toHaveBeenCalledWith(mocks.auth);
    expect(mocks.activity).not.toHaveBeenCalled();
  });

  it("rejects and clears a Firebase identity that does not exactly match the wallet", async () => {
    mocks.mint.mockResolvedValueOnce({ user: { uid: solana.toLowerCase() } });
    await expect(signInWithWallet({ address: solana, signMessage: signer })).rejects.toThrow("did not match");
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.activity).not.toHaveBeenCalled();
  });

  it("clears a previous account before committing a replacement", async () => {
    mocks.auth.currentUser = { uid: evm.toLowerCase() };
    await signInWithWallet({ address: solana, signMessage: signer });
    expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(mocks.mint.mock.invocationCallOrder[0]);
    expect(mocks.activity).toHaveBeenCalledOnce();
  });
});
