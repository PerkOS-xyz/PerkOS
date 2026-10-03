/**
 * Solana token balance for the caller's own wallet, read SERVER-SIDE.
 *
 * Must be server-side: the public Solana RPC answers 403 "Access forbidden"
 * to browser requests (any request carrying an Origin header), so the
 * header pill cannot query it directly.
 *
 * GET /api/solana/balances?mint=<mint>   (Authorization: Bearer <firebase id token>)
 *   → { amount: "<raw base units>" } | { error }
 *
 * Only the caller's own Solana wallet and only the mints the pill shows.
 * Results are cached briefly because every request leaves from the same
 * server IP, which shares the public RPC's per-IP rate limit.
 */
import { NextResponse } from "next/server";
import { isSolanaWalletAddress } from "@perkos/shared-types";

import { adminAuth } from "../../../lib/firebaseAdmin";
import {
  SOLANA_PERKOS,
  SOLANA_RPC_URL,
  SOLANA_STABLECOIN,
  fetchSolanaTokenBalance,
} from "../../../lib/solanaBalances";

const ALLOWED_MINTS = new Set([SOLANA_STABLECOIN.mint, SOLANA_PERKOS.mint]);
const CACHE_TTL_MS = 30_000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, { at: number; amount: string }>();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  if (!idToken) return json({ error: "Missing auth token." }, 401);

  let wallet: string;
  try {
    wallet = (await adminAuth().verifyIdToken(idToken)).uid;
  } catch {
    return json({ error: "Invalid auth token." }, 401);
  }
  if (!isSolanaWalletAddress(wallet)) {
    return json({ error: "Not a Solana account." }, 400);
  }

  const mint = new URL(request.url).searchParams.get("mint") ?? "";
  if (!ALLOWED_MINTS.has(mint)) return json({ error: "Unknown mint." }, 400);

  const key = `${wallet}:${mint}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return json({ amount: hit.amount });
  }

  try {
    const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || SOLANA_RPC_URL;
    const amount = (await fetchSolanaTokenBalance(wallet, mint, undefined, rpcUrl)).toString();
    if (cache.size >= CACHE_MAX_ENTRIES) cache.clear();
    cache.set(key, { at: Date.now(), amount });
    return json({ amount });
  } catch {
    return json({ error: "Balance unavailable." }, 502);
  }
}
