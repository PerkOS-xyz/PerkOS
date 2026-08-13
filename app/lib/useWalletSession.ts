"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useConnection, useDisconnect, useSignMessage } from "wagmi";
import { signOut } from "firebase/auth";

import { firebaseAuth } from "./firebase";
import { signInWithWallet } from "./walletAuth";
import { useFirebaseUser } from "./useFirebaseUser";
import { BrowserWalletContext } from "./browserWallet";

/**
 * Module-level mutex shared by every useWalletSession() consumer in
 * the app. The hook is called from at least four places at once
 * during a typical flow (landing's LandingAutoRoute, /continue, the
 * (app) layout guard, /sign-in), and each call is an independent React
 * instance with its own state. Without a shared promise, each instance
 * fires its own signInWithWallet → the wallet receives multiple
 * personal_sign requests with different nonces queued up.
 *
 * `pendingSignIn` holds the in-flight Promise so all instances await
 * the same one and their reactive state (firebaseUser, syncing) picks
 * up the result via the existing useFirebaseUser subscription.
 */
let pendingSignIn: Promise<unknown> | null = null;

/**
 * Set while `logout()` tears the session down. The auto-sign-in effect below
 * checks it so that clearing Firebase (firebaseUser → null) mid-logout doesn't
 * immediately re-trigger `signInWithWallet` (which would pop a fresh signature
 * prompt and re-log the user in). Module-level so it's shared across every
 * useWalletSession() instance, same as `pendingSignIn`.
 */
let loggingOut = false;

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
  error?: string;
  retry: () => void;
  signOutFirebase: () => Promise<void>;
  /**
   * Full sign-out: tears down the wallet (Privy in the browser, wagmi in
   * Mini App hosts) AND the Firebase session. Use this for the logout button,
   * not a bare wagmi `disconnect()` (a no-op on the browser/Privy path).
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
 *  - Regular browser tab: Privy, via BrowserWalletContext. The browser path
 *    reads address + connection + signer straight from Privy and leaves the
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

  // Browser/Privy path: when the context is present, Privy owns the wallet
  // and we read everything from it. In Mini App hosts it's null → use wagmi.
  const browserWallet = useContext(BrowserWalletContext);
  const address = browserWallet ? browserWallet.address : wagmiAddress;
  const isConnected = browserWallet
    ? browserWallet.isConnected
    : wagmiIsConnected;

  // Active signer (Privy-native or wagmi) held in a ref so runSignIn's
  // callback doesn't churn its deps when the source flips.
  const signMessageRef = useRef<(message: string) => Promise<string>>(
    (message) => signMessageAsync({ message }),
  );
  useEffect(() => {
    signMessageRef.current = browserWallet
      ? browserWallet.signMessage
      : (message: string) => signMessageAsync({ message });
  }, [browserWallet, signMessageAsync]);

  const [syncing, setSyncing] = useState(false);
  const [denial, setDenial] = useState<"not-allowlisted" | "error" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const normalizedAddress = address?.toLowerCase();
  const inSync =
    firebaseUser && normalizedAddress
      ? firebaseUser.uid === normalizedAddress
      : false;

  const runSignIn = useCallback(async () => {
    if (!address || !normalizedAddress) return;

    // If another hook instance is already running the sign-in, join its
    // Promise instead of starting our own. Only the first caller shows the
    // wallet's signature prompt; everyone else awaits the result and lets
    // useFirebaseUser propagate the success.
    if (pendingSignIn) {
      setSyncing(true);
      try {
        await pendingSignIn;
      } catch {
        // The owning instance handled the error and set its own denial state.
      } finally {
        setSyncing(false);
      }
      return;
    }

    setSyncing(true);
    setDenial(null);
    setErrorMessage(undefined);

    const promise = signInWithWallet({
      address,
      signMessage: (message) => signMessageRef.current(message),
    });
    pendingSignIn = promise;

    try {
      await promise;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed.";
      if (msg.toLowerCase().includes("allowlist")) {
        setDenial("not-allowlisted");
      } else {
        setDenial("error");
        setErrorMessage(msg);
      }
    } finally {
      // Only clear the mutex if we're still the owner — a follow-up call could
      // have already swapped in a new promise after we resolved.
      if (pendingSignIn === promise) pendingSignIn = null;
      setSyncing(false);
    }
  }, [address, normalizedAddress]);

  // When the wallet has an address and there's no matching Firebase session,
  // run the sign-in flow exactly once. The user can `retry()` if it failed.
  useEffect(() => {
    if (loggingOut) return; // a logout is tearing the session down
    if (firebaseLoading) return;
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
    firebaseLoading,
    isConnected,
    normalizedAddress,
    inSync,
    syncing,
    denial,
    runSignIn,
  ]);

  // If wagmi disconnects, drop the Firebase session too. Mini App path only —
  // in the browser (Privy) path wagmi is always disconnected (no bridge),
  // which would spuriously sign the user out.
  useEffect(() => {
    if (!browserWallet && wagmiStatus === "disconnected" && firebaseUser) {
      void signOut(firebaseAuth());
    }
  }, [browserWallet, wagmiStatus, firebaseUser]);

  // Full logout: drop the wallet on whichever path owns it, then the Firebase
  // session. `loggingOut` suppresses the auto-sign-in effect so clearing
  // Firebase doesn't immediately re-trigger a signature prompt. Order matters:
  // log the wallet out FIRST (so `isConnected` flips false) before signing out
  // of Firebase.
  const logout = useCallback(async () => {
    loggingOut = true;
    try {
      // Browser/Privy path: clears the active user. No-op elsewhere.
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
        await signOut(firebaseAuth());
      } catch {
        // ignore
      }
      pendingSignIn = null;
    } finally {
      loggingOut = false;
    }
  }, [browserWallet, disconnect]);

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
    status,
    address: normalizedAddress,
    error: errorMessage,
    retry: runSignIn,
    signOutFirebase: () => signOut(firebaseAuth()),
    logout,
  };
}
