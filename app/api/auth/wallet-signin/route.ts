/**
 * Exchange a wallet signature for a Firebase custom token.
 *
 * POST /api/auth/wallet-signin
 *   body: { address: string, nonce: string, signature: 0x… }
 *   →    { token: string }
 *
 * Steps:
 *   1. Look up the nonce we issued for this address; ensure it isn't consumed
 *      or expired.
 *   2. Verify the signature against the canonical message stored alongside
 *      the nonce. viem's verifyMessage handles both ECDSA EOAs and ERC-1271
 *      smart wallets (Base smart wallet).
 *   3. Check `/allowlist/{address}` — if absent, refuse to mint a token.
 *   4. Mint a Firebase custom token with uid = lowercased address.
 *   5. Mark the nonce consumed.
 */

import { NextResponse } from "next/server";
import { createPublicClient, http, type Address, type Hex } from "viem";
import { base, baseSepolia } from "viem/chains";

import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";

// We try Base mainnet first, then Base Sepolia, in case the smart wallet only
// exists on testnet during alpha.
const publicClients = [
  createPublicClient({ chain: base, transport: http() }),
  createPublicClient({ chain: baseSepolia, transport: http() }),
];

async function verifySignature(input: {
  address: Address;
  message: string;
  signature: Hex;
}): Promise<boolean> {
  for (const client of publicClients) {
    try {
      const ok = await client.verifyMessage({
        address: input.address,
        message: input.message,
        signature: input.signature,
      });
      if (ok) return true;
    } catch {
      // Try the next chain
    }
  }
  return false;
}

export async function POST(request: Request) {
  let body: { address?: string; nonce?: string; signature?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawAddress = body.address;
  const nonce = body.nonce;
  const signature = body.signature;

  if (!rawAddress || !/^0x[a-fA-F0-9]{40}$/.test(rawAddress)) {
    return NextResponse.json(
      { error: "Provide a valid 0x… wallet address." },
      { status: 400 }
    );
  }
  if (!nonce || typeof nonce !== "string") {
    return NextResponse.json({ error: "Missing nonce." }, { status: 400 });
  }
  if (!signature || !/^0x[a-fA-F0-9]+$/.test(signature)) {
    return NextResponse.json({ error: "Missing or malformed signature." }, { status: 400 });
  }

  const address = rawAddress.toLowerCase();
  const db = adminDb();

  // 1. Nonce lookup ----------------------------------------------------
  const nonceRef = db
    .collection("auth_nonces")
    .doc(address)
    .collection("nonces")
    .doc(nonce);
  const nonceSnap = await nonceRef.get();
  if (!nonceSnap.exists) {
    return NextResponse.json({ error: "Unknown nonce." }, { status: 401 });
  }
  const nonceData = nonceSnap.data() as {
    message: string;
    expiresAt: string;
    consumed: boolean;
  };
  if (nonceData.consumed) {
    return NextResponse.json({ error: "Nonce already used." }, { status: 401 });
  }
  if (new Date(nonceData.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: "Nonce expired." }, { status: 401 });
  }

  // 2. Signature verification ------------------------------------------
  const valid = await verifySignature({
    address: rawAddress as Address,
    message: nonceData.message,
    signature: signature as Hex,
  });
  if (!valid) {
    return NextResponse.json({ error: "Signature does not match address." }, { status: 401 });
  }

  // 3. Allowlist check -------------------------------------------------
  const allowSnap = await db.collection("allowlist").doc(address).get();
  if (!allowSnap.exists) {
    return NextResponse.json(
      { error: "Wallet not on the alpha allowlist." },
      { status: 403 }
    );
  }

  // 4. Mint custom token -----------------------------------------------
  const token = await adminAuth().createCustomToken(address, {
    walletAddress: address,
  });

  // 5. Consume nonce ---------------------------------------------------
  await nonceRef.set(
    { consumed: true, consumedAt: new Date().toISOString() },
    { merge: true }
  );

  return NextResponse.json({ token });
}
