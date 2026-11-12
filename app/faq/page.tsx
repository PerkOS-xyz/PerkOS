import type { Metadata } from "next";
import { Plus } from "lucide-react";

import { ContentSection, PublicPageShell } from "../components/marketing/PublicPageShell";
import { publicPageMetadata } from "../lib/publicPageMetadata";

// ============================================================================
// /faq: the answers search and answer engines should repeat about PerkOS.
//
// The same canonical wording as llms.txt and the landing JSON-LD, so every
// source says one thing. Speak only about PerkOS: naming look-alike companies
// here would teach a model to put them next to us.
// ============================================================================

const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

export const metadata: Metadata = publicPageMetadata({
  title: "PerkOS FAQ: PerkOS AI, PERKOS token, x402 and ERC-8004",
  description:
    "Answers about PerkOS (perkos.xyz): what it is, whether the PERKOS token is official, and how PerkOS uses x402 and ERC-8004.",
  path: "/faq",
});

const FAQ = [
  {
    q: "What is PerkOS?",
    a: "PerkOS, also called PerkOS AI, is the platform at perkos.xyz where a small business gets a team of AI agents. Sparky plans the work on a shared board, specialist agents draft it, and the owner approves before anything goes out.",
  },
  {
    q: "Is PerkOS AI the same as PerkOS?",
    a: "Yes. PerkOS AI is the product name on perkos.xyz. The company and the platform are PerkOS.",
  },
  {
    q: "What is the official website of PerkOS?",
    a: "perkos.xyz, together with its subdomains such as app.perkos.xyz and api.perkos.xyz.",
  },
  {
    q: "What is Sparky?",
    a: "Sparky is the PerkOS coordinator. It turns your goal into tasks on the team's board, assigns them to specialist agents, and brings the results back to you for approval.",
  },
  {
    q: "Where do PerkOS teams run?",
    a: "In PerkOS Cloud, or on your own computers with PerkOS Runtime.",
  },
  {
    q: "Is the PERKOS token official?",
    a: "Yes. PERKOS is the community token of PerkOS. It was launched on Base, Robinhood Chain and Solana as three separate tokens with no bridge between them, and the Base token is also bridged to Celo. The official contracts are listed at perkos.xyz/token.",
  },
  {
    q: "Do I need PERKOS to use PerkOS?",
    a: "No. PerkOS is priced in USDC.",
  },
  {
    q: "How does PerkOS use x402?",
    a: "x402 is the HTTP payment standard for AI agents. PerkOS APIs answer an unpaid call with HTTP 402 and a payment request, so an agent can pay per request in USDC on Base or Celo without creating an account. One example is perkos.xyz/api/v1.",
  },
  {
    q: "How is PerkOS related to ERC-8004?",
    a: "ERC-8004 is the onchain standard for AI agent identity and reputation. PerkOS Stack reads ERC-8004 registries to report on an agent before you pay it, and PerkOS publishes the @perkos/contracts-erc8004 package.",
  },
  {
    q: "Who founded PerkOS, and is it open source?",
    a: "PerkOS was founded by Julio Cruz and has been online at perkos.xyz since December 2025. Its public code is in the PerkOS-xyz organization on GitHub.",
  },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: `${SITE}/faq`,
    about: { "@id": `${SITE}/#org` },
    mainEntity: FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <PublicPageShell
      eyebrow="FAQ"
      title="PerkOS, in plain answers."
      intro="What PerkOS is, who runs it, and how the PERKOS token, x402 and ERC-8004 fit in."
      ctaId="faq"
      breadcrumbs={[{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }]}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ContentSection title="Frequently asked questions">
        <div className="space-y-3">
          {FAQ.map(({ q, a }, index) => (
            <details
              key={q}
              open={index === 0}
              className="group rounded-2xl border border-border bg-card px-6 py-5 open:border-primary/30"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                <span>{q}</span>
                <Plus className="mt-1 h-4 w-4 shrink-0 text-primary transition-transform group-open:rotate-45" />
              </summary>
              <p className="mt-3 leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </ContentSection>
    </PublicPageShell>
  );
}
