import { NextResponse } from "next/server";

/**
 * /api/v1 — the payment-gated agent API, proxied to PerkOS-API.
 *
 * ## Why the payment logic is not here
 *
 * This file moves bytes and headers. Building the payment requirements and
 * settling with the facilitator stay on the API side, where that code already
 * exists and is tested against the credits top-up.
 *
 * A second implementation of payment verification is where two
 * implementations drift, and the direction they drift is accepting a payment
 * that should not have settled. One place decides whether money moved.
 *
 * What this contributes is the address: the paid surface has to live on the
 * origin an agent already knows, so it is reachable at perkos.xyz rather than
 * behind a hostname it has to be told about.
 */
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

const REQUEST_HEADERS = [
  "accept",
  "content-type",
  "user-agent",
  "x-forwarded-for",
  "x-real-ip",
  // The payment itself, and the idempotency key that keeps a retry from
  // buying twice. Dropping either here would look upstream like a caller that
  // never paid.
  "x-payment",
  // The V2 name for the same thing. Forwarding only the V1 header makes a
  // V2 client look upstream like one that never paid.
  "payment-signature",
  "x-idempotency-key",
] as const;

const RESPONSE_HEADERS = [
  "content-type",
  "retry-after",
  // Carries the settlement back. Without it a caller that paid has no
  // transaction to point at.
  "x-payment-response",
  // V2 equivalents. Without these a V2 client gets a 402 it cannot read and
  // a settlement it cannot see.
  "payment-response",
  "payment-required",
] as const;

function apiBase(): URL {
  const configured =
    process.env.PERKOS_API_URL ??
    process.env.NEXT_PUBLIC_PERKOS_API_URL ??
    "https://api.perkos.xyz";
  return new URL(configured.endsWith("/") ? configured : `${configured}/`);
}

function targetUrl(request: Request, path: string[]): URL {
  // The catch-all is optional, so a bare /api/v1 maps to /v1 upstream — which
  // is the paid resource itself, not an index.
  const suffix = path.length ? `v1/${path.map(encodeURIComponent).join("/")}` : "v1";
  const target = new URL(suffix, apiBase());
  target.search = new URL(request.url).search;
  return target;
}

async function proxy(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    const upstream = await fetch(targetUrl(request, path ?? []), {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
    });

    const responseHeaders = new Headers();
    for (const name of RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    // Agents call this from anywhere, and nothing here is credentialed: the
    // payment is the credential and it travels in a header the caller sets.
    responseHeaders.set("access-control-allow-origin", "*");

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json({ error: "Platform API unavailable" }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
