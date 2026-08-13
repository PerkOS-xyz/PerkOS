import { createConfig, http } from "wagmi";
import { base, baseSepolia, celo } from "wagmi/chains";
import { baseAccount, injected } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { robinhoodChain } from "./chains";

// NEXT_PUBLIC_ALCHEMY_API_KEY is baked at build time. With it set, all
// configured chains route through Alchemy (paid plan, no rate limit). Without
// it (e.g. forks / preview deploys missing the secret), they fall back
// to the chain default RPC (public, heavily rate-limited — produces 429s
// in the browser console when the user is on Base mainnet).
const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const baseRpc = alchemyKey
  ? `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`
  : undefined;
const baseSepoliaRpc = alchemyKey
  ? `https://base-sepolia.g.alchemy.com/v2/${alchemyKey}`
  : undefined;
const celoRpc = alchemyKey
  ? `https://celo-mainnet.g.alchemy.com/v2/${alchemyKey}`
  : undefined;
const robinhoodRpc = alchemyKey
  ? `https://robinhood-mainnet.g.alchemy.com/v2/${alchemyKey}`
  : robinhoodChain.rpcUrls.default.http[0];

export const wagmiConfig = createConfig({
  // Base + Celo + Robinhood Chain are the chains the user can pick from the
  // header
  // NetworkPill. baseSepolia stays in the list because the Receipt
  // Anchor contract lives there during alpha — receipt code keeps
  // talking to Sepolia even when the user switches header chain.
  //
  // Browser Privy and Mini App wagmi paths expose this same chain set.
  chains: [base, celo, robinhoodChain, baseSepolia],
  connectors: [
    // Auto-detected when running inside Farcaster (Warpcast web/mobile)
    // or any other Farcaster Mini App host. AutoConnect picks this when
    // sdk.context.client.clientFid is the Farcaster host id.
    farcasterMiniApp(),
    // Base smart wallet — used inside Base App (auto-detected) and as
    // the "Sign in with email" option in a regular browser tab.
    baseAccount({ appName: "PerkOS" }),
    injected({ shimDisconnect: true }),
  ],
  transports: {
    [base.id]: http(baseRpc),
    [celo.id]: http(celoRpc),
    [robinhoodChain.id]: http(robinhoodRpc),
    [baseSepolia.id]: http(baseSepoliaRpc),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
