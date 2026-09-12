import { describe, expect, it } from "vitest";

import { GET } from "@/app/telegram/route";

describe("GET /telegram", () => {
  it("temporarily redirects to the official PerkOS Telegram channel", () => {
    const response = GET();

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://t.me/perk_os");
  });
});
