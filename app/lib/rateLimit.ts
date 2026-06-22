import { NextResponse } from "next/server";

/**
 * Minimal in-memory, per-key fixed-window rate limiter.
 *
 * Suits the self-hosted single Next standalone container — state lives in the
 * Node process and is shared across requests. For a multi-instance or
 * serverless deployment, swap the Map for a shared store (Redis / Upstash /
 * a Firestore counter).
 *
 * Used to throttle the UNAUTHENTICATED public routes (auth/nonce, contact,
 * request-access) so they can't be scripted into a Firestore-write or email
 * amplification DoS once the source is public.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

// Evict expired buckets at most once a minute so the Map can't grow unbounded
// across many distinct client IPs.
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
}

/**
 * Best-effort client IP for keying the limiter. Caddy sets X-Forwarded-For /
 * X-Real-IP to the real peer (it OVERWRITES any client-supplied value, so it
 * can't be spoofed here) — but as `host:port`. The ephemeral port changes per
 * connection, so we MUST strip it or every request gets a unique key and the
 * limit never accumulates.
 */
export function clientIp(req: Request): string {
  const raw =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return stripPort(raw);
}

function stripPort(addr: string): string {
  if (!addr) return "unknown";
  // [ipv6]:port → ipv6
  if (addr.startsWith("[")) {
    const end = addr.indexOf("]");
    return end > 0 ? addr.slice(1, end) : addr;
  }
  // ipv4:port has exactly one colon; a bare ipv6 has several → leave it.
  const colon = addr.indexOf(":");
  if (colon !== -1 && addr.indexOf(":", colon + 1) === -1) {
    return addr.slice(0, colon);
  }
  return addr;
}

/**
 * Returns null when the call is allowed, or a ready-to-return 429 response when
 * `key` has exceeded `limit` requests within `windowMs`.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  b.count += 1;
  if (b.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  return null;
}
