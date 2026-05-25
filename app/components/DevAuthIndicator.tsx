"use client";

/**
 * Alpha-only floating badge that surfaces the auth signals the rest of
 * the app uses to decide where to route the user. Visible on every
 * page so we can read it directly off the screen while debugging Base
 * App / Farcaster flows.
 *
 * Shows:
 *   - miniapp:    sdk.isInMiniApp() — null while resolving, then yes/no.
 *   - wallet :    wagmi isConnected.
 *   - session:    useWalletSession status.
 *   - cbWallet:   yes/no — is Coinbase Smart Wallet present via EIP-6963
 *                 (this is the signal that distinguishes Base App's
 *                 in-app browser from plain Safari).
 *   - conn   :    short list of wagmi connector ids the page currently
 *                 sees. Includes anything wagmi discovered via EIP-6963.
 *   - ua     :    last 36 chars of navigator.userAgent.
 *
 * Remove or gate behind an env flag once the alpha auth flow stabilises.
 */

import { useEffect, useState } from "react";
import { useAccount, useConnect, useConnectors, type Connector } from "wagmi";

import { useIsInMiniApp } from "../lib/useIsInMiniApp";
import { useWalletSession } from "../lib/useWalletSession";

const COINBASE_WALLET_RDNS = "com.coinbase.wallet";

function rdnsOf(connector: Connector): string | undefined {
  const c = connector as Connector & {
    rdns?: string;
    info?: { rdns?: string };
  };
  return c.rdns ?? c.info?.rdns;
}

function shortId(connector: Connector): string {
  // EIP-6963 connector ids are full rdns strings ("com.coinbase.wallet")
  // — trim them so the badge stays readable on mobile.
  const id = connector.id;
  return id.length > 20 ? id.slice(0, 18) + "…" : id;
}

export function DevAuthIndicator() {
  const isInMiniApp = useIsInMiniApp();
  const { isConnected } = useAccount();
  const session = useWalletSession();
  const connectors = useConnectors();
  const { isPending: isConnectPending, error: connectError } = useConnect();
  const [ua, setUa] = useState<string>("");

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const full = navigator.userAgent;
      setUa(full.length > 36 ? `…${full.slice(-36)}` : full);
    }
  }, []);

  const hasCoinbaseWallet = connectors.some(
    (c) => c.id === COINBASE_WALLET_RDNS || rdnsOf(c) === COINBASE_WALLET_RDNS,
  );

  const miniappLabel =
    isInMiniApp === null ? "?" : isInMiniApp ? "yes" : "no";
  const miniappColor =
    isInMiniApp === null
      ? "text-amber-300"
      : isInMiniApp
        ? "text-emerald-300"
        : "text-rose-300";

  return (
    <div
      className="pointer-events-none fixed right-2 top-2 z-[100] flex max-w-[220px] flex-col items-end gap-0.5 rounded-md border border-primary/30 bg-black/70 px-2 py-1.5 font-mono text-[10px] leading-tight text-white shadow-lg backdrop-blur-sm"
      aria-hidden
    >
      <span>
        miniapp: <span className={miniappColor}>{miniappLabel}</span>
      </span>
      <span>
        wallet:{" "}
        <span className={isConnected ? "text-emerald-300" : "text-rose-300"}>
          {isConnected ? "connected" : "off"}
        </span>
      </span>
      <span>
        session: <span className="text-primary">{session.status}</span>
      </span>
      <span>
        cbWallet:{" "}
        <span className={hasCoinbaseWallet ? "text-emerald-300" : "text-rose-300"}>
          {hasCoinbaseWallet ? "yes" : "no"}
        </span>
      </span>
      <span className="text-white/70">
        conn: {connectors.map(shortId).join(", ") || "—"}
      </span>
      {isConnectPending ? (
        <span className="text-amber-300">connecting…</span>
      ) : null}
      {connectError ? (
        <span
          className="text-rose-300"
          title={(connectError as Error).message}
        >
          err:{" "}
          {(connectError as Error).name ||
            (connectError as Error).message.slice(0, 30)}
        </span>
      ) : null}
      {ua ? <span className="truncate text-white/60">{ua}</span> : null}
    </div>
  );
}
