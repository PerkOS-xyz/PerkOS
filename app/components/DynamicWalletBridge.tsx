"use client";

import { type ReactNode, useMemo } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";

import {
  DynamicWalletContext,
  type DynamicWalletState,
} from "../lib/dynamicWallet";

/**
 * Publishes Dynamic's wallet state (address + native signer) into
 * DynamicWalletContext so useWalletSession can drive the browser sign-in from
 * Dynamic directly — no @dynamic-labs/wagmi-connector bridge (which drops the
 * connection on wagmi v3). This mirrors PerkOS-Stack's DynamicWalletBridge.
 *
 * Renders ONLY inside DynamicContextProvider (DynamicProviders.tsx) — that's
 * the only place useDynamicContext is safe and the only host where Dynamic
 * owns the wallet (a real browser tab). Mini App hosts never mount this, so
 * the context stays null there and useWalletSession falls back to wagmi.
 *
 * IMPORTANT: this bridge must LEAVE WAGMI ALONE (read Dynamic, sign with
 * Dynamic's native signer, never touch the wagmi connector). PerkOS-Stack —
 * the reference that runs the same wagmi v3 + Dynamic — does exactly this: its
 * disconnect is `handleLogOut()` only, no wagmi disconnect. Reaching into wagmi
 * (e.g. disconnecting it) drops the shared provider mid sign-in and the
 * signature runs on a dead connector → "Message signature denied" (see
 * DYNAMIC-WAGMI-LOGIN-FIX.md). The "two wallets" symptoms are handled
 * defensively in useWalletSession / the sign-in render, which read Dynamic.
 */
export function DynamicWalletBridge({ children }: { children: ReactNode }) {
  const { primaryWallet, handleLogOut } = useDynamicContext();

  const address = primaryWallet?.address;
  const isEvm = !!address && address.startsWith("0x") && address.length === 42;

  const value = useMemo<DynamicWalletState>(() => {
    const logout = async () => {
      await handleLogOut();
    };
    if (!primaryWallet || !isEvm) {
      return {
        address: undefined,
        isConnected: false,
        signMessage: async () => {
          throw new Error("No Dynamic wallet connected.");
        },
        logout,
      };
    }
    return {
      address,
      isConnected: true,
      signMessage: async (message: string) => {
        const signature = await primaryWallet.signMessage(message);
        if (!signature) {
          throw new Error("Dynamic wallet returned an empty signature.");
        }
        return signature;
      },
      logout,
    };
  }, [primaryWallet, address, isEvm, handleLogOut]);

  return (
    <DynamicWalletContext.Provider value={value}>
      {children}
    </DynamicWalletContext.Provider>
  );
}
