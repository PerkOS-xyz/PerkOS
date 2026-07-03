"use client";

/**
 * Dynamic (dynamic.xyz) browser-only wallet connector — Phase 2.
 *
 * PerkOS App runs in 3 host contexts: Farcaster Mini App, Base App Mini App,
 * and a regular browser. Farcaster + Base App own the wallet UX through their
 * host connectors (see AutoConnect) and must NOT load Dynamic. In a *browser*
 * tab we offer Dynamic's connect modal + embedded wallet instead — and, later,
 * Solana wallets (Dynamic is multi-chain; the EVM connectors here become
 * `[EthereumWalletConnectors, SolanaWalletConnectors]` when that path lands).
 *
 * Activation is gated behind NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID: when the var
 * is unset, Dynamic is never mounted and the app behaves exactly as before
 * (the existing baseAccount / injected browser buttons). This makes the
 * connector a zero-regression, opt-in feature flag.
 *
 * NOTE: wagmi v3 is outside Dynamic's declared peer range (it pins wagmi ^2);
 * Dynamic documents v3.x as "may work (v3.1.0 tested)". The packages were
 * installed with --legacy-peer-deps. Revisit the pins when Dynamic ships
 * official wagmi v3 support.
 */
export const DYNAMIC_ENV_ID =
  process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID ?? "";

type MaybeCoinbaseProvider = { isCoinbaseBrowser?: boolean } | undefined;

/**
 * True inside the Coinbase Wallet / Base App IN-APP BROWSER. That host is not a
 * Mini App (`sdk.isInMiniApp()` returns false) but it DOES inject the user's
 * Coinbase Smart Wallet as the host identity — so it must use wagmi (like the
 * Mini App hosts), NOT Dynamic.
 *
 * Detection matches Coinbase's own Base Account SDK (`@base-org/account`),
 * which reads the injected provider's `isCoinbaseBrowser` flag:
 *   `(window.top?.ethereum ?? window.ethereum)?.isCoinbaseBrowser`.
 * The Coinbase Wallet RN user agent is a last-resort fallback.
 */
export function isCoinbaseInAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const w = window as Window & { ethereum?: MaybeCoinbaseProvider };
    const top = window.top as (Window & { ethereum?: MaybeCoinbaseProvider }) | null;
    const provider = top?.ethereum ?? w.ethereum;
    if (provider?.isCoinbaseBrowser) return true;
  } catch {
    // window.top access can throw cross-origin — fall through to the UA check.
  }
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return /CoinbaseWallet|CoinbaseBrowser|org\.toshi/i.test(ua);
}

/**
 * True only in a real browser tab (`isInMiniApp === false`) AND when a Dynamic
 * environment id is configured. `null` (host still resolving) and `true`
 * (inside a Mini App host) both return false — Dynamic must never mount inside
 * a Mini App. Also false in the Coinbase Wallet / Base App in-app browser: the
 * host owns the wallet there, so we stay on the wagmi/host path (same as the
 * Mini App hosts) instead of loading Dynamic.
 */
export function dynamicBrowserEnabled(isInMiniApp: boolean | null): boolean {
  if (isInMiniApp !== false) return false;
  if (DYNAMIC_ENV_ID === "") return false;
  if (isCoinbaseInAppBrowser()) return false;
  return true;
}
