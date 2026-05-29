"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useSignMessage } from "wagmi";
import { signOut } from "firebase/auth";

import { firebaseAuth } from "./firebase";
import { signInWithWallet } from "./walletAuth";
import { useFirebaseUser } from "./useFirebaseUser";

/**
 * Module-level mutex shared by every useWalletSession() consumer in
 * the app. The hook is called from at least four places at once
 * during a typical flow (landing's LandingAutoRoute, /continue, the
 * (app) layout guard, /sign-in), and each call is an independent React
 * instance with its own state. Without a shared promise, each instance
 * fires its own signInWithWallet → MetaMask receives multiple
 * personal_sign requests with different nonces queued up.
 *
 * `pendingSignIn` holds the in-flight Promise so all instances await
 * the same one and their reactive state (firebaseUser, syncing) picks
 * up the result via the existing useFirebaseUser subscription.
 */
let pendingSignIn: Promise<unknown> | null = null;

export type WalletSessionStatus =
  /** waiting for wagmi or Firebase to settle */
  | "loading"
  /** wagmi disconnected, no Firebase session — user must sign in */
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
};

/**
 * Glue layer between wagmi and Firebase Auth.
 *
 *  - When wagmi has an address but Firebase has no matching session, we
 *    automatically run `signInWithWallet` to upgrade the wagmi session
 *    into a Firebase custom-token session.
 *  - We expose a coarse `status` so guarded routes can decide what to
 *    render (loading skeleton vs AccessGate vs the app itself).
 *
 * Components that just need to know "is this user authorized?" should
 * check `status === "signed-in"`.
 */
export function useWalletSession(): Result {
  const { address, isConnected, status: wagmiStatus } = useConnection();
  const { signMessageAsync } = useSignMessage();
  const { user: firebaseUser, loading: firebaseLoading } = useFirebaseUser();

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

    // If another hook instance is already running the sign-in, join
    // its Promise instead of starting our own. Only the first caller
    // shows the wallet's signature prompt; everyone else just awaits
    // the result and lets useFirebaseUser propagate the success.
    if (pendingSignIn) {
      setSyncing(true);
      try {
        await pendingSignIn;
      } catch {
        // The owning instance handled the error and set its own denial
        // state; ours is in the same render tree so it will rerender
        // alongside it. Nothing extra to do here.
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
      signMessage: (message) => signMessageAsync({ message }),
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
      // Only clear the mutex if we're still the owner — a follow-up
      // call could have already swapped in a new promise after we
      // resolved (e.g. wallet disconnect + reconnect).
      if (pendingSignIn === promise) pendingSignIn = null;
      setSyncing(false);
    }
  }, [address, normalizedAddress, signMessageAsync]);

  // If wagmi has an address and we have no matching Firebase session, run
  // the sign-in flow exactly once. The user can `retry()` if it failed.
  useEffect(() => {
    if (firebaseLoading) return;
    if (!isConnected || !normalizedAddress) return;
    if (inSync) return;
    if (syncing) return;
    if (denial) return; // wait for explicit retry
    void runSignIn();
  }, [
    firebaseLoading,
    isConnected,
    normalizedAddress,
    inSync,
    syncing,
    denial,
    runSignIn,
  ]);

  // If wagmi disconnects, drop the Firebase session too so the next wallet
  // doesn't inherit it.
  useEffect(() => {
    if (wagmiStatus === "disconnected" && firebaseUser) {
      void signOut(firebaseAuth());
    }
  }, [wagmiStatus, firebaseUser]);

  const status: WalletSessionStatus = (() => {
    if (firebaseLoading) return "loading";
    if (wagmiStatus === "connecting" || wagmiStatus === "reconnecting") {
      return "loading";
    }
    if (!isConnected) return "signed-out";
    if (denial === "not-allowlisted") return "not-allowlisted";
    if (denial === "error") return "error";
    if (syncing) return "syncing";
    if (inSync) return "signed-in";
    return "syncing";
  })();

  return {
    status,
    address: normalizedAddress,
    error: errorMessage,
    retry: runSignIn,
    signOutFirebase: () => signOut(firebaseAuth()),
  };
}
