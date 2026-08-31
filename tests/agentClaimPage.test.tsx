import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/(app)/agents/claim/page.tsx"),
  "utf8",
);

/**
 * Adopting an agent means agreeing to pay for what it does, so the page has to
 * say that before the button, and the token it carries must not leak on the
 * way here.
 */
describe("the claim page", () => {
  it("reads the token from the fragment, which browsers never send", () => {
    // Anywhere else in the URL and the token lands in request lines, access
    // logs, proxy logs and Referer headers before anyone approves anything.
    expect(source).toContain("window.location.hash");
    expect(source).not.toContain("searchParams.get(\"token\")");
  });

  it("says who pays before offering the button", () => {
    expect(source).toContain("billed to you");
  });

  it("requires a signed-in wallet to approve", () => {
    // The whole point of the ceremony is that a human vouches; an anonymous
    // visitor approving would make the claim meaningless.
    expect(source).toContain("!isConnected");
    expect(source).toContain("disabled=");
  });

  it("shows the server's reason when a claim is refused", () => {
    // Expired and already-claimed need different responses from the person:
    // one is worth asking for a new link, the other is not.
    expect(source).toContain("body.error?.message");
  });

  it("does not act on the label it decodes", () => {
    // The label is decoded client-side for display only. The server re-reads
    // the token and verifies its signature.
    expect(source).toContain("shown, never acted on");
  });
});
