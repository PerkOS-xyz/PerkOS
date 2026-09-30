import React, { StrictMode, useEffect } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as { uid: string } | null },
  snapshot: { user: null as { uid: string } | null, loading: false },
  listeners: new Set<() => void>(),
  mint: vi.fn(), signOut: vi.fn(), activity: vi.fn(), disconnect: vi.fn(), miniSigner: vi.fn(),
  connection: { address: undefined as string | undefined, isConnected: false, status: "disconnected" },
}));
vi.mock("firebase/auth", () => ({ signInWithCustomToken: mocks.mint, signOut: mocks.signOut }));
vi.mock("../app/lib/firebase", () => ({ firebaseAuth: () => mocks.auth }));
vi.mock("../app/lib/activityTelemetry", () => ({ recordActivity: mocks.activity }));
vi.mock("wagmi", () => ({
  useConnection: () => mocks.connection,
  useSignMessage: () => ({ signMessageAsync: mocks.miniSigner }),
  useDisconnect: () => ({ disconnect: mocks.disconnect }),
}));
vi.mock("../app/lib/useFirebaseUser", async () => {
  const { useSyncExternalStore } = await import("react");
  return { useFirebaseUser: () => useSyncExternalStore(
    listener => { mocks.listeners.add(listener); return () => { mocks.listeners.delete(listener); }; },
    () => mocks.snapshot,
  ) };
});
import { BrowserWalletContext, type BrowserWalletState } from "../app/lib/browserWallet";
import { useWalletSession } from "../app/lib/useWalletSession";

