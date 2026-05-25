/**
 * USDC contract addresses for the chains the header NetworkPill
 * exposes. All chains use the canonical 6-decimal native USDC issued
 * by Circle, not bridged "USDC.e" variants.
 *
 * Sources:
 *   - Base mainnet:  https://developers.circle.com/stablecoins/usdc-on-main-networks
 *   - Celo mainnet:  https://developers.circle.com/stablecoins/usdc-on-main-networks
 */

import { base, celo } from "wagmi/chains";

export type SupportedChainId = typeof base.id | typeof celo.id;

export const USDC_BY_CHAIN: Record<
  SupportedChainId,
  { address: `0x${string}`; symbol: "USDC"; decimals: 6 }
> = {
  [base.id]: {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    decimals: 6,
  },
  [celo.id]: {
    address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    symbol: "USDC",
    decimals: 6,
  },
};

export function isSupportedChainId(
  chainId: number | undefined,
): chainId is SupportedChainId {
  return chainId === base.id || chainId === celo.id;
}
