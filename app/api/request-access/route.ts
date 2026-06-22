import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../../lib/firebaseAdmin";
import { rateLimit, clientIp } from "../../lib/rateLimit";
import {
  ACCESS_EMAIL_TO,
  escapeHtml,
  sendEmail,
} from "../../lib/email";

type Payload = {
  walletAddress: string;
  email: string;
  username?: string;
  company?: string;
  website?: string;
};

export async function POST(request: Request) {
  // Unauthenticated; writes Firestore + sends an email per call → throttle per IP.
  const limited = rateLimit(`request-access:${clientIp(request)}`, 5, 60_000);
  if (limited) return limited;

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

  const username = body.username?.trim().slice(0, 120) || null;
  const company = body.company?.trim().slice(0, 200) || null;
  const website = body.website?.trim().slice(0, 300) || null;

  await adminDb()
    .collection("access_requests")
    .add({
      walletAddress,
      email,
      username,
      company,
      website,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });

  // Notify the team. Non-fatal: the request is already persisted.
  await sendEmail({
    to: ACCESS_EMAIL_TO,
    subject: `[Access request] ${username ?? walletAddress}`,
    replyTo: email,
    html: `
      <p><strong>New private-beta access request</strong></p>
      <ul>
        <li><strong>Wallet:</strong> ${escapeHtml(walletAddress)}</li>
        <li><strong>Email:</strong> ${escapeHtml(email)}</li>
        <li><strong>Username:</strong> ${username ? escapeHtml(username) : "—"}</li>
        <li><strong>Company:</strong> ${company ? escapeHtml(company) : "—"}</li>
        <li><strong>Website:</strong> ${website ? escapeHtml(website) : "—"}</li>
      </ul>
    `,
  });

  return NextResponse.json({ ok: true });
}
