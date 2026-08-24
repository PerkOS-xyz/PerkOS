import { describe, expect, it } from "vitest";

import { GET as profile } from "../app/.well-known/ucp/route";
import { GET as handlerSchema } from "../app/.well-known/ucp/x402-handler.schema.json/route";

/**
 * The profile describes a business that takes payment and sells no catalogue.
 * The risk in a discovery document is not omission, it is claiming something
 * an agent will then try to use.
 */
describe("UCP profile", () => {
  it("declares the version, which is the only required field", async () => {
    const doc = await profile().json();
    expect(doc.ucp.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("declares a payment handler with the networks that really work", async () => {
    const doc = await profile().json();
    const handler = doc.ucp.payment_handlers["xyz.perkos.x402"][0];
    expect(handler.config.type).toBe("X402");
    expect(handler.available_instruments[0].constraints.networks).toEqual(["base", "celo"]);
  });

  it("declares no shopping service or capability", async () => {
    // Declaring a service commits to operating that endpoint with that
    // schema. PerkOS has no cart and no order lifecycle, and UCP puts metered
    // API access outside its own scope, so there is no honest one to name.
    const doc = await profile().json();
    expect(doc.ucp.services).toBeUndefined();
    expect(doc.ucp.capabilities).toBeUndefined();
  });

  it("namespaces the handler under our own domain", async () => {
    // Naming it under dev.ucp. would imply it behaves like a handler the
    // specification defines.
    const doc = await profile().json();
    expect(Object.keys(doc.ucp.payment_handlers)).toEqual(["xyz.perkos.x402"]);
  });

  it("quotes no price, pointing at the endpoint that has the live one", async () => {
    // A number here goes stale the moment the rate changes, and a stale price
    // in a discovery document is worse than none.
    const doc = await profile().json();
    const config = doc.ucp.payment_handlers["xyz.perkos.x402"][0].config;
    expect(JSON.stringify(config)).not.toMatch(/"amount"|"price"|0\.3/);
    expect(config.payment_requirements_url).toContain("/billing/deposit/x402");
  });

  it("references a schema that this origin actually serves", async () => {
    // A schema URL that 404s leaves a caller unable to tell a handler it
    // cannot parse from one it fetched wrong.
    const doc = await profile().json();
    const url = doc.ucp.payment_handlers["xyz.perkos.x402"][0].schema;
    expect(url).toContain("/.well-known/ucp/x402-handler.schema.json");

    const served = await handlerSchema().json();
    expect(served.$id).toBe(url);
    expect(served.required).toContain("payment_requirements_url");
  });

  it("keeps the profile and the schema agreeing on the config shape", async () => {
    const doc = await profile().json();
    const config = doc.ucp.payment_handlers["xyz.perkos.x402"][0].config;
    const schema = await handlerSchema().json();
    // additionalProperties is false, so a config key the schema omits makes
    // our own published profile fail its own published validation.
    for (const key of Object.keys(config)) {
      expect(Object.keys(schema.properties), `${key} is not in the schema`).toContain(key);
    }
    for (const required of schema.required) {
      expect(Object.keys(config)).toContain(required);
    }
  });
});
