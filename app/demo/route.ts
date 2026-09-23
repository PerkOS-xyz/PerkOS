import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.redirect("https://www.youtube.com/watch?v=ZsdH46NOCdk", 307);
}
