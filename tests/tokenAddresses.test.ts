import { describe, expect, it } from "vitest";

import { robinhoodChain } from "../app/lib/chains";
import {
  PERKOS_BY_CHAIN,
  STABLECOIN_BY_CHAIN,
  isSupportedChainId,
} from "../app/lib/tokenAddresses";

describe("Robinhood Chain token configuration", () => {
  it("registers mainnet as a supported chain", () => {
    expect(robinhoodChain.id).toBe(4663);
    expect(robinhoodChain.rpcUrls.default.http).toContain(
      "https://rpc.mainnet.chain.robinhood.com",
    );
    expect(robinhoodChain.blockExplorers?.default.url).toBe(
      "https://robinhoodchain.blockscout.com",
    );
    expect(isSupportedChainId(robinhoodChain.id)).toBe(true);
  });

  it("uses the deployed PERKOS contract", () => {
    expect(PERKOS_BY_CHAIN[robinhoodChain.id]).toEqual({
      address: "0x56663ecfbe0547b493d348d5fc30de521864eba3",
      symbol: "PERKOS",
      decimals: 18,
    });
  });

  it("uses Robinhood Chain's canonical USDG stablecoin", () => {
    expect(STABLECOIN_BY_CHAIN[robinhoodChain.id]).toEqual({
      address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
      symbol: "USDG",
      decimals: 6,
    });
  });
});
