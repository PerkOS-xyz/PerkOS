"use client";

/**
 * Glue layer between wagmi and Firebase Auth.
 *
 * Delegates to `@perkos/shared-client/hooks#useWalletSession` and maps the
 * platform-canonical return shape back to App's legacy status names so
 * existing call sites (sign-in page, /continue, layout guards, the dev
 * indicator) don't need to change.
 *
 *  - Shared `"signing"`  → App `"syncing"`
 *  - Shared `error: Error | null` → App `error: string | undefined`
 *  - Shared hook doesn't surface the wallet address → we re-derive it from
 *    wagmi for the AccessGate component.
 *
 * The in-flight signature mutex now lives in the shared hook, so even
 * multiple App instances coexisting with Admin / Desktop in the same
 * process would deduplicate prompts.
 */

import { useMemo } from "react";
import { useConnection, useSignMessage } from "wagmi";
import { useWalletSession as sharedUseWalletSession } from "@perkos/shared-client/hooks";

import { firebaseAuth } from "./firebase";

export type WalletSessionStatus =
  | "loading"
  | "signed-out"
  | "signed-in"
  | "not-allowlisted"
  | "syncing"
  | "error";

type Result = {
  status: WalletSessionStatus;
  address?: string;
  error?: string;
  retry: () => void;
  signOutFirebase: () => Promise<void>;
};

export function useWalletSession(): Result {
  const { address, status: wagmiStatus } = useConnection();
  const { signMessageAsync } = useSignMessage();

  const auth = firebaseAuth();

  const shared = sharedUseWalletSession({
    apiBase: "",
    address: address as `0x${string}` | undefined,
    signMessage: (message) =>
      signMessageAsync({ message }) as Promise<`0x${string}`>,
    auth,
    requireAccess: true,
  });

  // Map shared statuses back to App's legacy enum and propagate wagmi's
  // pre-connection states the shared hook can't see (it only knows about
  // address presence, not whether wagmi is mid-reconnect).
  const status: WalletSessionStatus = useMemo(() => {
    if (wagmiStatus === "connecting" || wagmiStatus === "reconnecting") {
      return "loading";
    }
    switch (shared.status) {
      case "signing":
        return "syncing";
      case "wrong-role":
        // App has no role gate today; treat as a generic error so the UI
        // surfaces the underlying message.
        return "error";
      default:
        return shared.status;
    }
  }, [shared.status, wagmiStatus]);

  return {
    status,
    address: address?.toLowerCase(),
    error: shared.error?.message,
    retry: shared.retry,
    signOutFirebase: shared.signOutFirebase,
  };
}
