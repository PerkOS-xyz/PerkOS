"use client";

import { useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useConnection, useDisconnect, useSignMessage } from "wagmi";
import { signOut } from "firebase/auth";

import { firebaseAuth } from "./firebase";
import { signInWithWallet } from "./walletAuth";
import { useFirebaseUser } from "./useFirebaseUser";
import { BrowserWalletContext } from "./browserWallet";
import { normalizeWalletAddress } from "@perkos/shared-types";
import { WalletSignInCoordinator } from "./walletSignInCoordinator";

/**
 * Module-level mutex shared by every useWalletSession() consumer in
 * the app. The hook is called from at least four places at once
 * during a typical flow (landing's LandingAutoRoute, /continue, the
 * (app) layout guard, /sign-in), and each call is an independent React
 * instance with its own state. Without a shared promise, each instance
 * fires its own signInWithWallet → the wallet receives multiple
 * personal_sign requests with different nonces queued up.
 *
 * The coordinator shares one flight per account generation, cancels stale
 * prompts, and serializes Firebase commits and their cleanup.
 */
const coordinator = new WalletSignInCoordinator();
let sessionConsumers = 0;

export type WalletSessionStatus =
  /** waiting for the wallet or Firebase to settle */
  | "loading"
  /** wallet disconnected, no Firebase session — user must sign in */
  | "signed-out"
  /** wallet connected, Firebase signed in, addresses match */
  | "signed-in"
  /** wallet connected but Firebase rejected (server-side allowlist denial) */
  | "not-allowlisted"
  /** wallet connected, Firebase signing in progress */
  | "syncing"
  /** unrecoverable error (signature failed, network down, etc.) */
  | "error";

type Result = {
  status: WalletSessionStatus;
  address?: string;
  identityLabel?: string;
  error?: string;
  retry: () => void;
  signOutFirebase: () => Promise<void>;
  /**
   * Full sign-out: tears down the wallet (Dynamic in the browser, wagmi in
   * Mini App hosts) AND the Firebase session. Use this for the logout button,
   * not a bare wagmi `disconnect()` (a no-op on the browser/Dynamic path).
   */
  logout: () => Promise<void>;
};

export function resolveWalletSessionStatus({
  firebaseLoading,
  browserWalletLoading,
  hasBrowserWallet,
  wagmiStatus,
  isConnected,
  denial,
  syncing,
  inSync,
}: {
  firebaseLoading: boolean;
  browserWalletLoading: boolean;
  hasBrowserWallet: boolean;
  wagmiStatus: string;
  isConnected: boolean;
  denial: "not-allowlisted" | "error" | null;
  syncing: boolean;
  inSync: boolean;
}): WalletSessionStatus {
  if (firebaseLoading || browserWalletLoading) return "loading";
  if (
    !hasBrowserWallet &&
    (wagmiStatus === "connecting" || wagmiStatus === "reconnecting")
  ) {
    return "loading";
  }
  if (!isConnected) return "signed-out";
  if (denial === "not-allowlisted") return "not-allowlisted";
  if (denial === "error") return "error";
  if (syncing) return "syncing";
  if (inSync) return "signed-in";
  return "syncing";
}

/**
 * Glue layer between the connected wallet and Firebase Auth.
 *
 *  - When the wallet has an address but Firebase has no matching session, we
 *    automatically run `signInWithWallet` to upgrade it into a Firebase
 *    custom-token session.
 *  - We expose a coarse `status` so guarded routes can decide what to render
 *    (loading skeleton vs AccessGate vs the app itself).
 *
 * Wallet source depends on the host:
 *  - Mini App hosts (Farcaster / Base App): wagmi (`useConnection`), connected
 *    by AutoConnect through the host connector.
 *  - Regular browser tab: Dynamic, via BrowserWalletContext. The browser path
 *    reads address + connection + signer straight from Dynamic and leaves the
 *    Mini App wagmi connector tree isolated.
 *
 * Components that just need "is this user authorized?" check `status === "signed-in"`.
 */
