import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

import { ContentSection, PublicPageShell } from "../components/marketing/PublicPageShell";
import {
  PERKOS_COINGECKO_URL,
  PERKOS_CONTRACTS,
  PERKOS_TOKEN_SUMMARY,
} from "../lib/perkosToken";
import { publicPageMetadata } from "../lib/publicPageMetadata";
import { CopyAddress } from "./CopyAddress";

// ============================================================================
// /tokens: the one page that says which PERKOS contracts are ours. /token
// redirects here (next.config.ts) so links already shared keep working.
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
    "The official PERKOS token contracts on Solana, Base, Robinhood Chain and Celo, how to verify them, and what PERKOS is for in PerkOS.",
  path: "/tokens",
});

export default function TokenPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${SITE}/tokens#page`,
        url: `${SITE}/tokens`,
        name: "PERKOS token: official contracts",
        about: { "@id": `${SITE}/tokens#perkos` },
        publisher: { "@id": `${SITE}/#org` },
      },
      {
        "@type": "Thing",
        "@id": `${SITE}/tokens#perkos`,
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
      intro="PERKOS is the community token of PerkOS (perkos.xyz), the platform where small businesses get a team of AI agents that works with them. These are the only official PERKOS contracts. Check any address against this page before you use it."
      ctaId="token"
      breadcrumbs={[{ name: "Home", path: "/" }, { name: "Tokens", path: "/tokens" }]}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <ContentSection title="Contracts">
        <p>
          Three launches and one bridge. PERKOS was launched on Solana, Base and Robinhood Chain as
          separate tokens, each with its own contract, market and price. The Base token also lives on
          Celo through the Wormhole token bridge: same token, different address.
        </p>
        <ul className="grid gap-4 md:grid-cols-2">
          {PERKOS_CONTRACTS.map((c) => (
            <li key={c.chain} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                    style={c.logo.tile ? { backgroundColor: c.logo.tile } : undefined}
                  >
                    <Image
                      src={c.logo.src}
                      alt={`${c.chain} logo`}
                      width={32}
                      height={32}
                      className={c.logo.tile ? "h-5 w-5 object-contain" : "h-8 w-8 object-contain"}
                    />
                  </span>
                  <h3 className="text-lg font-semibold text-foreground">{c.chain}</h3>
                </div>
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
              <div className="rounded-xl border border-border/70 bg-background/60 px-4 py-3">
                <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Contract</span>
                <span className="mt-1 block select-all break-all font-mono text-sm text-foreground">{c.address}</span>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <CopyAddress address={c.address} chain={c.chain} />
                  <a
                    href={c.explorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    View on {c.explorerName} <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
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
              {c.note ? <p className="text-sm text-foreground">{c.note}</p> : null}
              <p className="text-sm leading-relaxed text-muted-foreground">{c.origin}</p>
            </li>
          ))}
        </ul>
      </ContentSection>

      <ContentSection title="What PERKOS is for">
        <p>
          PERKOS is the community token around PerkOS. Access and benefits inside PerkOS products
          are on the way.
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
