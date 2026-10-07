import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Shield,
  Sparkles,
  Workflow,
} from "lucide-react";

/**
 * /arbitrum — Singapore / Arbitrum-facing company pitch surface.
 *
 * Dedicated page (not the SMB landing, not /investors token page).
 * Sells: EQLTY on Robinhood Chain (Arbitrum Orbit). Four agents recommend
 * stock-token decisions; the human approves; then they can buy.
 * PerkOS is the infrastructure underneath.
 *
 * Copy rules: English, no em dashes, no yield promises, no "first/only".
 */

export const metadata: Metadata = {
  title: "Arbitrum · EQLTY on Robinhood Chain — PerkOS",
  description:
    "PerkOS agent infrastructure powering EQLTY: verifiable stock-token decisions on Robinhood Chain (Arbitrum Orbit). Agents recommend. You approve. Then you can buy.",
  openGraph: {
    title: "EQLTY on Robinhood Chain (Arbitrum Orbit)",
    description:
      "Four agents. One verifiable decision. You approve every trade.",
    url: "https://perkos.xyz/arbitrum",
  },
};

const ROLES = [
  {
    name: "Scout",
    job: "Finds eligible stock tokens and gathers market evidence.",
  },
  {
    name: "Risk",
    job: "Checks policy, freshness, liquidity, and limits. Can veto.",
  },
  {
    name: "Trader",
    job: "Prepares the Uniswap v4 route. Only role with a spend rail.",
  },
  {
    name: "Auditor",
    job: "Reconciles the decision against on-chain evidence.",
  },
];

const QUARTERS = [
  {
    id: "Q1",
    when: "Q4 2026",
    title: "Make it usable without the founder",
    items: [
      "Conversational goals (ETH Global desk UX, not a hidden form)",
      "Vault and policy hardening on Robinhood Chain",
      "Turn on a controlled paid decision loop (x402)",
      "First cohort of external weekly users",
    ],
  },
  {
    id: "Q2",
    when: "Q1 2027",
    title: "Retention and a second desk",
    items: [
      "Users who return for decisions without hand-holding",
      "Second vertical on the same PerkOS rails",
      "Real Robinhood Chain / Arbitrum distribution partnerships",
    ],
  },
  {
    id: "Q3",
    when: "Q2 2027",
    title: "Prove the company",
    items: [
      "Small recurring revenue from decisions or infra",
      "First hire if the round funds it",
      "Seed-ready retention and unit metrics",
    ],
  },
];

const VAULT = {
  address: "0x033f13BC2CCB53dbfBEef7594668F9cfa4A70833",
  explorer:
    "https://robinhoodchain.blockscout.com/address/0x033f13BC2CCB53dbfBEef7594668F9cfa4A70833",
};

