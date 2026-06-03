import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../../lib/firebaseAdmin";

type Payload = {
  walletAddress: string;
  email: string;
  username?: string;
  company?: string;
  website?: string;
};

export async function POST(request: Request) {
  let body: Partial<Payload>;
  try {
    body = (await request.json()) as Partial<Payload>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const walletAddress = body.walletAddress?.trim().toLowerCase();
  const email = body.email?.trim();

  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json(
      { error: "Valid walletAddress is required" },
      { status: 400 }
    );
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 }
    );
  }

  await adminDb()
    .collection("access_requests")
    .add({
      walletAddress,
      email,
      username: body.username?.trim().slice(0, 120) || null,
      company: body.company?.trim().slice(0, 200) || null,
      website: body.website?.trim().slice(0, 300) || null,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

  // TODO(email): notify access@perkos.xyz via Resend.

  return NextResponse.json({ ok: true });
}
