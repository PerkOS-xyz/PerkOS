"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useSignMessage } from "wagmi";
import { signOut } from "firebase/auth";

import { firebaseAuth } from "./firebase";
import { signInWithWallet } from "./walletAuth";
import { useFirebaseUser } from "./useFirebaseUser";

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
    setSyncing(true);
    setDenial(null);
    setErrorMessage(undefined);
    try {
      await signInWithWallet({
        address,
        signMessage: (message) => signMessageAsync({ message }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed.";
      if (msg.toLowerCase().includes("allowlist")) {
        setDenial("not-allowlisted");
      } else {
        setDenial("error");
        setErrorMessage(msg);
      }
    } finally {
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
