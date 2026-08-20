import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  BarChart3,
  Coins,
  CreditCard,
  Shield,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

// ============================================================================
// /investors — ROI proof + the $PERKOS token (investment vehicle + in-app
// utility). Moved off the main landing so the SMB-facing page stays free of
// crypto/investment signals (which also kept it out of content-filter
// "Cryptocurrency" categorization). This is the self-selecting page for the
// secondary audience: investors and $PERKOS holders.
// ============================================================================

export const metadata: Metadata = {
  title: "Investors & $PERKOS — PerkOS",
  description:
    "The economics behind PerkOS: ROI from AI teammates for small businesses, plus the $PERKOS token that lets the community pay, stake, and share in the platform's growth.",
};

const ROI_METRICS = [
  { value: "68%", label: "Less time on repetitive work" },
  { value: "5×", label: "More output per person" },
  { value: "24/7", label: "Coverage, zero added headcount" },
  { value: "~$0.02", label: "Cost of an idle teammate / month" },
];

// Planned utility is labelled as planned. None of the token mechanics below
// are built yet: the credits contract has no operators wired and the claim
// vault's rewardToken is still deferred. Describing intent as if it shipped is
// how a utility token starts reading like a promise of return.
const TOKEN_BENEFITS = [
  { Icon: CreditCard, title: "Planned: pay with $PERKOS", copy: "We intend to let plans be paid in $PERKOS at a discount versus card. Not built yet." },
  { Icon: Shield, title: "Planned: hold for perks", copy: "We intend to offer priority support and early access to capabilities for holders. Not built yet." },
  { Icon: Zap, title: "Live: payments on Base", copy: "Teammates settle usage in USDC micropayments on Base, through the x402 facilitator we operate. This part is running today." },
];

// Contract address for reference, linked to the explorer rather than to a DEX.
// Pointing a Buy button at Uniswap from our own site is distribution, whoever
// deployed the token. Anyone who wants to trade it can, without us routing them.
const TOKEN_CONTRACTS = [
  {
    chain: "Base",
    ca: "0xF714E60f85497D70508F7E356b5DB80e64539BA3",
    explorer: "https://basescan.org/token/0xF714E60f85497D70508F7E356b5DB80e64539BA3",
  },
];

export default function InvestorsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/perkos-header.png" alt="PerkOS" width={130} height={28} priority />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to PerkOS
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <div className="mb-10 flex flex-col items-center gap-3 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <Coins className="h-3.5 w-3.5" />
                For investors & $PERKOS holders
              </span>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                A real market, real economics, and a token to own it.
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground">
                58–76% of small businesses now use AI, but only 14% have it truly
                working and 73% want help getting there. PerkOS turns that gap into
                recurring revenue — and $PERKOS lets the community own a piece of it.
              </p>
            </div>

            {/* ROI proof */}
            <dl className="mb-12 grid grid-cols-2 gap-y-8 rounded-xl border border-border bg-card/60 py-10 md:grid-cols-4 md:gap-0">
              {ROI_METRICS.map((m, i) => (
                <div
                  key={m.label}
                  className={cn(
                    "flex flex-col items-center gap-1 px-4 text-center",
                    i < ROI_METRICS.length - 1 && "md:border-r md:border-border",
                  )}
                >
                  <dd className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">{m.value}</dd>
                  <dt className="text-xs text-muted-foreground md:text-sm">{m.label}</dt>
                </div>
              ))}
            </dl>

            {/* Token utility. Leads with provenance: the community launched it, we
                did not. Said first, it frames everything below as us acknowledging
                our community's token rather than a company selling one. */}
            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <h2 className="text-xl font-semibold text-foreground">$PERKOS, a community token</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                <b className="text-foreground">$PERKOS was launched by the community on Base through Bankr.</b>{" "}
                PerkOS did not issue it, has never sold it, and does not control the
                contract. The platform itself runs on USDC: billing settles in USDC and
                the claim vault pays providers in USDC.
              </p>
              <p className="max-w-2xl text-sm text-muted-foreground">
                What follows is how we intend to make the token useful to the people who
                already hold it. Nothing here is an offer, and none of it is required to
                use PerkOS.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
              {TOKEN_BENEFITS.map(({ Icon, title, copy }) => (
                <div key={title} className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="text-base font-medium text-foreground">{title}</h3>
                  <p className="text-sm text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Contract address, for reference.
            </p>
            <div className="mx-auto mt-4 grid max-w-xl grid-cols-1 gap-3">
              {TOKEN_CONTRACTS.map(({ chain, ca, explorer }) => (
                <div key={chain} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Coins className="h-4 w-4 text-primary" />
                    $PERKOS on {chain}
                  </span>
                  <a
                    href={explorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">CA</span>
                    <span className="break-all font-mono text-[11px] text-muted-foreground">{ca}</span>
                  </a>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <a
                href="mailto:invest@perkos.xyz"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
              >
                <BarChart3 className="h-4 w-4" />
                Investor inquiries & the deck
              </a>
            </div>
            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              ROI figures are early pilot results — your numbers vary by business
              and volume. $PERKOS is a community-launched token that PerkOS did not
              issue and does not control. Planned utility is not a commitment and may
              change. Nothing here is an offer to sell, a solicitation, or financial
              advice.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card/40 py-10">
        <div className="mx-auto max-w-7xl px-4 text-sm text-muted-foreground md:px-8">
          <Link href="/" className="transition-colors hover:text-foreground">
            ← PerkOS — AI teams for small businesses
          </Link>
          <p className="mt-3 text-xs">© {new Date().getFullYear()} PerkOS.</p>
        </div>
      </footer>
    </div>
  );
}
