import { NextRequest, NextResponse } from "next/server";

import { listConversations } from "@/app/lib/local/store";
import type { LocalVertical } from "@/app/lib/local/types";

export const runtime = "nodejs";

/** Pilot inbox dump — in-memory only. Lock down before production. */
export async function GET(req: NextRequest) {
  const vertical = req.nextUrl.searchParams.get("vertical") as LocalVertical | null;
  if (vertical && vertical !== "barbershop" && vertical !== "restaurant") {
    return NextResponse.json({ error: "invalid_vertical" }, { status: 400 });
  }
  const conversations = listConversations(vertical ?? undefined).map((c) => ({
    id: c.id,
    vertical: c.vertical,
    status: c.status,
    stage: c.stage,
    contact: c.contact,
    updatedAt: c.updatedAt,
    lastMessage: c.messages[c.messages.length - 1] ?? null,
    messageCount: c.messages.length,
  }));
  return NextResponse.json({ conversations });
}
