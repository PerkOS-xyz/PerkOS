"use client";

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
export const PRIVY_CLIENT_ID = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID ?? "";

type MaybeCoinbaseProvider = { isCoinbaseBrowser?: boolean } | undefined;

export function isCoinbaseInAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const current = window as Window & { ethereum?: MaybeCoinbaseProvider };
    const top = window.top as
      | (Window & { ethereum?: MaybeCoinbaseProvider })
      | null;
    const provider = top?.ethereum ?? current.ethereum;
    if (provider?.isCoinbaseBrowser) return true;
  } catch {
    // Cross-origin access to window.top can fail; use the UA fallback below.
  }
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return /CoinbaseWallet|CoinbaseBrowser|org\.toshi/i.test(ua);
}

/** Privy is browser-only; verified Mini App and Coinbase host wallets keep wagmi. */
export function privyBrowserEnabled(isInMiniApp: boolean | null): boolean {
  if (isInMiniApp !== false) return false;
  if (!PRIVY_APP_ID) return false;
  if (isCoinbaseInAppBrowser()) return false;
  return true;
}
