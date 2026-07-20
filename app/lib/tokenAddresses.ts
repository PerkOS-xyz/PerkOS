/**
 * Token contract addresses for the chains the header NetworkPill
 * exposes balances on.
 *
 * STABLECOIN = the canonical stablecoin surfaced by each network: native USDC
 * on Base/Celo and USDG on Robinhood Chain.
 *
 * PERKOS = the workspace utility token (18 decimals). Mainnet only;
 * no testnet deployments tracked here.
 *
 * Sources:
 *   - USDC Base mainnet:  https://developers.circle.com/stablecoins/usdc-on-main-networks
 *   - USDC Celo mainnet:  https://developers.circle.com/stablecoins/usdc-on-main-networks
 *   - Robinhood Chain + USDG: https://docs.robinhood.com/chain/contracts/
 *   - PERKOS addresses provided by the team, updated 2026-07-20.
 */

import { base, celo } from "wagmi/chains";
import { robinhoodChain } from "./chains";

export type SupportedChainId =
  | typeof base.id
  | typeof celo.id
  | typeof robinhoodChain.id;

type TokenInfo = {
  address: `0x${string}`;
  symbol: string;
  /** Decimals as declared by the ERC20 contract. */
  decimals: number;
};

export const STABLECOIN_BY_CHAIN: Record<SupportedChainId, TokenInfo> = {
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
  [robinhoodChain.id]: {
    address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
    symbol: "USDG",
    decimals: 6,
  },
};

export const PERKOS_BY_CHAIN: Record<SupportedChainId, TokenInfo> = {
  [base.id]: {
    address: "0xF714E60f85497D70508F7E356b5DB80e64539BA3",
    symbol: "PERKOS",
    decimals: 18,
  },
  [celo.id]: {
    address: "0xb7Ba43fBD4F2E85FCE929f7d4DFE3905Ae846A46",
    symbol: "PERKOS",
    decimals: 18,
  },
  [robinhoodChain.id]: {
    address: "0x56663ecfbe0547b493d348d5fc30de521864eba3",
    symbol: "PERKOS",
    decimals: 18,
  },
};

export function isSupportedChainId(
  chainId: number | undefined,
): chainId is SupportedChainId {
  return (
    chainId === base.id ||
    chainId === celo.id ||
    chainId === robinhoodChain.id
  );
}
