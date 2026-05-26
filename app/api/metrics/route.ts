/**
 * GET /api/metrics
 *
 * Prometheus text-format exposition of process-level + business metrics
 * for the miniapp Next.js process. Worker processes expose their own
 * metrics on a separate port via app/worker/metricsServer.ts.
 *
 * Auth: a single shared bearer token, env var PERKOS_METRICS_TOKEN. We
 * deliberately don't tie this to Firebase admin auth because the
 * scraper (Grafana Agent / Alloy) is a daemon, not a user. The token
 * is a service-account-style credential. Without it set, the route
 * returns 503 — we never expose metrics anonymously.
 *
 * Why a bearer token vs. IP allowlist?
 *   - Behind Caddy, originating IPs are uniform — the proxy.
 *   - A token is portable across deploys + easy to rotate.
 *   - For Grafana Cloud's hosted scrape it's the only option anyway.
 *
 * Cache-Control: no-store. Metrics are point-in-time snapshots; a
 * cached response would smear histograms across scrapes.
 */
import { NextResponse } from "next/server";

import { renderMetrics } from "../../lib/metrics";

export async function GET(request: Request) {
  const expected = process.env.PERKOS_METRICS_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "PERKOS_METRICS_TOKEN is not set on the server." },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  // Constant-time compare to avoid leaking the token length / prefix
  // via timing — Node's timingSafeEqual requires equal-length buffers,
  // so pad/truncate against the expected token's length first.
  const a = Buffer.from(presented.padEnd(expected.length, "\0").slice(0, expected.length));
  const b = Buffer.from(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  if (diff !== 0) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { body, contentType } = await renderMetrics();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
    },
  });
}
