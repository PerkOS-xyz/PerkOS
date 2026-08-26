import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/(app)/wallet/CardTopUp.tsx"), "utf8");
const strings = JSON.parse(
  readFileSync(join(process.cwd(), "app/i18n/locales/en.json"), "utf8"),
) as { wallet: { cardTopUp?: Record<string, string> } };

/**
 * This component starts a payment. What matters is that it never decides what
 * was paid, and that it does not leave someone to discover the floor by being
 * refused.
 */
describe("card top-up", () => {
  it("offers only amounts the server accepts", () => {
    // A free-form field here would send people to a checkout the API rejects,
    // after they had already chosen an amount.
    expect(source).toContain("const AMOUNTS = [5, 10, 25] as const");
  });

  it("does not credit anything itself", () => {
    // The balance moves only on Stripe's signed webhook. Anything here that
    // wrote a balance would be a second, unsigned source of truth about money.
    expect(source).not.toMatch(/credit\(|setBalance|creditsUsd\s*=/);
  });

  it("shows the server's own reason when checkout will not start", () => {
    // "Not configured" and "bad amount" call for different things from the
    // person reading it.
    expect(source).toContain("body.error?.message");
  });

  it("points people wanting less at the rail that suits it", () => {
    // Buying small genuinely is better on USDC, which is worth saying rather
    // than letting someone hunt for an amount that does not exist.
    expect(strings.wallet.cardTopUp?.smallAmounts).toMatch(/USDC/);
  });

  it("has every string it renders", () => {
    for (const key of ["title", "description", "smallAmounts", "failed"]) {
      expect(strings.wallet.cardTopUp?.[key], `wallet.cardTopUp.${key} is missing`).toBeTruthy();
    }
  });
});