// Public test fixtures only. No real wallet or authentication service is used.
const A = "So11111111111111111111111111111111111111112";
const B = "0xabcdefabcdef1234567890123456789012345678";
const sessions: ReturnType<typeof useWalletSession>[] = [];
const fetchMock = vi.fn();
function publish(uid: string | null) {
  mocks.auth.currentUser = uid ? { uid } : null;
  mocks.snapshot = { user: mocks.auth.currentUser, loading: false };
  mocks.listeners.forEach(listener => listener());
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
function wallet(address?: string): BrowserWalletState {
  return { address, isConnected: Boolean(address), loading: false,
    signMessage: vi.fn(async () => "test-signature"), logout: vi.fn(async () => {}) };
}
function Probe({ index }: { index: number }) {
  const session = useWalletSession();
  useEffect(() => { sessions[index] = session; }, [index, session]);
  return <output data-testid={`status-${index}`}>{session.status}</output>;
}
function Harness({ value, count = 2 }: { value: BrowserWalletState | null; count?: number }) {
  return <StrictMode><BrowserWalletContext.Provider value={value}>
    {Array.from({ length: count }, (_, index) => <Probe key={index} index={index} />)}
  </BrowserWalletContext.Provider></StrictMode>;
}
async function allStatus(status: string) {
  await waitFor(() => screen.getAllByTestId(/^status-/).forEach(node => expect(node.textContent).toBe(status)));
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SOLANA_LOGIN_ENABLED", "true");
  vi.stubGlobal("fetch", fetchMock);
  mocks.auth.currentUser = null;
  mocks.snapshot = { user: null, loading: false };
  mocks.connection = { address: undefined, isConnected: false, status: "disconnected" };
  mocks.signOut.mockImplementation(async () => { publish(null); });
  mocks.mint.mockImplementation(async (_auth, token: string) => { publish(token); return { user: { uid: token } }; });
  mocks.miniSigner.mockResolvedValue("mini-signature");
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url.includes("/nonce?")) return { ok: true, json: async () => ({ nonce: "nonce", message: "Sign challenge" }) };
    const { address } = JSON.parse(String(options?.body));
    return { ok: true, json: async () => ({ token: address }) };
  });
  // Mounting a disconnected provider clears any prior explicit logout hold.
  const reset = render(<Harness value={wallet()} />);
  reset.unmount();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("wallet session lifecycle across providers and consumers", () => {
  it("shares one signature in StrictMode and does not let disconnected wagmi clear Dynamic", async () => {
    const provider = wallet(A);
    render(<Harness value={provider} />);
    await allStatus("signed-in");
    expect(provider.signMessage).toHaveBeenCalledOnce();
    expect(mocks.mint).toHaveBeenCalledOnce();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("retains the Mini App signer and canonical EVM identity without Dynamic", async () => {
    mocks.connection = { address: B.toUpperCase().replace("0X", "0x"), isConnected: true, status: "connected" };
    render(<Harness value={null} />);
    await allStatus("signed-in");
    expect(mocks.miniSigner).toHaveBeenCalledOnce();
    expect(mocks.auth.currentUser?.uid).toBe(B);
  });

  it("switches accounts while the old provider prompt remains open without using its late signature", async () => {
    const prompt = deferred<string>();
    const first = wallet(A);
    first.signMessage = vi.fn(() => prompt.promise);
    const view = render(<Harness value={first} />);
    await waitFor(() => expect(first.signMessage).toHaveBeenCalledOnce());
    const next = wallet(B);
    view.rerender(<Harness value={next} />);
    await allStatus("signed-in");
    await act(async () => { prompt.resolve("late signature"); });
    expect(mocks.auth.currentUser?.uid).toBe(B);
    expect(next.signMessage).toHaveBeenCalledOnce();
    expect(mocks.mint).toHaveBeenCalledTimes(1);
    expect(mocks.activity).toHaveBeenCalledTimes(1);
  });

  it("waits for stale Firebase cleanup before committing the replacement account", async () => {
    const commit = deferred<void>();
    const order: string[] = [];
    mocks.mint.mockImplementationOnce(async () => {
      await commit.promise; publish(A); order.push("commit A"); return { user: { uid: A } };
    });
    mocks.signOut.mockImplementation(async () => { publish(null); order.push("clean A"); });
    const view = render(<Harness value={wallet(A)} />);
    await waitFor(() => expect(mocks.mint).toHaveBeenCalledOnce());
    const next = wallet(B);
    view.rerender(<Harness value={next} />);
    expect(next.signMessage).not.toHaveBeenCalled();
    await act(async () => { commit.resolve(); });
    await allStatus("signed-in");
    expect(order).toEqual(["commit A", "clean A"]);
    expect(mocks.auth.currentUser?.uid).toBe(B);
    expect(mocks.activity).toHaveBeenCalledTimes(1);
    expect(mocks.activity.mock.calls[0][0].uid).toBe(B);
  });

  it("cancels a signature when the provider enters account restoration", async () => {
    const prompt = deferred<string>();
    const first = wallet(A);
    first.signMessage = vi.fn(() => prompt.promise);
    const view = render(<Harness value={first} />);
    await waitFor(() => expect(first.signMessage).toHaveBeenCalledOnce());
    view.rerender(<Harness value={{ ...first, loading: true }} />);
    await act(async () => { prompt.resolve("stale signature"); });
    await allStatus("loading");
    expect(mocks.mint).not.toHaveBeenCalled();
    view.rerender(<Harness value={wallet(B)} />);
    await allStatus("signed-in");
    expect(mocks.auth.currentUser?.uid).toBe(B);
  });

  it("keeps logout effective even when the provider fails to disconnect, and supports explicit retry", async () => {
    const prompt = deferred<string>();
    const provider = wallet(A);
    provider.signMessage = vi.fn().mockReturnValueOnce(prompt.promise).mockResolvedValue("retry signature");
    provider.logout = vi.fn(async () => { throw new Error("provider unavailable"); });
    render(<Harness value={provider} />);
    await waitFor(() => expect(provider.signMessage).toHaveBeenCalledOnce());
    await act(async () => { await sessions[0].logout(); });
    await allStatus("signed-out");
    await act(async () => { prompt.resolve("late signature"); });
    expect(mocks.mint).not.toHaveBeenCalled();
    expect(provider.signMessage).toHaveBeenCalledOnce();
    await act(async () => { sessions[0].retry(); });
    await allStatus("signed-in");
    expect(provider.signMessage).toHaveBeenCalledTimes(2);
  });

  it("cleans up an uncancellable Firebase commit during logout", async () => {
    const commit = deferred<void>();
    mocks.mint.mockImplementationOnce(async () => { await commit.promise; publish(A); return { user: { uid: A } }; });
    render(<Harness value={wallet(A)} />);
    await waitFor(() => expect(mocks.mint).toHaveBeenCalledOnce());
    await act(async () => {
      const logout = sessions[0].logout();
      commit.resolve();
      await logout;
    });
    await allStatus("signed-out");
    expect(mocks.auth.currentUser).toBeNull();
    expect(mocks.activity).not.toHaveBeenCalled();
    expect(mocks.mint).toHaveBeenCalledOnce();
  });

  it("resumes a different wallet selected while provider logout is still pending", async () => {
    const providerLogout = deferred<void>();
    const provider = wallet(A);
    provider.logout = vi.fn(() => providerLogout.promise);
    const view = render(<Harness value={provider} />);
    await allStatus("signed-in");
    let logout!: Promise<void>;
    act(() => { logout = sessions[0].logout(); });
    const next = wallet(B);
    view.rerender(<Harness value={next} />);
    expect(next.signMessage).not.toHaveBeenCalled();
    await act(async () => { providerLogout.resolve(); await logout; });
    await allStatus("signed-in");
    expect(mocks.auth.currentUser?.uid).toBe(B);
    expect(next.signMessage).toHaveBeenCalledOnce();
  });

  it("cancels on last consumer unmount, but not when one of two consumers leaves", async () => {
    const prompt = deferred<string>();
    const provider = wallet(A);
    provider.signMessage = vi.fn(() => prompt.promise);
    const view = render(<Harness value={provider} />);
    await waitFor(() => expect(provider.signMessage).toHaveBeenCalledOnce());
    view.rerender(<Harness value={provider} count={1} />);
    await act(async () => { prompt.resolve("valid signature"); });
    await allStatus("signed-in");
    const nextPrompt = deferred<string>();
    const next = wallet(B);
    next.signMessage = vi.fn(() => nextPrompt.promise);
    view.rerender(<Harness value={next} count={1} />);
    await waitFor(() => expect(next.signMessage).toHaveBeenCalledOnce());
    view.unmount();
    await act(async () => { nextPrompt.resolve("cancelled signature"); });
    expect(mocks.mint).toHaveBeenCalledOnce();
    expect(mocks.auth.currentUser?.uid).toBe(A);
  });

  it("shares signature rejection without automatic retry loops", async () => {
    const provider = wallet(A);
    provider.signMessage = vi.fn(async () => { throw new Error("user rejected"); });
    render(<Harness value={provider} />);
    await allStatus("error");
    expect(provider.signMessage).toHaveBeenCalledOnce();
    expect(mocks.mint).not.toHaveBeenCalled();
  });
});
