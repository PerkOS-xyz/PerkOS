import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.redirect("https://t.me/perk_os", 307);
}
