import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

import { ContentSection, PublicPageShell } from "../components/marketing/PublicPageShell";
import {
  PERKOS_COINGECKO_URL,
  PERKOS_CONTRACTS,
  PERKOS_TOKEN_SUMMARY,
} from "../lib/perkosToken";
import { publicPageMetadata } from "../lib/publicPageMetadata";

// ============================================================================
// /token: the one page that says which PERKOS contracts are ours.
//
// Written for people checking a contract and for search and answer engines
// that need to tie the token to perkos.xyz. Facts only: provenance per chain,
// how to verify, and that the product does not need the token. No price, no
// market cap, no buy link, and none of the words stake, rewards, revenue,
// earn or yield: describing utility that is not live as if it were is how a
// community token starts reading like a promise of return.
// ============================================================================

const SITE = process.env.NEXT_PUBLIC_CANONICAL_URL ?? "https://perkos.xyz";

export const metadata: Metadata = publicPageMetadata({
  title: "PERKOS token: official contracts",
  description:
    "The official PERKOS token contracts on Base, Robinhood Chain, Solana and Celo, how to verify them, and what PERKOS is for in PerkOS.",
  path: "/token",
});

export default function TokenPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE}/token#page`,
        url: `${SITE}/token`,
        name: "PERKOS token: official contracts",
        about: { "@id": `${SITE}/token#perkos` },
        publisher: { "@id": `${SITE}/#org` },
      },
      {
        "@type": "Thing",
        "@id": `${SITE}/token#perkos`,
        name: "PERKOS",
        alternateName: ["$PERKOS", "PerkOS token"],
        description: PERKOS_TOKEN_SUMMARY,
        identifier: PERKOS_CONTRACTS.map((c) => ({
          "@type": "PropertyValue",
          propertyID: c.chain,
          value: c.address,
          url: c.explorer,
        })),
        sameAs: [PERKOS_COINGECKO_URL],
      },
    ],
  };

  return (
    <PublicPageShell
      eyebrow="PERKOS token"
      title="The official PERKOS contracts."
      intro="PERKOS is the community token of PerkOS (perkos.xyz). Only the contracts on this page are official."
      ctaId="token"
      breadcrumbs={[{ name: "Home", path: "/" }, { name: "Token", path: "/token" }]}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <ContentSection title="Contracts">
        <p>
          PERKOS was launched on three chains as separate tokens, with no bridge between them: each
          has its own contract, market and price. The Base token is also bridged to Celo, where it
          is the same token under a different address.
        </p>
        <ul className="grid gap-4 md:grid-cols-2">
          {PERKOS_CONTRACTS.map((c) => (
            <li key={c.chain} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-foreground">{c.chain}</h3>
                <span
                  className={
                    c.kind === "native"
                      ? "rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-primary"
                      : "rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                  }
                >
                  {c.kind === "native" ? "Native" : "Bridged from Base"}
                </span>
              </div>
              <a
                href={c.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-border/70 bg-background/60 px-4 py-3 transition-colors hover:border-primary/40"
              >
                <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Contract</span>
                <span className="mt-1 block break-all font-mono text-sm text-foreground">{c.address}</span>
                <span className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
                  View on explorer <ArrowUpRight className="h-3 w-3" />
                </span>
              </a>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Decimals</dt>
                  <dd className="font-mono text-foreground">{c.decimals}</dd>
                </div>
                {c.supply ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Supply</dt>
                    <dd className="font-mono text-foreground">{c.supply}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="text-sm leading-relaxed text-muted-foreground">{c.origin}</p>
            </li>
          ))}
        </ul>
      </ContentSection>

      <ContentSection title="What PERKOS is for">
        <p>
          PerkOS plans to make PERKOS useful through access and benefits inside its products. None
          of that is live yet.
        </p>
        <p>
          <strong className="text-foreground">You do not need PERKOS to use PerkOS.</strong> PerkOS is
          priced in USDC, and AI agents pay for PerkOS services in USDC over x402.
        </p>
        <p>PerkOS has no admin control over any of these contracts.</p>
      </ContentSection>

      <ContentSection title="How to verify a contract">
        <p>
          Compare the address in your wallet or on the explorer with this page, character by
          character. The market listing is on{" "}
          <a href={PERKOS_COINGECKO_URL} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4">
            CoinGecko
          </a>
          .
        </p>
        <div className="flex gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm">
            PerkOS never asks for your seed phrase or private key, and never sends you a contract in
            a direct message. Any other contract that uses the PerkOS name is not ours.
          </p>
        </div>
        <p className="text-sm">
          PERKOS is not an investment product, and PerkOS makes no promises about its price. More
          answers in the <Link href="/faq" className="text-foreground underline underline-offset-4">FAQ</Link>.
        </p>
      </ContentSection>
    </PublicPageShell>
  );
}
