import "server-only";

/**
 * On-login resolution of a wallet's ENS + Basename avatars, persisted onto
 * /wallets/{address}/profile/main. Fired best-effort (fire-and-forget) from the
 * wallet-signin route next to recordUserLogin. TTL-guarded (24h), never throws,
 * never overrides a source the user picked in Settings. The actual on-chain
 * reads live in avatarResolveCore (shared with the client "refresh" path).
 */
import { adminDb } from "./firebaseAdmin";
import { defaultSourceFor, resolveOnchainAvatars } from "./avatarResolveCore";

/** Re-resolve at most once a day per wallet. */
const TTL_MS = 24 * 60 * 60 * 1000;

export async function resolveAndPersistAvatar(address: string): Promise<void> {
  try {
    const wallet = address.toLowerCase();
    const ref = adminDb()
      .collection("wallets")
      .doc(wallet)
      .collection("profile")
      .doc("main");

    const snap = await ref.get();
    const data = (snap.exists ? snap.data() : {}) as {
      avatarSource?: string | null;
      avatarResolvedAt?: string | null;
    };

    if (data.avatarResolvedAt) {
      const age = Date.now() - new Date(data.avatarResolvedAt).getTime();
      if (Number.isFinite(age) && age >= 0 && age < TTL_MS) return; // fresh
    }

    const r = await resolveOnchainAvatars(
      wallet,
      process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
    );

    const patch: Record<string, unknown> = {
      ensName: r.ensName,
      ensAvatarUrl: r.ensAvatarUrl,
      basename: r.basename,
      basenameAvatarUrl: r.basenameAvatarUrl,
      avatarResolvedAt: new Date().toISOString(),
    };
    // Only set the default display source if the user hasn't chosen one.
    if (!data.avatarSource) patch.avatarSource = defaultSourceFor(r);

    await ref.set(patch, { merge: true });
  } catch {
    // Best-effort — never block or fail sign-in.
  }
}
