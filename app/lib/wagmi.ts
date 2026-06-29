import { createConfig, http } from "wagmi";
import { base, baseSepolia, celo } from "wagmi/chains";
import { baseAccount, injected } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

// NEXT_PUBLIC_ALCHEMY_API_KEY is baked at build time. With it set, all
// three chains route through Alchemy (paid plan, no rate limit). Without
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

export const wagmiConfig = createConfig({
  // base + celo are the chains the user can pick from the header
  // NetworkPill. baseSepolia stays in the list because the Receipt
  // Anchor contract lives there during alpha — receipt code keeps
  // talking to Sepolia even when the user switches header chain.
  //
  // IMPORTANT: this set MUST match the EVM networks enabled in the Dynamic
  // dashboard (base + celo + baseSepolia). A chain present here but not in
  // Dynamic — or in Dynamic but not here — makes DynamicWagmiConnector drop
  // the wallet mid-sign-in (the wallet's active chain can't be reconciled),
  // surfacing as ConnectorNotConnectedError on personal_sign. celoSepolia was
  // removed for exactly that reason: unused in-app and absent from Dynamic.
  chains: [base, celo, baseSepolia],
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
    [baseSepolia.id]: http(baseSepoliaRpc),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
