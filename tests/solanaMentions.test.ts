import { expect, it } from "vitest";
import { mentionsWallet } from "../app/lib/mentions";

it("matches Solana mentions exactly and retains EVM normalization", () => {
  const wallet = "So11111111111111111111111111111111111111112";
  expect(mentionsWallet([`user:${wallet}`], wallet)).toBe(true);
  expect(mentionsWallet([`user:${wallet}`], wallet.toLowerCase())).toBe(false);
  expect(mentionsWallet([`agent:${wallet}`], wallet)).toBe(false);
  expect(mentionsWallet([`user:0x${"AB".repeat(20)}`], `0x${"ab".repeat(20)}`)).toBe(true);
});
