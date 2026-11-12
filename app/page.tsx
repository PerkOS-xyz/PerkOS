import type { Metadata } from "next";

import { LandingAutoRoute } from "./components/LandingAutoRoute";
import { LandingContentV2 } from "./components/landing/v2/LandingContentV2";

export const metadata: Metadata = {
  title: "PerkOS AI: AI Teams for Small Businesses",
  description:
    "PerkOS (PerkOS AI) gives small businesses a ready-to-work AI team for growth, research, customer support and operations. Start free, no technical skills required.",
};

// ============================================================================
// Page — the PerkOS landing (replacing perkos.xyz).
//
// This file stays a SERVER Component: it owns the page `metadata` and the
// JSON-LD structured data below. All the rendered, translatable body lives in
// the client component `LandingContentV2` (react-i18next + the scroll motion
// system built on branch dex/landing), which the LanguageSelector switches at
// runtime. The previous body (LandingContent) is kept in the repo untouched.
//
// Audience: NON-TECHNICAL small-business owners first (anxious about AI —
// user testing showed robot imagery + tech jargon scared them), investors /
// partners / developers second (one contained strip).
//
// Structure (strategy blueprint): hero → fear-killer → templates (the
// conversion centerpiece) → meet your team → how it works → expertise
// (authority without jargon) → product comparison → beyond teams (AI services
// in general) → pricing teaser → builders strip → talk to us → final CTA.
//
// Vocabulary contract: teammates/team, drafts, you approve, set up, ready in
// minutes. Banned on this page: agent (as a buyer-facing noun), bot, robot,
// deploy, provision, infrastructure, blockchain/x402/token, LLM. "Agentic AI"
// appears exactly once — explained in plain words (expertise section).
// ============================================================================

// Structured data (JSON-LD) — drives the Google result's logo + site name and
// makes PerkOS eligible for a rich brand card / sitelinks. Organization.logo
// is the square brand mark; sameAs links the official social profiles.
const SITE = "https://perkos.xyz";
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#org`,
      name: "PerkOS",
      alternateName: ["PerkOS AI", "Perk OS"],
      url: SITE,
      logo: `${SITE}/logo.png`,
      slogan: "AI teams for small businesses. They draft, you approve.",
      // The canonical ~50-word description: the same words go on GitHub,
      // Karma, CoinGecko and the social profiles, so every source agrees.
      description:
        "PerkOS, also called PerkOS AI, is the platform at perkos.xyz where a small business gets a team of AI agents. Sparky plans the work on a shared board, specialist agents draft it, and the owner approves. It is built on open standards: x402 for payments in USDC and ERC-8004 for checking agent identity and reputation. PERKOS is the community token.",
      // Says which PerkOS this is in positive terms only. Naming what we are
      // not would put those words next to our name in a model's memory.
      disambiguatingDescription:
        "PerkOS at perkos.xyz: AI teams for small businesses, built on x402 and ERC-8004, online since December 2025.",
      foundingDate: "2025-12",
      founder: {
        "@type": "Person",
        "@id": `${SITE}/#founder`,
        name: "Julio Cruz",
        sameAs: ["https://github.com/JulioMCruz"],
      },
      knowsAbout: ["AI agents", "x402", "ERC-8004", "Small business automation"],
      // Profiles of the organization only. The token's listing and explorers
      // describe the token, not the company, so they live on /token.
      sameAs: [
        "https://x.com/perk_os",
        "https://github.com/PerkOS-xyz",
        "https://www.linkedin.com/company/perkos/",
        "https://www.instagram.com/perkos.xyz/",
        "https://farcaster.xyz/perkos",
        "https://www.karmahq.org/project/perkos",
      ],
      subjectOf: { "@id": `${SITE}/token#page` },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      name: "PerkOS AI",
      alternateName: ["PerkOS", "Perk OS"],
      url: SITE,
      publisher: { "@id": `${SITE}/#org` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE}/#app`,
      name: "PerkOS AI",
      alternateName: "PerkOS",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, macOS, Windows, Linux",
      url: SITE,
      publisher: { "@id": `${SITE}/#org` },
      isAccessibleForFree: true,
      featureList: [
        "Sparky coordinates a team of AI agents on a shared board",
        "Every result waits for human approval",
        "PerkOS Cloud, or PerkOS Runtime on your own computers",
        "x402 pay-per-request payments in USDC",
        "ERC-8004 agent identity and reputation checks",
      ],
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "0",
        highPrice: "239.97",
        priceCurrency: "USD",
        offerCount: "4",
      },
      description:
        "Launch a team of AI teammates for your small business in one click, they draft, you approve.",
    },
  ],
};

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c"),
        }}
      />
      <LandingAutoRoute />
      <LandingContentV2 />
    </div>
  );
}
