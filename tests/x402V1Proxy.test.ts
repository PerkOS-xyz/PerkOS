import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "../app/api/v1/[[...path]]/route";

/**
 * The proxy contributes the address, not the decision. If it drops the payment
 * header the upstream sees a caller that never paid; if it drops the
 * settlement header the caller that did pay has no transaction to point at.
 */
function captureFetch(status = 402, headers: Record<string, string> = {}) {
  const spy = vi.fn(async () =>
    new Response(JSON.stringify({ x402Version: 1 }), {
      status,
      headers: { "content-type": "application/json", ...headers },
    }),
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

const ctx = (path?: string[]) => ({ params: Promise.resolve({ path }) });

afterEach(() => vi.unstubAllGlobals());

describe("the paid API proxy", () => {
  it("maps a bare /api/v1 to the paid resource, not an index", async () => {
    const spy = captureFetch();
    await GET(new Request("https://perkos.xyz/api/v1?q=hi"), ctx(undefined));
    const url = String((spy.mock.calls[0]![0] as URL));
    expect(url).toMatch(/\/v1\?q=hi$/);
  });

  it("forwards the payment header", async () => {
    const spy = captureFetch(200);
    await GET(
      new Request("https://perkos.xyz/api/v1?q=hi", { headers: { "x-payment": "encoded" } }),
      ctx(undefined),
    );
    const sent = (spy.mock.calls[0]![1] as RequestInit).headers as Headers;
    expect(sent.get("x-payment")).toBe("encoded");
  });

  it("returns the settlement header to the caller", async () => {
    captureFetch(200, { "x-payment-response": "base64settlement" });
    const res = await GET(new Request("https://perkos.xyz/api/v1?q=hi"), ctx(undefined));
    expect(res.headers.get("x-payment-response")).toBe("base64settlement");
  });

  it("passes the 402 through unchanged", async () => {
    // Turning it into a 500 or a 200 would hide the price from the one caller
    // that needs it.
    captureFetch(402);
    const res = await GET(new Request("https://perkos.xyz/api/v1"), ctx(undefined));
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ x402Version: 1 });
  });

  it("never forwards an Authorization header", async () => {
    // The payment is the credential here. Forwarding a bearer token would let
    // this path act for a signed-in user without their session ever being
    // checked on this route.
    const spy = captureFetch(200);
    await GET(
      new Request("https://perkos.xyz/api/v1?q=hi", {
        headers: { authorization: "Bearer someone-elses-token", "x-payment": "encoded" },
      }),
      ctx(undefined),
    );
    const sent = (spy.mock.calls[0]![1] as RequestInit).headers as Headers;
    expect(sent.get("authorization")).toBeNull();
  });

  it("survives the API being down without pretending it paid", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    const res = await GET(new Request("https://perkos.xyz/api/v1?q=hi"), ctx(undefined));
    expect(res.status).toBe(502);
  });
});
