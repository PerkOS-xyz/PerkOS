import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { MiniAppReady } from "./components/MiniAppReady";
import { DevAuthIndicator } from "./components/DevAuthIndicator";
import { LocaleProvider } from "./components/LocaleProvider";
import { cn } from "@/lib/utils";
import { GoogleAnalytics } from "./components/GoogleAnalytics";
import { WebMcpTools } from "./components/WebMcpTools";
import { publicToolsBootstrapScript } from "./lib/webMcpPublicTools";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Both web domains serve the landing; advertise one canonical SEO origin.
const CANONICAL_URL =
  process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

const OG_TITLE = "PerkOS AI: AI Teams for Small Businesses";
const OG_DESC =
  "PerkOS AI gives small businesses a ready-to-work AI team for growth, research, customer support and operations. Start free, no technical skills required.";

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_URL),
  title: {
    default: OG_TITLE,
    template: "%s | PerkOS AI",
  },
  description: OG_DESC,
  applicationName: "PerkOS AI",
  alternates: { canonical: "/" },
  keywords: [
    "AI for small business",
    "AI team",
    "AI employees",
    "AI assistant for business",
    "AI growth assistant",
    "AI bookkeeping",
    "AI customer support",
    "small business automation",
    "agentic AI",
    "no-code AI",
    "PerkOS",
  ],
  authors: [{ name: "PerkOS AI", url: CANONICAL_URL }],
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "380x380" }],
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "PerkOS AI",
    title: OG_TITLE,
    description: OG_DESC,
    url: CANONICAL_URL,
    images: [
      { url: "/banner.png", width: 2371, height: 1421, alt: "PerkOS AI: AI teams for small businesses" },
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
      {/* Raw <link rel="ai-catalog">, one of the three ways an agent finds the
          capability manifest. Next's metadata `alternates.types` cannot emit a
          custom rel — it renders rel="alternate", which no scanner looks for.
          React hoists this into <head>. */}
      <link
        rel="ai-catalog"
        type="application/json"
        href={`${CANONICAL_URL}/.well-known/ai-catalog.json`}
      />
        <GoogleAnalytics />
        <MiniAppReady />
        <Providers>
          <DevAuthIndicator />
          {/*
            Mounted at the root, not in the app shell, so an agent landing on
            a public page can discover the tools too. It was inside (app),
            which meant the only visitors who could see it were the ones who
            had already signed in and no longer needed to be told how.
          */}
          {/*
            Registers the public tools before React hydrates. Without it the
            tools do not exist at the load event, and a visitor that checks
            then sees a site with no tools at all. WebMcpTools republishes the
            same names once hydrated, adding the session tools if signed in.
          */}
          <script
            id="webmcp-bootstrap"
            dangerouslySetInnerHTML={{ __html: publicToolsBootstrapScript() }}
          />
          <WebMcpTools />
          <LocaleProvider>{children}</LocaleProvider>
        </Providers>
      </body>
    </html>
  );
}
