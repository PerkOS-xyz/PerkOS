import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  BarChart3,
  Coins,
  CreditCard,
  Shield,
  TrendingUp,
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

const TOKEN_BENEFITS = [
  { Icon: CreditCard, title: "15–25% off with $PERKOS", copy: "Pay for Growth and Custom plans with $PERKOS and save versus card — usage flows back to the token." },
  { Icon: Shield, title: "Stake for perks", copy: "Stake $PERKOS for permanent discounts, priority support, and early access to new capabilities." },
  { Icon: TrendingUp, title: "Aligned with growth", copy: "Stakers are positioned for revenue share in selected cases as the platform scales." },
  { Icon: Zap, title: "Powers the platform", copy: "Teammates settle usage in instant micropayments on Base — the same rail that makes idle cost near-zero." },
];

const TOKEN_CONTRACTS = [
  {
    chain: "Base",
    ca: "0xF714E60f85497D70508F7E356b5DB80e64539BA3",
    buy: "https://app.uniswap.org/explore/tokens/base/0xf714e60f85497d70508f7e356b5db80e64539ba3",
  },
  {
    chain: "Celo",
    ca: "0xb7Ba43fBD4F2E85FCE929f7d4DFE3905Ae846A46",
    buy: "https://app.uniswap.org/explore/tokens/celo/0xb7ba43fbd4f2e85fce929f7d4dfe3905ae846a46",
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

            {/* Token utility */}
            <div className="mb-6 flex flex-col items-center gap-2 text-center">
              <h2 className="text-xl font-semibold text-foreground">$PERKOS — pay, stake, and grow with the platform</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                The token aligns PerkOS with the businesses running on it: pay with
                $PERKOS to save, stake to unlock perks, and share in the upside as
                the platform scales.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
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
              Get <b className="text-foreground">$PERKOS</b> on Uniswap — settles on{" "}
              <b className="text-foreground">Base</b> and{" "}
              <b className="text-foreground">Celo</b> via USDC, low-fee and instant.
            </p>
            <div className="mx-auto mt-4 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
              {TOKEN_CONTRACTS.map(({ chain, ca, buy }) => (
                <div key={chain} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                  <a
                    href={buy}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <Coins className="h-4 w-4" />
                    Buy $PERKOS on {chain} ↗
                  </a>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">CA</span>
                    <span className="break-all font-mono text-[11px] text-muted-foreground">{ca}</span>
                  </span>
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
              and volume. $PERKOS is a utility token; nothing here is financial
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
