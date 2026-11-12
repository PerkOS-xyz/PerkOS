/**
 * The official PERKOS contracts, one source for /token, /investors, the
 * JSON-LD and llms.txt.
 *
 * Three are native launches with no bridge between them. The Celo address is
 * NOT a fourth token: it is the Base token wrapped by the Wormhole token bridge
 * (`TokenBridge.createWrapped`, 2026-02-24; `chainId()` returns 30, Base in
 * Wormhole's numbering, and the bridge's `wrappedAsset(30, base CA)` returns
 * this address). Calling it an independent launch would be wrong.
 *
 * Never add a price, a market cap or a "buy" link here.
 */
export type PerkosContract = {
  chain: string;
  address: string;
  decimals: number;
  /** Human-readable supply; omitted where it changes (a bridged balance). */
  supply?: string;
  kind: "native" | "bridged";
  origin: string;
  explorer: string;
};

export const PERKOS_CONTRACTS: PerkosContract[] = [
  {
    chain: "Base",
    address: "0xF714E60f85497D70508F7E356b5DB80e64539BA3",
    decimals: 18,
    supply: "100,000,000,000",
    kind: "native",
    origin: "Launched by the community through Bankr, February 2026.",
    explorer: "https://basescan.org/token/0xF714E60f85497D70508F7E356b5DB80e64539BA3",
  },
  {
    chain: "Robinhood Chain",
    address: "0x56663EcFbe0547B493d348D5fc30De521864Eba3",
    decimals: 18,
    supply: "100,000,000,000",
    kind: "native",
    origin: "Launched by PerkOS through Bankr, July 2026.",
    explorer: "https://robinhoodchain.blockscout.com/token/0x56663EcFbe0547B493d348D5fc30De521864Eba3",
  },
  {
    chain: "Solana",
    address: "GvZ9UXZm8U14uZNi7hBN5cY2iUta7stArZE486yHe2nA",
    decimals: 6,
    supply: "925,075,444",
    kind: "native",
    origin: "Launched by PerkOS through ClawPump on Pump.fun, September 2026.",
    explorer: "https://solscan.io/token/GvZ9UXZm8U14uZNi7hBN5cY2iUta7stArZE486yHe2nA",
  },
  {
    chain: "Celo",
    address: "0xb7Ba43fBD4F2E85FCE929f7d4DFE3905Ae846A46",
    decimals: 18,
    kind: "bridged",
    origin: "The Base token, bridged to Celo through the Wormhole token bridge in February 2026. Same token, not a separate launch.",
    explorer: "https://celoscan.io/token/0xb7Ba43fBD4F2E85FCE929f7d4DFE3905Ae846A46",
  },
];

export const PERKOS_COINGECKO_URL = "https://www.coingecko.com/en/coins/perkos";

/** One line that every surface can repeat word for word. */
export const PERKOS_TOKEN_SUMMARY =
  "PERKOS is the community token of PerkOS. It was launched on Base, Robinhood Chain and Solana as three separate tokens with no bridge between them, and the Base token is also bridged to Celo. PerkOS is priced in USDC and does not require PERKOS.";
