/**
 * Records each successful wallet sign-in's source IP + geolocation into
 * Firestore `/user_logins/{wallet}`, for the Admin "users" log ("where did
 * this user last connect from").
 *
 * Best-effort by design: never throws, never blocks the sign-in response.
 * Called fire-and-forget from the wallet-signin route. We run on a long-lived
 * Node server (Next standalone), so the promise completes after the response
 * is already sent.
 *
 *   /user_logins/{lowercased-wallet} = {
 *     lastSeenAt:  ISO string,
 *     ip:          string | null,
 *     city, region, country, countryCode: string | null,
 *   }
 */
import { adminDb } from "./firebaseAdmin";

/** Real client IP from the proxy chain (Caddy sets X-Forwarded-For). */
function clientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || null;
}

type Geo = {
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
};

/** ipwho.is — free, HTTPS, no API key. Best-effort with a short timeout. */
async function lookupGeo(ip: string): Promise<Geo | null> {
  // Skip private / loopback ranges that won't resolve.
  if (/^(10\.|127\.|192\.168\.|::1|fc|fd)/i.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) {
    return null;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const d = (await res.json()) as {
      success?: boolean;
      city?: string;
      region?: string;
      country?: string;
      country_code?: string;
    };
    if (!d || d.success === false) return null;
    return {
      city: d.city ?? null,
      region: d.region ?? null,
      country: d.country ?? null,
      countryCode: d.country_code ?? null,
    };
  } catch {
    return null;
  }
}

export async function recordUserLogin(
  address: string,
  request: Request,
): Promise<void> {
  try {
    const wallet = address.toLowerCase();
    const ip = clientIp(request);
    const ref = adminDb().collection("user_logins").doc(wallet);

    // Write the IP + timestamp first so we always have the latest connection,
    // even if the geo lookup fails or is slow.
    await ref.set(
      { lastSeenAt: new Date().toISOString(), ip: ip ?? null },
      { merge: true },
    );

    if (!ip) return;
    const geo = await lookupGeo(ip);
    if (geo) await ref.set(geo, { merge: true });
  } catch {
    // Best-effort — never let login telemetry break sign-in.
  }
}
