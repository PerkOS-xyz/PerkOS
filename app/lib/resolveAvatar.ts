import "server-only";

/**
 * On-login resolution of a wallet's ENS + Basename avatars, persisted onto
 * /wallets/{address}/profile/main. Fired best-effort (fire-and-forget) from the
 * wallet-signin route, next to recordUserLogin.
 *
 * Uses OnchainKit's identity utils: getName({chain:mainnet}) for ENS,
 * getName({chain:base}) for Basenames (falls back to ENS, so we gate on
 * isBasename), then getAvatar per chain. Default RPCs are fine for this volume
 * (once per wallet per 24h). Never throws — a miss just leaves the fallback.
 *
 * Priority for the AUTO default source is ENS → Basename → default, but we only
 * set the default when the user hasn't already picked a source in Settings.
 */
import { base, mainnet } from "viem/chains";
import type { Address } from "viem";
import { getAvatar, getName, isBasename } from "@coinbase/onchainkit/identity";

import { adminDb } from "./firebaseAdmin";

/** Re-resolve at most once a day per wallet. */
const TTL_MS = 24 * 60 * 60 * 1000;

type Resolved = {
  ensName: string | null;
  ensAvatarUrl: string | null;
  basename: string | null;
  basenameAvatarUrl: string | null;
};

async function resolveOnchain(address: Address): Promise<Resolved> {
  const [ensName, baseName] = await Promise.all([
    getName({ address, chain: mainnet }).catch(() => null),
    getName({ address, chain: base }).catch(() => null),
  ]);
  // getName({chain:base}) returns a basename OR falls back to an ENS name.
  const basename = baseName && isBasename(baseName) ? baseName : null;

  const [ensAvatarUrl, basenameAvatarUrl] = await Promise.all([
    ensName
      ? getAvatar({ ensName, chain: mainnet }).catch(() => null)
      : Promise.resolve(null),
    basename
      ? getAvatar({ ensName: basename, chain: base }).catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    ensName: ensName ?? null,
    ensAvatarUrl: ensAvatarUrl ?? null,
    basename,
    basenameAvatarUrl: basenameAvatarUrl ?? null,
  };
}

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

    const r = await resolveOnchain(wallet as Address);

    const patch: Record<string, unknown> = {
      ensName: r.ensName,
      ensAvatarUrl: r.ensAvatarUrl,
      basename: r.basename,
      basenameAvatarUrl: r.basenameAvatarUrl,
      avatarResolvedAt: new Date().toISOString(),
    };
    // Only set the default display source if the user hasn't chosen one.
    if (!data.avatarSource) {
      patch.avatarSource = r.ensAvatarUrl
        ? "ens"
        : r.basenameAvatarUrl
          ? "basename"
          : "default";
    }

    await ref.set(patch, { merge: true });
  } catch {
    // Best-effort — never block or fail sign-in.
  }
}
