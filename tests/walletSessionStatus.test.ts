import { describe, expect, it } from "vitest";

import { resolveWalletSessionStatus } from "../app/lib/useWalletSession";

const settled = {
  firebaseLoading: false,
  browserWalletLoading: false,
  hasBrowserWallet: true,
  wagmiStatus: "disconnected",
  isConnected: true,
  denial: null,
  syncing: false,
  inSync: true,
} as const;

describe("resolveWalletSessionStatus", () => {
  it("waits for Privy to restore a persisted wallet on a deep reload", () => {
    expect(
      resolveWalletSessionStatus({
        ...settled,
        browserWalletLoading: true,
        isConnected: false,
        inSync: false,
      }),
    ).toBe("loading");
  });

  it("reports signed out only after Privy has finished loading", () => {
    expect(
      resolveWalletSessionStatus({
        ...settled,
        isConnected: false,
        inSync: false,
      }),
    ).toBe("signed-out");
  });

  it("reports a restored matching wallet as signed in", () => {
    expect(resolveWalletSessionStatus(settled)).toBe("signed-in");
  });
});
