import { createConfig, http } from "wagmi";
import { base, baseSepolia, celo } from "wagmi/chains";
import { baseAccount, injected } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

export const wagmiConfig = createConfig({
  // base + celo are the chains the user can pick from the header
  // NetworkPill. baseSepolia stays in the list because the Receipt
  // Anchor contract lives there during alpha — receipt code keeps
  // talking to Sepolia even when the user switches header chain.
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
    [base.id]: http(),
    [celo.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