export function useWalletSession(): Result {
  const {
    address: wagmiAddress,
    isConnected: wagmiIsConnected,
    status: wagmiStatus,
  } = useConnection();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const { user: firebaseUser, loading: firebaseLoading } = useFirebaseUser();

  // Browser/Dynamic path: when the context is present, Dynamic owns the wallet
  // and we read everything from it. In Mini App hosts it's null → use wagmi.
  const browserWallet = useContext(BrowserWalletContext);
  const address = browserWallet ? browserWallet.address : wagmiAddress;
  const isConnected = browserWallet
    ? browserWallet.isConnected
    : wagmiIsConnected;

  // Active signer (Dynamic-native or wagmi) held in a ref so runSignIn's
  // callback doesn't churn its deps when the source flips.
  const signMessageRef = useRef<(message: string) => Promise<string>>(
    (message) => signMessageAsync({ message }),
  );
  useEffect(() => {
    signMessageRef.current = browserWallet
      ? browserWallet.signMessage
      : (message: string) => signMessageAsync({ message });
  }, [browserWallet, signMessageAsync]);

  const [attempt, setAttempt] = useState<{
    wallet?: string; syncing: boolean; denial: "not-allowlisted" | "error" | null; error?: string;
  }>({ syncing: false, denial: null });
  const localRun = useRef(0);
  const mounted = useRef(false);

  const normalizedAddress = address ? normalizeWalletAddress(address) : undefined;
  const blockedWallet = useSyncExternalStore(coordinator.subscribe, coordinator.getBlockedWallet, () => null);
  const loggingOut = useSyncExternalStore(coordinator.subscribe, coordinator.getLoggingOut, () => false);
  const logoutSuppressed = Boolean(normalizedAddress && blockedWallet === normalizedAddress);
  const currentAttempt = attempt.wallet === normalizedAddress ? attempt : null;
  const syncing = currentAttempt?.syncing ?? false;
  const denial = currentAttempt?.denial ?? null;
  const errorMessage = currentAttempt?.error;
  const walletLoading = browserWallet ? browserWallet.loading
    : wagmiStatus === "connecting" || wagmiStatus === "reconnecting";
  const inSync =
    firebaseUser && normalizedAddress
      ? firebaseUser.uid === normalizedAddress
      : false;

  useEffect(() => {
    mounted.current = true;
    sessionConsumers += 1;
    return () => {
      mounted.current = false;
      localRun.current += 1;
      sessionConsumers -= 1;
      if (sessionConsumers === 0) coordinator.invalidate();
    };
  }, []);

  useEffect(() => {
    if (loggingOut) return;
    if (walletLoading) { coordinator.invalidate(); return; }
    coordinator.select(isConnected && normalizedAddress ? normalizedAddress : null);
  }, [isConnected, normalizedAddress, walletLoading, loggingOut]);

  const runSignIn = useCallback(async () => {
    if (coordinator.getLoggingOut() || logoutSuppressed || walletLoading || !isConnected || !normalizedAddress) return;
    const run = ++localRun.current;
    const signer = signMessageRef.current;
    setAttempt({ wallet: normalizedAddress, syncing: true, denial: null });

    try {
      await coordinator.run(normalizedAddress, signal => signInWithWallet({
        address: normalizedAddress, signMessage: signer, signal,
      }));
    } catch (err) {
      if (!mounted.current || localRun.current !== run || (err instanceof Error && err.name === "AbortError")) return;
      const msg = err instanceof Error ? err.message : "Sign-in failed.";
      setAttempt({ wallet: normalizedAddress, syncing: false,
        denial: msg.toLowerCase().includes("allowlist") ? "not-allowlisted" : "error", error: msg });
    } finally {
      if (mounted.current && localRun.current === run) setAttempt(current => ({ ...current, syncing: false }));
    }
  }, [isConnected, normalizedAddress, walletLoading, logoutSuppressed]);

  // When the wallet has an address and there's no matching Firebase session,
  // run the sign-in flow exactly once. The user can `retry()` if it failed.
  useEffect(() => {
    if (loggingOut) return; // a logout is tearing the session down
    if (firebaseLoading) return;
    if (walletLoading) return;
    if (!isConnected || !normalizedAddress) return;
    if (inSync) return;
    if (syncing) return;
    if (denial) return; // wait for explicit retry
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void runSignIn();
    });
    return () => {
      cancelled = true;
    };
  }, [
    loggingOut,
    firebaseLoading,
    walletLoading,
    isConnected,
    normalizedAddress,
    inSync,
    syncing,
    denial,
    runSignIn,
  ]);

  // Disconnect applies to the active provider only, after wallet restoration.
  // Serialize with any non-cancellable Firebase commit already in flight.
  useEffect(() => {
    if (!loggingOut && !walletLoading && !isConnected && firebaseUser) {
      void coordinator.run(null, async signal => {
        signal.throwIfAborted();
        await signOut(firebaseAuth());
      }).catch(() => {});
    }
  }, [walletLoading, isConnected, firebaseUser, loggingOut]);

  // Full logout: drop the wallet on whichever path owns it, then the Firebase
  // session. `loggingOut` suppresses the auto-sign-in effect so clearing
  // Firebase doesn't immediately re-trigger a signature prompt. Order matters:
  // log the wallet out FIRST (so `isConnected` flips false) before signing out
  // of Firebase.
  const logout = useCallback(async () => {
    if (coordinator.getLoggingOut()) return;
    coordinator.setLoggingOut(true);
    coordinator.suspend(normalizedAddress ?? null);
    localRun.current += 1;
    try {
      // Browser/Dynamic path: clears the active user. No-op elsewhere.
      if (browserWallet) {
        try {
          await browserWallet.logout();
        } catch {
          // best-effort — still clear the rest below
        }
      }
      // Mini App / in-app browser (and any stale browser wagmi connection).
      try {
        disconnect();
      } catch {
        // ignore
      }
      // Firebase custom-token session.
      try {
        await coordinator.run(null, async () => { await signOut(firebaseAuth()); });
      } catch {
        // ignore
      }
      if (mounted.current) setAttempt({ syncing: false, denial: null });
    } finally {
      coordinator.setLoggingOut(false);
    }
  }, [browserWallet, disconnect, normalizedAddress]);

  const status = resolveWalletSessionStatus({
    firebaseLoading,
    browserWalletLoading: browserWallet?.loading ?? false,
    hasBrowserWallet: Boolean(browserWallet),
    wagmiStatus,
    isConnected,
    denial,
    syncing,
    inSync,
  });

  return {
    status: loggingOut || logoutSuppressed ? "signed-out" : status,
    address: normalizedAddress,
    identityLabel: browserWallet?.identityLabel,
    error: errorMessage,
    retry: () => {
      if (logoutSuppressed && normalizedAddress) {
        coordinator.resume(normalizedAddress);
        setAttempt({ syncing: false, denial: null });
      } else { void runSignIn(); }
    },
    signOutFirebase: async () => {
      coordinator.suspend(normalizedAddress ?? null);
      await coordinator.run(null, async () => { await signOut(firebaseAuth()); });
    },
    logout,
  };
}
