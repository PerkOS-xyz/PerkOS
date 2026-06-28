"use client";

import { authedFetch } from "./apiClient";

/**
 * Client for the user's PerkOS-operated server wallet (Dynamic WaaS), exposed
 * by PerkOS-API at /wallet/*. Phase 2: read-only — ensure (create-or-return)
 * + multi-chain balances. Transfers (signing) land later.
 */

export type ServerWallet = {
  walletId: string;
  address: string;
  walletType: string;
  createdAt: string | null;
};

export type WalletBalance = {
  symbol: string;
  /** null for the native coin. */
  address: string | null;
  decimals: number;
  raw: string;
  formatted: string;
};

export type ChainBalances = {
  chain: string;
  chainId: number;
  balances: WalletBalance[];
};

export type WalletBalances = {
  address: string | null;
  chains: ChainBalances[];
};

/**
 * Create-or-return the caller's server wallet. Returns `null` when server
 * wallets aren't enabled on the backend (503) — the UI shows a "coming soon"
 * state rather than erroring.
 */
export async function ensureServerWallet(): Promise<ServerWallet | null> {
  const res = await authedFetch("/api/wallet/ensure", { method: "POST" });
  if (res.status === 503) return null;
  if (!res.ok) throw new Error(`Couldn't load your wallet (${res.status})`);
  const data = (await res.json()) as { wallet?: ServerWallet | null };
  return data.wallet ?? null;
}

/** Read the server wallet's balances across chains. */
export async function fetchWalletBalances(): Promise<WalletBalances> {
  const res = await authedFetch("/api/wallet/balances");
  if (!res.ok) throw new Error(`Couldn't load balances (${res.status})`);
  return (await res.json()) as WalletBalances;
}

const CHAIN_LABELS: Record<string, string> = { base: "Base", celo: "Celo" };
export function chainLabel(chain: string): string {
  return CHAIN_LABELS[chain] ?? chain;
}

export type TransferInput = {
  chain: "base" | "celo";
  /** "USDC" | "PERKOS" | "native" */
  token: string;
  to: string;
  /** human amount, e.g. "1.5" */
  amount: string;
};

export type TransferResult = {
  hash: string;
  chain: string;
  chainId: number;
  token: string;
  to: string;
  amount: string;
};

/** Send tokens OUT of the server wallet (MPC-signed + broadcast server-side). */
export async function transferOut(input: TransferInput): Promise<TransferResult> {
  const res = await authedFetch("/api/wallet/transfer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `Transfer failed (${res.status})`);
  }
  return (await res.json()) as TransferResult;
}

/** Block explorer tx URL for a chain. */
export function explorerTxUrl(chain: string, hash: string): string {
  const base = chain === "celo" ? "https://celoscan.io/tx/" : "https://basescan.org/tx/";
  return base + hash;
}
