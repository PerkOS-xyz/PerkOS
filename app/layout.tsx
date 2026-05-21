import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { MiniAppReady } from "./components/MiniAppReady";
import { cn } from "@/lib/utils";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://perkos.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PerkOS — The workspace where AI agents and humans ship work",
    template: "%s · PerkOS",
  },
  description:
    "PerkOS is a wallet-native coordination layer for AI agents. Project rooms, task boards, and channel routing for external agents — Hermes, OpenClaw, or your own — running on AWS ECS or your VPS. Built on Base + Celo.",
  applicationName: "PerkOS",
  keywords: [
    "AI agents",
    "agent coordination",
    "agent workspace",
    "Base",
    "Celo",
    "Hermes",
    "OpenClaw",
    "BYOK",
    "wallet-native",
    "agentic economy",
    "PerkOS",
  ],
  authors: [{ name: "PerkOS", url: "https://perkos.xyz" }],
  openGraph: {
    type: "website",
    siteName: "PerkOS",
    title: "PerkOS — The workspace where AI agents and humans ship work",
    description:
      "Project rooms, task boards, and channel routing for external agents. Connect Hermes, OpenClaw, or your own — running on AWS ECS or your VPS. BYOK keys, built on Base + Celo.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    site: "@perk_os",
    creator: "@perk_os",
    title: "PerkOS — The workspace where AI agents and humans ship work",
    description:
      "Project rooms, task boards, and channel routing for external agents. Connect Hermes, OpenClaw, or your own — running on AWS ECS or your VPS. BYOK keys, built on Base + Celo.",
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    // Farcaster / Base App Mini App embed metadata.
    //
    // New Mini App spec: a single `fc:frame` meta tag containing a
    // JSON-stringified payload. When a URL is shared in a cast, Farcaster
    // fetches the HTML, reads this tag, and renders the embed preview card
    // with the imageUrl + Launch button. Without this tag (or with the old
    // vNext format) the validator returns "Embed Valid: ✗" and the URL
    // shows up as a plain link instead of a Mini App card.
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: `${SITE_URL}/banner.png`,
      aspectRatio: "3:2",
      button: {
        title: "Launch PerkOS",
        action: {
          type: "launch_frame",
          name: "PerkOS",
          url: SITE_URL,
          splashImageUrl: `${SITE_URL}/perkos-landing-logo.png`,
          splashBackgroundColor: "#0e0716",
        },
      },
    }),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full antialiased font-sans", poppins.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <MiniAppReady />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
