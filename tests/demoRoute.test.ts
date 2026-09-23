import { describe, expect, it } from "vitest";

import { GET } from "@/app/demo/route";

describe("GET /demo", () => {
  it("temporarily redirects to the supplied PerkOS demo without requiring a session", () => {
    const response = GET();

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://www.youtube.com/watch?v=ZsdH46NOCdk",
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
