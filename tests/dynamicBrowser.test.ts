import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });
describe("Dynamic host isolation", () => {
  it("enables only a resolved regular browser with an environment", async () => {
    vi.stubEnv("NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID", "test-environment");
    const { dynamicBrowserEnabled } = await import("../app/lib/dynamicBrowser");
    expect(dynamicBrowserEnabled(false)).toBe(true);
    expect(dynamicBrowserEnabled(true)).toBe(false);
    expect(dynamicBrowserEnabled(null)).toBe(false);
  });
  it("keeps the fallback when no environment is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID", "");
    const { dynamicBrowserEnabled } = await import("../app/lib/dynamicBrowser");
    expect(dynamicBrowserEnabled(false)).toBe(false);
  });
  it("keeps Coinbase host wallets on their existing path", async () => {
    vi.stubEnv("NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID", "test-environment");
    vi.stubGlobal("navigator", { userAgent: "CoinbaseWallet" });
    const { dynamicBrowserEnabled } = await import("../app/lib/dynamicBrowser");
    expect(dynamicBrowserEnabled(false)).toBe(false);
  });
});
