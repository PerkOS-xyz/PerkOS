import { describe, expect, it } from "vitest";

import { GET } from "../app/.well-known/oauth-protected-resource/route";
import { AUTH_MARKDOWN } from "../app/lib/authMarkdown";

/**
 * Resource metadata tells a caller holding a PerkOS URL where to get a token,
 * without it already knowing the issuer's hostname. If it names the wrong
 * issuer, the caller fetches a token this resource will not accept — and has
 * no way to see why.
 */
describe("OAuth protected resource metadata", () => {
  it("names the issuer that actually mints for this resource", async () => {
    const meta = await GET().json();
    expect(meta.resource).toMatch(/^https:\/\/perkos\.xyz/);
    expect(meta.authorization_servers).toEqual(["https://oauth.perkos.xyz"]);
    expect(meta.authorization_servers[0]).not.toBe(meta.resource);
  });

  it("declares how a token is presented", async () => {
    const meta = await GET().json();
    expect(meta.bearer_methods_supported).toContain("header");
    expect(meta.scopes_supported.length).toBeGreaterThan(0);
  });
});

describe("auth.md keeps up with reality", () => {
  it("no longer claims there is no OAuth server", () => {
    // It said so truthfully until one existed. Leaving that line would send
    // an OAuth-capable caller away from a server that now works.
    expect(AUTH_MARKDOWN).not.toContain("no OAuth authorization server");
    expect(AUTH_MARKDOWN).toContain("oauth.perkos.xyz");
  });

  it("still says it is not an OpenID provider", () => {
    // The server issues no id_token. Being discoverable must not turn into
    // implying a capability it does not have.
    expect(AUTH_MARKDOWN).toContain("id_token");
  });
});

/**
 * auth.md is followed by machines, so a link that a human would squint past and
 * still click is simply broken here. This caught a real one: the issuer URLs
 * were written as inline code inside the link target, which puts a literal
 * backtick in the href.
 */
describe("auth.md links are machine-followable", () => {
  const targets = [...AUTH_MARKDOWN.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);

  it("links to somewhere", () => {
    expect(targets.length).toBeGreaterThan(0);
  });

  it("no link target carries stray markup", () => {
    // Checked before anything else on purpose. An earlier version of this test
    // skipped non-http targets first, which skipped the exact malformed link it
    // was written to catch: a backticked URL does not start with "http".
    for (const target of targets) {
      expect(target).not.toMatch(/[`\s]/);
    }
  });

  it("every absolute link target parses as a URL", () => {
    for (const target of targets) {
      if (!target.startsWith("http")) continue;
      expect(() => new URL(target)).not.toThrow();
    }
  });
});
