import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Coins,
  Shield,
  Zap,
} from "lucide-react";

import { PERKOS_TOKEN_SUMMARY } from "../lib/perkosToken";

// ============================================================================
// /investors: the market PerkOS serves, and the PERKOS token for the people who
// already hold it. Moved off the main landing so the SMB-facing page stays free
// of crypto signals.
//
// The token is described by what it is and where it stands, never as a way to
// own or share in PerkOS: no stake, rewards, revenue, earn or yield. The
// contracts and their provenance live on /token, the one source, so this page
// cannot drift from it again (it once said the community launched every chain,
// which is true only for Base).
// ============================================================================

export const metadata: Metadata = {
  title: "Investors and the PERKOS token | PerkOS",
  description:
    "The small-business market PerkOS serves, and the PERKOS community token: where it was launched and why PerkOS does not require it.",
};

// Planned utility is labelled as planned. None of the token mechanics below
// are built yet: the credits contract has no operators wired and the claim
// vault's rewardToken is still deferred. Describing intent as if it shipped is
// how a utility token starts reading like a promise of return. Paying plans in
// $PERKOS is no longer the direction, so it is not listed: the utility we are
// building sits in access to the product, and the mechanism is still being
// decided, which is why none of it is described here as a commitment.
const TOKEN_BENEFITS = [
  { Icon: Shield, title: "Planned: access for holders", copy: "We intend to unlock access to premium PerkOS services for holders. Not built yet." },
  { Icon: Coins, title: "Planned: benefits inside the product", copy: "We intend holder benefits to live inside PerkOS itself rather than around it. Not built yet." },
  { Icon: Zap, title: "Live: payments in USDC", copy: "AI agents pay for PerkOS services in USDC over x402, on Base and Celo. This part is running today." },
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
            <div className="mb-12 flex flex-col items-center gap-3 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <Coins className="h-3.5 w-3.5" />
                For investors and PERKOS holders
              </span>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                AI teams for the businesses that have no engineers.
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground">
                58–76% of small businesses now use AI, but only 14% have it truly
                working and 73% want help getting there. PerkOS gives them a team of AI
                agents that plans the work, drafts it, and waits for the owner to
                approve.
              </p>
            </div>

            <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <h2 className="text-xl font-semibold text-foreground">PERKOS, a community token</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">{PERKOS_TOKEN_SUMMARY}</p>
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

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/token"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
              >
                Official contracts and how to verify them <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="mailto:invest@perkos.xyz"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
              >
                <BarChart3 className="h-4 w-4" />
                Investor inquiries and the deck
              </a>
            </div>
            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              PerkOS has no admin control over the PERKOS contracts. Planned utility is
              not a commitment and may change. PERKOS is not an investment product, and
              nothing here is an offer to sell, a solicitation, or financial advice.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card/40 py-10">
        <div className="mx-auto max-w-7xl px-4 text-sm text-muted-foreground md:px-8">
          <Link href="/" className="transition-colors hover:text-foreground">
            ← PerkOS: AI teams for small businesses
          </Link>
          <p className="mt-3 text-xs">© {new Date().getFullYear()} PerkOS.</p>
        </div>
      </footer>
    </div>
  );
}
