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

/**
 * auth.md is the only document a self-registering agent reads before it acts.
 * If a step in it does not work, the agent has no way to tell that from its
 * own mistake — which is exactly what happened: the deposit step it was told
 * to take required a token the platform refused to issue to that same wallet.
 */
describe("the registration flow auth.md documents is walkable", () => {
  it("covers every step from nonce to bearer token", () => {
    for (const step of [
      "/api/auth/nonce",
      "/agent/identity",
      "/api/platform/billing/deposit/x402",
      "X-PAYMENT",
      "Bearer",
    ]) {
      expect(AUTH_MARKDOWN, `flow is missing ${step}`).toContain(step);
    }
  });

  it("does not send an unfunded caller to a route that needs a token", () => {
    // The old deposit route required a bearer token that /auth/wallet-signin
    // refuses to issue to an unfunded wallet. Documenting it here would send
    // an agent into that deadlock.
    const deposits = [...AUTH_MARKDOWN.matchAll(/billing\/deposit\S*/g)].map((m) => m[0]);
    expect(deposits.length).toBeGreaterThan(0);
    for (const route of deposits) {
      expect(route, "must be the session-free deposit route").toContain("deposit/x402");
    }
  });

  it("explains that 402 is recoverable and 403 is not", () => {
    // An agent that treats them the same either gives up when it could pay,
    // or retries forever when it cannot.
    expect(AUTH_MARKDOWN).toMatch(/402/);
    expect(AUTH_MARKDOWN).toMatch(/403/);
    expect(AUTH_MARKDOWN).toContain("depositing will");
  });

  it("does not promise that paying grants access to other workspaces", () => {
    // Collapsing balance with membership would let anyone with a few dollars
    // read every board on the platform.
    expect(AUTH_MARKDOWN).toContain("compute, not company");
  });
});

describe("auth.md documents the wallet-free path", () => {
  it("tells an agent with no key that it can still register", () => {
    // Otherwise the only documented way in requires something it does not
    // have, and it has no reason to think there is another.
    expect(AUTH_MARKDOWN).toContain('"type": "anonymous"');
    expect(AUTH_MARKDOWN).toContain("urn:ietf:params:oauth:grant-type:jwt-bearer");
  });

  it("says registration is free and grants nothing", () => {
    // An agent that assumes registering was enough will read its first
    // refusal as a bug rather than as the rule.
    expect(AUTH_MARKDOWN).toContain("free and buys nothing yet");
    expect(AUTH_MARKDOWN).toContain("agent:self");
  });

  it("names who pays once an agent is adopted", () => {
    expect(AUTH_MARKDOWN).toContain("billed to them");
  });
});

describe("the OpenAPI document describes the endpoint that takes money", () => {
  it("documents the paid deposit route", async () => {
    const { GET } = await import("../app/openapi.json/route");
    const doc = await GET().json();
    const path = doc.paths["/api/platform/billing/deposit/x402"];
    expect(path?.post).toBeTruthy();
    // The 402 is the expected first response, not a failure, and it carries
    // what to pay. A document that omitted it would leave an agent reading
    // its own successful handshake as an error.
    expect(path.post.responses["402"]).toBeTruthy();
    expect(JSON.stringify(path.post.responses["402"])).toContain("accepts");
  });

  it("declares payment only on operations that take it per call", async () => {
    // This asserted that NO operation declared a payment method, which was
    // right while PerkOS could settle none of them. It is wrong now that the
    // card rail exists, so it checks the real rule instead: the deposit is a
    // top-up rather than a per-call purchase, so it carries no offer set.
    const { GET } = await import("../app/openapi.json/route");
    const doc = await GET().json();
    const deposit = doc.paths["/api/platform/billing/deposit/x402"].post;
    expect(Object.keys(deposit)).not.toContain("x-payment-info");
  });

  it("says a wallet in the body is ignored", async () => {
    // Credit follows the signature on the payment. An agent that thinks it
    // can name the beneficiary would fund the wrong address on purpose.
    const { GET } = await import("../app/openapi.json/route");
    const doc = await GET().json();
    const description = doc.paths["/api/platform/billing/deposit/x402"].post.description;
    expect(description).toContain("ignored");
  });
});

/**
 * Payment discovery. The draft requires x-payment-info on every payable
 * operation plus a 402 in its responses, and the offers have to describe rails
 * that really settle — an advertised method nothing accepts sends an agent
 * through a payment flow that ends nowhere.
 */
describe("the paid API declares how it can be paid", () => {
  it("puts an offer set on the payable operation", async () => {
    const { GET } = await import("../app/openapi.json/route");
    const doc = await GET().json();
    const operation = doc.paths["/api/v1"].get;
    expect(operation["x-payment-info"].offers.length).toBeGreaterThan(1);
    // Required by the draft on every payable operation.
    expect(operation.responses["402"]).toBeTruthy();
  });

  it("declares every field the draft makes required", async () => {
    const { GET } = await import("../app/openapi.json/route");
    const doc = await GET().json();
    for (const offer of doc.paths["/api/v1"].get["x-payment-info"].offers) {
      expect(offer.intent).toMatch(/^(charge|session)$/);
      expect(offer.method).toBeTruthy();
      // Amount is a string of digits in the smallest unit, never a number.
      expect(offer.amount, `${offer.method} amount must be a digit string`).toMatch(/^\d+$/);
    }
  });

  it("quotes each rail in its own smallest unit", async () => {
    // A cent is "1" for USD and "10000" for USDC. Copying one number across
    // both would price one rail a million times off.
    const { GET } = await import("../app/openapi.json/route");
    const doc = await GET().json();
    const offers = doc.paths["/api/v1"].get["x-payment-info"].offers;
    const card = offers.find((o: { method: string }) => o.method === "stripe");
    const chain = offers.find((o: { method: string }) => o.method === "x402");
    expect(card.amount).toBe("1");
    expect(chain.amount).toBe("10000");
    // Blockchain offers name the token contract, per the draft.
    expect(chain.currency).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(card.currency).toBe("usd");
  });

  it("advertises no rail the endpoint cannot settle", async () => {
    // Only these two are implemented. Adding a method here without building it
    // is the same failure as an endpoint that 404s.
    const { GET } = await import("../app/openapi.json/route");
    const doc = await GET().json();
    const methods = new Set(
      doc.paths["/api/v1"].get["x-payment-info"].offers.map((o: { method: string }) => o.method),
    );
    expect([...methods].sort()).toEqual(["stripe", "x402"]);
  });
});
