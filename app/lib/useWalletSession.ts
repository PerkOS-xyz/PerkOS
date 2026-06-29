"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useConnection, useSignMessage } from "wagmi";
import { signOut } from "firebase/auth";

import { firebaseAuth } from "./firebase";
import { signInWithWallet } from "./walletAuth";
import { useFirebaseUser } from "./useFirebaseUser";
import { DynamicWalletContext } from "./dynamicWallet";

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
};

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
 *  - Regular browser tab: Dynamic, via DynamicWalletContext. We do NOT bridge
 *    Dynamic into wagmi (`@dynamic-labs/wagmi-connector` drops the connection
 *    on wagmi v3 → ConnectorNotConnectedError on sign-in), so the browser path
 *    reads address + connection + signer straight from Dynamic.
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
  const { user: firebaseUser, loading: firebaseLoading } = useFirebaseUser();

  // Browser/Dynamic path: when the context is present, Dynamic owns the wallet
  // and we read everything from it. In Mini App hosts it's null → use wagmi.
  const dyn = useContext(DynamicWalletContext);
  const address = dyn ? dyn.address : wagmiAddress;
  const isConnected = dyn ? dyn.isConnected : wagmiIsConnected;

  // Active signer (Dynamic-native or wagmi) held in a ref so runSignIn's
  // callback doesn't churn its deps when the source flips.
  const signMessageRef = useRef<(message: string) => Promise<string>>(
    (message) => signMessageAsync({ message }),
  );
  useEffect(() => {
    signMessageRef.current = dyn
      ? dyn.signMessage
      : (message: string) => signMessageAsync({ message });
  }, [dyn, signMessageAsync]);

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

  // If wagmi disconnects, drop the Firebase session too. Mini App path only —
  // in the browser (Dynamic) path wagmi is always disconnected (no bridge),
  // which would spuriously sign the user out.
  useEffect(() => {
    if (!dyn && wagmiStatus === "disconnected" && firebaseUser) {
      void signOut(firebaseAuth());
    }
  }, [dyn, wagmiStatus, firebaseUser]);

  const status: WalletSessionStatus = (() => {
    if (firebaseLoading) return "loading";
    if (!dyn && (wagmiStatus === "connecting" || wagmiStatus === "reconnecting")) {
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
