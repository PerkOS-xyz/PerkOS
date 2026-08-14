import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const REQUEST_HEADERS = [
  "accept",
  "authorization",
  "content-type",
  // Preserve the browser context needed by the central activity service.
  // Caddy provides the trusted forwarding headers on the request received by
  // this server; cookies and origin still never leave the App boundary.
  "user-agent",
  "x-forwarded-for",
  "x-real-ip",
  "x-idempotency-key",
  "x-payment",
] as const;

const RESPONSE_HEADERS = [
  "content-type",
  "location",
  "retry-after",
  "x-payment-response",
] as const;

function platformApiBase(): URL {
  const configured =
    process.env.PERKOS_API_URL ??
    process.env.NEXT_PUBLIC_PERKOS_API_URL ??
    "https://api.perkos.xyz";
  return new URL(configured.endsWith("/") ? configured : `${configured}/`);
}

function targetUrl(request: Request, path: string[]): URL {
  const target = new URL(path.map(encodeURIComponent).join("/"), platformApiBase());
  target.search = new URL(request.url).search;
  return target;
}

export async function proxyPlatformRequest(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { path } = await context.params;
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    const upstream = await fetch(targetUrl(request, path), {
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

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Platform API unavailable" },
      { status: 502 },
    );
  }
}

export const GET = proxyPlatformRequest;
export const POST = proxyPlatformRequest;
export const PUT = proxyPlatformRequest;
export const PATCH = proxyPlatformRequest;
export const DELETE = proxyPlatformRequest;
export const OPTIONS = proxyPlatformRequest;
export const HEAD = proxyPlatformRequest;
