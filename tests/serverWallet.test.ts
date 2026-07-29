import { describe, expect, it } from "vitest";

import {
  chainLabel,
  explorerTxUrl,
} from "../app/lib/serverWallet";

describe("server wallet chain presentation", () => {
  it("labels Robinhood Chain", () => {
    expect(chainLabel("robinhood")).toBe("Robinhood Chain");
  });

  it("links Robinhood transactions to its Blockscout explorer", () => {
    expect(explorerTxUrl("robinhood", "0xabc")).toBe(
      "https://robinhoodchain.blockscout.com/tx/0xabc",
    );
  });
});
