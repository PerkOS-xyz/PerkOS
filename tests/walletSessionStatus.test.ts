import { describe, expect, it } from "vitest";

import { resolveWalletSessionStatus } from "../app/lib/useWalletSession";

const settled = {
  firebaseLoading: false,
  dynamicLoading: false,
  hasDynamicWallet: true,
  wagmiStatus: "disconnected",
  isConnected: true,
  denial: null,
  syncing: false,
  inSync: true,
} as const;

describe("resolveWalletSessionStatus", () => {
  it("waits for Dynamic to restore a persisted wallet on a deep reload", () => {
    expect(
      resolveWalletSessionStatus({
        ...settled,
        dynamicLoading: true,
        isConnected: false,
        inSync: false,
      }),
    ).toBe("loading");
  });

  it("reports signed out only after Dynamic has finished loading", () => {
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
