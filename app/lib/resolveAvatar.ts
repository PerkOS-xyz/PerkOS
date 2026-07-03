import "server-only";

/**
 * Resolve a wallet's ENS + Basename avatars and persist them onto
 * /wallets/{address}/profile/main. Runs SERVER-SIDE only — on-chain NFT avatars
 * (ERC-721/1155) require fetching token metadata (e.g. api.opensea.io), which is
 * CORS-blocked in the browser, so resolution must happen here, not on the client.
 *
 * Called two ways: fire-and-forget from the wallet-signin route (TTL-guarded,
 * never throws, never blocks sign-in) and from POST /api/avatar/resolve
 * (force:true, so the Settings "refresh" re-checks immediately). Never overrides
 * a source the user picked in Settings. Returns the resolution (or null on
 * error/TTL-skip) so the route can report found/none.
 */
import { adminDb } from "./firebaseAdmin";
import {
  defaultSourceFor,
  resolveOnchainAvatars,
  type ResolvedAvatars,
} from "./avatarResolveCore";

/** Re-resolve at most once a day per wallet (unless forced). */
const TTL_MS = 24 * 60 * 60 * 1000;

export async function resolveAndPersistAvatar(
  address: string,
  opts?: { force?: boolean }
): Promise<ResolvedAvatars | null> {
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

    if (!opts?.force && data.avatarResolvedAt) {
      const age = Date.now() - new Date(data.avatarResolvedAt).getTime();
      if (Number.isFinite(age) && age >= 0 && age < TTL_MS) return null; // fresh
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
    return r;
  } catch {
    // Best-effort — never block or fail sign-in.
    return null;
  }
}