export default function ArbitrumPitchPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 md:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/perkos-header.png"
              alt="PerkOS"
              width={130}
              height={28}
              priority
            />
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs font-medium uppercase tracking-wider text-muted-foreground sm:inline">
              Arbitrum · Robinhood Chain
            </span>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 md:px-8 md:py-16">
        {/* Hero */}
        <section className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-pink-500">
            Company pitch · Pre-seed
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
            Agents that recommend stock tokens on Robinhood Chain.
            You approve. Then you can buy.
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            <strong className="font-medium text-foreground">EQLTY</strong> is
            the app.{" "}
            <strong className="font-medium text-foreground">PerkOS</strong> is
            the agent infrastructure underneath. Live on{" "}
            <strong className="font-medium text-foreground">
              Robinhood Chain
            </strong>{" "}
            (Arbitrum Orbit). Built through ETH Global; the product is a
            four-agent committee with on-chain limits, not a bot with a key.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="https://eqlty.perkos.xyz"
              className="inline-flex items-center gap-2 rounded-full bg-pink-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pink-500"
            >
              Open EQLTY
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="https://stack.perkos.xyz"
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              PerkOS Stack
            </Link>
          </div>
        </section>

        {/* What we sell */}
        <section className="mt-16 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6">
            <Sparkles className="mb-3 h-5 w-5 text-pink-500" />
            <h2 className="text-base font-semibold">Recommend</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You state a goal. Four agents compare candidates and argue with
              evidence. Risk can stop the cycle.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <Shield className="mb-3 h-5 w-5 text-pink-500" />
            <h2 className="text-base font-semibold">Approve</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Policy and spend limits live on-chain in EQLTYVault. Nothing
              moves without the human.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <Workflow className="mb-3 h-5 w-5 text-pink-500" />
            <h2 className="text-base font-semibold">Buy</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Optional Uniswap v4 execution on Robinhood Chain for stock
              tokens, settled in USDG when you say yes.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            The ETH Global version we ship
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Same story we proved in public builds: a committee with separate
            jobs, a veto path, and a vault that fails closed.
          </p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2">
            {ROLES.map((role, i) => (
              <li
                key={role.name}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <div className="flex items-baseline gap-3">
                  <span className="text-xs font-semibold text-pink-500">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-lg font-semibold">{role.name}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{role.job}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Why Arbitrum */}
        <section className="mt-16 rounded-2xl border border-border bg-card p-8">
          <h2 className="text-2xl font-semibold tracking-tight">
            Why Arbitrum / Robinhood Chain
          </h2>
          <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pink-500" />
              Robinhood Chain is an Arbitrum Orbit chain built for this RWA
              surface (stock tokens + USDG).
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pink-500" />
              EQLTYVault and Uniswap v4 rails are already deployed there. This
              is not a slide-only integration.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pink-500" />
              PerkOS Stack runs production agent payments (x402) so decisions
              can leave a receipt when we turn charging on.
            </li>
          </ul>
          <p className="mt-6 text-sm">
            Vault:{" "}
            <a
              href={VAULT.explorer}
              className="font-mono text-xs text-pink-500 underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {VAULT.address}
            </a>
          </p>
        </section>

        {/* Traction honesty */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            Stage (pre-seed honesty)
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border p-6">
              <h3 className="font-semibold">What is real</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>EQLTY live at eqlty.perkos.xyz</li>
                <li>Mainnet path on Robinhood Chain (vault + Uniswap v4)</li>
                <li>PerkOS agent runtimes and Stack facilitator in production</li>
                <li>Self-funded to date; no prior outside raise</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-border p-6">
              <h3 className="font-semibold">What we are not claiming</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Revenue is still zero on purpose (closed beta)</li>
                <li>No promised returns or trading alpha</li>
                <li>Traction is early; the machine comes before growth spend</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            Next three quarters
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Q1 starts Q4 2026 from the Singapore conversation. Adjust labels if
            you prefer calendar-year naming; the work is the same.
          </p>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {QUARTERS.map((q) => (
              <div
                key={q.id}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-pink-500">
                    {q.id}
                  </span>
                  <span className="text-xs text-muted-foreground">{q.when}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold">{q.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {q.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-pink-500">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Ask */}
        <section className="mt-16 rounded-2xl border border-pink-500/30 bg-card p-8">
          <h2 className="text-2xl font-semibold tracking-tight">The ask</h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Raising a <strong className="text-foreground">pre-seed</strong>{" "}
            round to fund Q1–Q3: product usability on Robinhood Chain,
            controlled monetization of verifiable decisions, and the first
            operating capacity beyond a solo founder.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Amount and SAFE terms: confirm with Julio before sharing externally.
            Use of funds prioritizes product and on-chain hardening over logo
            sponsorships.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="https://eqlty.perkos.xyz"
              className="inline-flex items-center gap-2 rounded-full bg-pink-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-pink-500"
            >
              See the product
            </Link>
            <Link
              href="https://github.com/PerkOS-xyz/PerkOS-EQLTY"
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted"
            >
              Public repo
            </Link>
          </div>
        </section>

        <p className="mt-12 text-center text-sm text-muted-foreground">
          Four agents. One verifiable decision. You approve every trade.
        </p>
      </main>
    </div>
  );
}
