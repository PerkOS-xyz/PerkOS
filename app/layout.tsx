import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { MiniAppReady } from "./components/MiniAppReady";
import { DevAuthIndicator } from "./components/DevAuthIndicator";
import { cn } from "@/lib/utils";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Two distinct domains, deliberately decoupled:
//  - SITE_URL: the Mini App launch domain (Base App / Farcaster register the app
//    at app.perkos.xyz, baked via NEXT_PUBLIC_SITE_URL). Used ONLY by the
//    fc:frame embed + base:app_id below.
//  - CANONICAL_URL: the public marketing domain for SEO. The landing serves on
//    both perkos.xyz and app.perkos.xyz, so we declare perkos.xyz canonical
//    (metadataBase, canonical link, og:url) to avoid duplicate content and to
//    brand the Google result as perkos.xyz.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.perkos.xyz";
const CANONICAL_URL =
  process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

const OG_TITLE = "PerkOS — Your business just hired its first team";
const OG_DESC =
  "Pick your type of business and in two minutes you have a small AI team that handles the busywork — marketing, customer replies, research, the books. They draft, you approve. No tech skills needed.";

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_URL),
  title: {
    default: "PerkOS — AI teams that run your small business",
    template: "%s · PerkOS",
  },
  description: OG_DESC,
  applicationName: "PerkOS",
  alternates: { canonical: "/" },
  keywords: [
    "AI for small business",
    "AI team",
    "AI employees",
    "AI assistant for business",
    "AI marketing assistant",
    "AI bookkeeping",
    "AI customer support",
    "small business automation",
    "agentic AI",
    "no-code AI",
    "PerkOS",
  ],
  authors: [{ name: "PerkOS", url: CANONICAL_URL }],
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "380x380" }],
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "PerkOS",
    title: OG_TITLE,
    description: OG_DESC,
    url: CANONICAL_URL,
    images: [
      { url: "/banner.png", width: 2371, height: 1421, alt: "PerkOS — AI teams for small businesses" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@perk_os",
    creator: "@perk_os",
    title: OG_TITLE,
    description: OG_DESC,
    images: ["/banner.png"],
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
    // Base App registration id — links this URL to the PerkOS entry in
    // the Base App directory. Rendered as <meta name="base:app_id" …>
    // in every page (root layout = site-wide).
    "base:app_id": "6a0f183304010f6b416f34e1",
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
        <Providers>
          <DevAuthIndicator />
          {children}
        </Providers>
      </body>
    </html>
  );
}
