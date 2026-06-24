"use client";

/**
 * Top up agent credits with on-chain USDC (Base/Celo) via x402 → PerkOS Stack.
 *
 * Ported from PerkOS-Knowledge's DepositPanel: Base uses `x402-fetch`
 * (`wrapFetchWithPayment` handles the 402 → EIP-3009 signature → retry); Celo
 * signs the authorization by hand (x402-fetch 1.2's network enum lacks "celo").
 * Unlike Knowledge (same-origin /api/deposit), we hit the platform API
 * (api.perkos.xyz/billing/deposit) and must inject the Firebase id-token, so the
 * x402 init carries an Authorization header that survives the signed retry.
 */

import { useState } from "react";
import { getAddress, type WalletClient } from "viem";
import { useWalletClient, useSwitchChain } from "wagmi";
import { wrapFetchWithPayment } from "x402-fetch";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { firebaseAuth } from "../lib/firebase";

const CHAIN_ID: Record<"base" | "celo", number> = { base: 8453, celo: 42220 };

const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

type PaymentRequirements = {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  payTo: string;
  asset: string;
  maxTimeoutSeconds: number;
  extra?: { name?: string; version?: string };
};

function randomNonce(): `0x${string}` {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return `0x${[...b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Manually sign an x402 EIP-3009 `X-PAYMENT` header (the Celo path). Matches
 *  x402-fetch's signing EXACTLY: signTypedData with NO `account` field, so a
 *  smart wallet signs the authorization gaslessly instead of trying to execute it. */
async function signX402Payment(
  walletClient: WalletClient,
  req: PaymentRequirements,
  payer: `0x${string}`,
  chainId: number,
): Promise<string> {
  const validAfter = BigInt(0);
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + (req.maxTimeoutSeconds || 120));
  const nonce = randomNonce();
  const value = BigInt(req.maxAmountRequired);
  const authorization = {
    from: getAddress(payer),
    to: getAddress(req.payTo),
    value,
    validAfter,
    validBefore,
    nonce,
  };
  const signature = await (walletClient.signTypedData as (a: unknown) => Promise<`0x${string}`>)({
    types: TRANSFER_WITH_AUTHORIZATION_TYPES,
    domain: {
      name: req.extra?.name || "USDC",
      version: req.extra?.version || "2",
      chainId,
      verifyingContract: getAddress(req.asset),
    },
    primaryType: "TransferWithAuthorization",
    message: authorization,
  });
  const paymentPayload = {
    x402Version: 1,
    scheme: "exact",
    network: req.network,
    payload: {
      signature,
      authorization: {
        from: authorization.from,
        to: authorization.to,
        value: value.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  };
  return btoa(JSON.stringify(paymentPayload));
}

const API_BASE = process.env.NEXT_PUBLIC_PERKOS_API_URL ?? "https://api.perkos.xyz";

async function idToken(): Promise<string> {
  const user = firebaseAuth().currentUser;
  if (!user) throw new Error("Connect your wallet first.");
  return user.getIdToken();
}

export function DepositDialog({
  address,
  onDeposited,
}: {
  address: string;
  onDeposited?: () => void;
}) {
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const [network, setNetwork] = useState<"base" | "celo">("base");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);

  async function deposit() {
    const amt = Number(amount);
    setMsg("");
    setOk(false);
    if (!(amt > 0)) {
      setMsg("Enter an amount.");
      return;
    }
    if (!walletClient || !address) {
      setMsg("Connect a wallet first.");
      return;
    }
    setBusy(true);
    try {
      const token = await idToken();
      const url = `${API_BASE}/billing/deposit`;
      const auth: Record<string, string> = {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      };
      const body = JSON.stringify({ network, amount: amt });

      await switchChainAsync({ chainId: CHAIN_ID[network] as 8453 | 42220 }).catch(() => {});

      let data: { ok?: boolean; creditsUsd?: number; transaction?: string; error?: string; message?: string };
      if (network === "base") {
        // Base: x402-fetch handles 402 → EIP-3009 signature → retry.
        const maxBase = BigInt(Math.round(amt * 1e6));
        const fetchWithPay = wrapFetchWithPayment(
          fetch,
          walletClient as unknown as Parameters<typeof wrapFetchWithPayment>[1],
          maxBase,
        );
        const res = await fetchWithPay(url, { method: "POST", headers: auth, body });
        data = await res.json().catch(() => ({}));
      } else {
        // Celo: do the x402 dance by hand — get the 402, sign, retry with X-PAYMENT.
        const r1 = await fetch(url, { method: "POST", headers: auth, body });
        if (r1.status !== 402) {
          const d = await r1.json().catch(() => ({}));
          setMsg(`Deposit failed: ${d.error || d.message || r1.status}`);
          return;
        }
        const challenge = (await r1.json()) as { accepts?: PaymentRequirements[] };
        const req = (challenge.accepts || []).find((a) => a.network === "celo");
        if (!req) {
          setMsg("Celo not offered by the server.");
          return;
        }
        const xPayment = await signX402Payment(walletClient, req, address as `0x${string}`, CHAIN_ID.celo);
        const r2 = await fetch(url, {
          method: "POST",
          headers: { ...auth, "X-PAYMENT": xPayment },
          body,
        });
        data = await r2.json().catch(() => ({}));
      }

      if (data.ok) {
        setOk(true);
        setMsg(
          `Added ${amt} USDC on ${network}. Balance: $${data.creditsUsd}${
            data.transaction ? ` · tx ${String(data.transaction).slice(0, 10)}…` : ""
          }`,
        );
        setAmount("");
        onDeposited?.();
      } else {
        setMsg(`Deposit failed: ${data.error || data.message || "unknown"}`);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message.slice(0, 140) : "Deposit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/40 p-3">
      <div className="flex items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor="dep-net" className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Network
          </Label>
          <select
            id="dep-net"
            value={network}
            onChange={(e) => setNetwork(e.target.value as "base" | "celo")}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="base">Base</option>
            <option value="celo">Celo</option>
          </select>
        </div>
        <div className="grid flex-1 gap-1">
          <Label htmlFor="dep-amt" className="text-[10px] uppercase tracking-wide text-muted-foreground">
            USDC
          </Label>
          <Input
            id="dep-amt"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="10.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9"
          />
        </div>
        <Button size="sm" onClick={deposit} disabled={busy} className="h-9">
          {busy ? "Confirm…" : "Add"}
        </Button>
      </div>
      {msg ? (
        <p className={cn("text-[11px] leading-snug", ok ? "text-emerald-400" : "text-amber-400")}>{msg}</p>
      ) : null}
    </div>
  );
}
