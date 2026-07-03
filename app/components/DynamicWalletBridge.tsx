"use client";

import { type ReactNode, useEffect, useMemo } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { useAccount, useDisconnect, type Connector } from "wagmi";

import {
  DynamicWalletContext,
  type DynamicWalletState,
} from "../lib/dynamicWallet";

const COINBASE_WALLET_RDNS = "com.coinbase.wallet";

/** EIP-6963 rdns can sit on the connector or on a nested `info`. */
function rdnsOf(connector: Connector | undefined): string | undefined {
  const c = connector as
    | (Connector & { rdns?: string; info?: { rdns?: string } })
    | undefined;
  return c?.rdns ?? c?.info?.rdns;
}

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
 */
export function DynamicWalletBridge({ children }: { children: ReactNode }) {
  const { primaryWallet, handleLogOut } = useDynamicContext();

  // Keep the browser/Dynamic path single-wallet: Dynamic owns the wallet here,
  // so a stray wagmi connection (a stale persisted login, wallet now locked)
  // is the "two wallets" situation behind the auth bugs (the /sign-in ↔
  // /continue loop, the signature-time flicker, and the stuck "Continue as"
  // that hid the connect button). Drop it.
  //
  // Scope — disconnect can ONLY happen in a real browser tab:
  //  - Farcaster / Base App MINI APP hosts never mount this component
  //    (useDynamicContext is browser-only), so the effect can't run there and
  //    their host wallets are never touched.
  //  - The Base App IN-APP BROWSER is not a Mini App host (isInMiniApp false),
  //    so this DOES mount there — but the host injects the user's Coinbase
  //    Smart Wallet (EIP-6963 rdns com.coinbase.wallet) as the real wallet, so
  //    we must NOT disconnect it. We skip that connector.
  // In all three, the user's wallet is the host identity and by definition
  // can't be disconnected; everything else in a plain browser is stale noise.
  const { isConnected: wagmiConnected, connector } = useAccount();
  const { disconnect: disconnectWagmi } = useDisconnect();
  useEffect(() => {
    if (!wagmiConnected || !connector) return;
    const isCoinbaseHost =
      connector.id === COINBASE_WALLET_RDNS ||
      rdnsOf(connector) === COINBASE_WALLET_RDNS;
    if (isCoinbaseHost) return; // Base App in-app browser host wallet — leave it
    disconnectWagmi();
  }, [wagmiConnected, connector, disconnectWagmi]);

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
