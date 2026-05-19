/**
 * Issue a one-time nonce that the wallet will sign as proof of ownership.
 *
 * GET /api/auth/nonce?address=0x…
 *   → { nonce: string, message: string, expiresAt: ISOString }
 *
 * The nonce is stored under /auth_nonces/{address}/{nonce} with a TTL so it
 * can be claimed exactly once by the matching /signin call.
 */

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { adminDb } from "../../../lib/firebaseAdmin";

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function buildMessage(address: string, nonce: string, issuedAt: string): string {
  return [
    "PerkOS wants to sign you in.",
    "",
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
    `Issued: ${issuedAt}`,
    "",
    "Signing this is free and does not authorize any transaction.",
  ].join("\n");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawAddress = url.searchParams.get("address");

  if (!rawAddress || !/^0x[a-fA-F0-9]{40}$/.test(rawAddress)) {
    return NextResponse.json(
      { error: "Provide a valid 0x… wallet address as the `address` query param." },
      { status: 400 }
    );
  }

  const address = rawAddress.toLowerCase();
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString();
  const message = buildMessage(address, nonce, issuedAt);

  await adminDb()
    .collection("auth_nonces")
    .doc(address)
    .collection("nonces")
    .doc(nonce)
    .set({
      address,
      nonce,
      message,
      issuedAt,
      expiresAt,
      consumed: false,
    });

  return NextResponse.json({ nonce, message, expiresAt });
}
