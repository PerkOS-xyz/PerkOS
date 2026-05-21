import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { baseAccount, injected } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
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
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
