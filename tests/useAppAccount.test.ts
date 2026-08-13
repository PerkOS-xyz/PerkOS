import { describe, expect, it } from "vitest";

import { resolveAppAccount } from "../app/lib/useAppAccount";

describe("unified Privy / Mini App account", () => {
  it("uses the Privy embedded address when Google/email has no wagmi connection", () => {
    expect(
      resolveAppAccount({
        browserAddress: "0xprivy",
        browserConnected: true,
        hasBrowserWallet: true,
        wagmiConnected: false,
      }),
    ).toEqual({ address: "0xprivy", isConnected: true });
  });

  it("falls back to the host wallet for Mini Apps", () => {
    expect(
      resolveAppAccount({
        browserConnected: false,
        hasBrowserWallet: false,
        wagmiAddress: "0xhost",
        wagmiConnected: true,
      }),
    ).toEqual({ address: "0xhost", isConnected: true });
  });

  it("does not expose a denied account as connected", () => {
    expect(
      resolveAppAccount({
        browserAddress: "0xprivy",
        browserConnected: false,
        hasBrowserWallet: true,
        wagmiConnected: false,
      }).isConnected,
    ).toBe(false);
  });
});
