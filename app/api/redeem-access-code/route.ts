import { NextResponse } from "next/server";

import { redeemAccessCode } from "../../lib/accessCodes";
import { rateLimit, clientIp } from "../../lib/rateLimit";

type Payload = {
  walletAddress: string;
  code: string;
  email: string;
  username: string;
  company?: string;
  website?: string;
};

export async function POST(request: Request) {
  // Unauthenticated (the wallet isn't allowlisted yet) + grants access →
  // throttle hard per IP so codes can't be brute-forced.
  const limited = rateLimit(`redeem-access-code:${clientIp(request)}`, 8, 60_000);
  if (limited) return limited;

  let body: Partial<Payload>;
  try {
    body = (await request.json()) as Partial<Payload>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const walletAddress = body.walletAddress?.trim().toLowerCase();
  const code = body.code?.trim();
  const email = body.email?.trim();
  const username = body.username?.trim();

  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json(
      { error: "Valid walletAddress is required" },
      { status: 400 },
    );
  }
  if (!code) {
    return NextResponse.json({ error: "Access code is required" }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const result = await redeemAccessCode({
    walletAddress,
    code,
    email,
    username,
    company: body.company?.trim().slice(0, 200) || null,
    website: body.website?.trim().slice(0, 300) || null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ granted: true });
}
