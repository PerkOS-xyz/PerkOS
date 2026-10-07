"use client";

/**
 * /arbitrum — Singapore / Arbitrum pre-seed deck slides.
 * Fixed 1920×1080 canvas. No ETH Global mentions. English only, no em dashes.
 */

import Image from "next/image";
import { type ReactNode } from "react";
import {
  CheckCircle2,
  Shield,
  Sparkles,
  Workflow,
} from "lucide-react";

export const W = 1920;
export const H = 1080;

const BG = "#0D0D14";
const ELEV = "#17161F";
const BORDER = "#2A2935";
const FG = "#F5F4F8";
const LAV_T = "#B0ACD9";
const PINK_T = "#FF8AB4";
const PINK = "#EC1B69";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative box-border flex flex-col overflow-hidden"
      style={{ width: W, height: H, background: BG, color: FG, padding: 80 }}
    >
      {children}
    </div>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="h-[4px] w-14 rounded-full" style={{ background: PINK }} />
      <span
        className="text-[20px] font-semibold uppercase"
        style={{ color: PINK_T, letterSpacing: "0.08em" }}
      >
        {children}
      </span>
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-auto flex items-center justify-between pt-8">
      <Image src="/perkos-header.png" alt="PerkOS" width={140} height={30} />
      <span className="text-[18px]" style={{ color: LAV_T }}>
        perkos.xyz/arbitrum
      </span>
    </div>
  );
}

function SlideHero() {
  return (
    <Frame>
      <Kicker>Company pitch · Pre-seed</Kicker>
      <h1
        className="mt-10 max-w-[1500px] font-semibold tracking-tight"
        style={{ fontSize: 68, lineHeight: 1.08 }}
      >
        Agents that recommend stock tokens on Robinhood Chain.
        <br />
        You approve. Then you can buy.
      </h1>
      <p className="mt-8 max-w-[1200px] text-[28px]" style={{ color: LAV_T }}>
        <strong style={{ color: FG }}>EQLTY</strong> is the app.{" "}
        <strong style={{ color: FG }}>PerkOS</strong> is the agent
        infrastructure underneath. Live on{" "}
        <strong style={{ color: FG }}>Robinhood Chain</strong> (Arbitrum Orbit).
      </p>
      <Footer />
    </Frame>
  );
}

function SlideProblem() {
  return (
    <Frame>
      <Kicker>Problem</Kicker>
      <h2 className="mt-10 max-w-[1400px] text-[56px] font-semibold tracking-tight">
        AI trading tools either hide the risk or give the bot the keys.
      </h2>
      <div className="mt-14 grid grid-cols-2 gap-8">
        {[
          {
            t: "Black-box advice",
            d: "A chat answer with no policy, no limits, and no on-chain trail.",
          },
          {
            t: "Autonomous spend",
            d: "A bot with a wallet. Fine until one bad decision is irreversible.",
          },
          {
            t: "No human gate",
            d: "Most stacks optimize for speed. We optimize for an approve step.",
          },
          {
            t: "Hard to trust RWA rails",
            d: "Stock tokens need clear limits, evidence, and a fail-closed vault.",
          },
        ].map((c) => (
          <div
            key={c.t}
            className="rounded-3xl border p-8"
            style={{ borderColor: BORDER, background: ELEV }}
          >
            <h3 className="text-[32px] font-semibold">{c.t}</h3>
            <p className="mt-4 text-[24px]" style={{ color: LAV_T }}>
              {c.d}
            </p>
          </div>
        ))}
      </div>
      <Footer />
    </Frame>
  );
}

function SlideLoop() {
  return (
    <Frame>
      <Kicker>Product</Kicker>
      <h2 className="mt-8 text-[52px] font-semibold tracking-tight">
        Recommend → Approve → Buy
      </h2>
      <div className="mt-12 grid grid-cols-3 gap-8">
        {[
          {
            icon: Sparkles,
            t: "Recommend",
            d: "Four agents compare candidates and argue with evidence. Risk can stop the cycle.",
          },
          {
            icon: Shield,
            t: "Approve",
            d: "Policy and spend limits live on-chain in EQLTYVault. Nothing moves without the human.",
          },
          {
            icon: Workflow,
            t: "Buy",
            d: "Optional Uniswap v4 execution on Robinhood Chain for stock tokens, settled in USDG.",
          },
        ].map((c) => (
          <div
            key={c.t}
            className="rounded-3xl border p-10"
            style={{ borderColor: BORDER, background: ELEV }}
          >
            <c.icon className="h-12 w-12" style={{ color: PINK }} />
            <h3 className="mt-6 text-[36px] font-semibold">{c.t}</h3>
            <p className="mt-4 text-[24px]" style={{ color: LAV_T }}>
              {c.d}
            </p>
          </div>
        ))}
      </div>
      <Footer />
    </Frame>
  );
}

function SlideRoles() {
  const roles = [
    ["01", "Scout", "Finds eligible stock tokens and gathers market evidence."],
    ["02", "Risk", "Checks policy, freshness, liquidity, and limits. Can veto."],
    ["03", "Trader", "Prepares the Uniswap v4 route. Only role with a spend rail."],
    ["04", "Auditor", "Reconciles the decision against on-chain evidence."],
  ] as const;
  return (
    <Frame>
      <Kicker>Committee</Kicker>
      <h2 className="mt-8 text-[52px] font-semibold tracking-tight">
        Four roles. One verifiable decision.
      </h2>
      <div className="mt-12 grid grid-cols-2 gap-8">
        {roles.map(([n, name, job]) => (
          <div
            key={name}
            className="rounded-3xl border p-10"
            style={{ borderColor: BORDER, background: ELEV }}
          >
            <div className="flex items-baseline gap-4">
              <span className="text-[22px] font-semibold" style={{ color: PINK_T }}>
                {n}
              </span>
              <h3 className="text-[36px] font-semibold">{name}</h3>
            </div>
            <p className="mt-4 text-[24px]" style={{ color: LAV_T }}>
              {job}
            </p>
          </div>
        ))}
      </div>
      <Footer />
    </Frame>
  );
}

function SlideWhy() {
  return (
    <Frame>
      <Kicker>Why Arbitrum</Kicker>
      <h2 className="mt-8 max-w-[1400px] text-[52px] font-semibold tracking-tight">
        Built on Robinhood Chain because that is where the stock-token rails are.
      </h2>
      <ul className="mt-14 space-y-8">
        {[
          "Robinhood Chain is an Arbitrum Orbit chain for this RWA surface (stock tokens + USDG).",
          "EQLTYVault and Uniswap v4 rails are already deployed. Not a slide-only integration.",
          "PerkOS Stack runs production agent payments (x402) so decisions can leave a receipt when charging turns on.",
        ].map((line) => (
          <li key={line} className="flex items-start gap-5 text-[28px]">
            <CheckCircle2
              className="mt-1 h-9 w-9 shrink-0"
              style={{ color: PINK }}
            />
            <span style={{ color: LAV_T }}>{line}</span>
          </li>
        ))}
      </ul>
      <p className="mt-12 font-mono text-[20px]" style={{ color: PINK_T }}>
        Vault 0x033f13BC2CCB53dbfBEef7594668F9cfa4A70833
      </p>
      <Footer />
    </Frame>
  );
}

function SlideTraction() {
  const cards = [
    ["Live", "EQLTY on Robinhood Chain with vault + Uniswap v4 path"],
    ["4 roles", "Scout, Risk, Trader, Auditor in production desk flow"],
    ["Beta", "Small invite cohort · ~10 active wallets validating the loop"],
    ["Pre-seed", "Self-funded to date · raising ~$1.0–1.5M SAFE for Q1–Q3"],
  ] as const;
  return (
    <Frame>
      <Kicker>Where we are</Kicker>
      <h2 className="mt-8 text-[52px] font-semibold tracking-tight">
        Closed beta. Past vaporware.
      </h2>
      <p className="mt-6 max-w-[1200px] text-[26px]" style={{ color: LAV_T }}>
        We are not pretending to be at scale. The product runs on mainnet rails,
        with a small beta cohort and a clear path to paid decisions.
      </p>
      <div className="mt-12 grid grid-cols-4 gap-6">
        {cards.map(([t, d]) => (
          <div
            key={t}
            className="rounded-3xl border p-8"
            style={{ borderColor: BORDER, background: ELEV }}
          >
            <p className="text-[40px] font-semibold">{t}</p>
            <p className="mt-4 text-[22px]" style={{ color: LAV_T }}>
              {d}
            </p>
          </div>
        ))}
      </div>
      <Footer />
    </Frame>
  );
}

function SlideRoadmap() {
  const qs = [
    {
      id: "Q1",
      when: "Q4 2026",
      title: "Make it usable without the founder",
      items: [
        "Conversational goals for the desk UX",
        "Vault and policy hardening on Robinhood Chain",
        "Controlled paid decision loop (x402)",
        "First cohort of external weekly users",
      ],
    },
    {
      id: "Q2",
      when: "Q1 2027",
      title: "Retention and a second desk",
      items: [
        "Users who return without hand-holding",
        "Second vertical on the same PerkOS rails",
        "Robinhood Chain / Arbitrum distribution partnerships",
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
  return (
    <Frame>
      <Kicker>Roadmap</Kicker>
      <h2 className="mt-8 text-[52px] font-semibold tracking-tight">
        Next three quarters
      </h2>
      <div className="mt-12 grid grid-cols-3 gap-8">
        {qs.map((q) => (
          <div
            key={q.id}
            className="rounded-3xl border p-8"
            style={{ borderColor: BORDER, background: ELEV }}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[24px] font-semibold" style={{ color: PINK_T }}>
                {q.id}
              </span>
              <span className="text-[18px]" style={{ color: LAV_T }}>
                {q.when}
              </span>
            </div>
            <h3 className="mt-5 text-[28px] font-semibold">{q.title}</h3>
            <ul className="mt-6 space-y-3">
              {q.items.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-[20px]"
                  style={{ color: LAV_T }}
                >
                  <span style={{ color: PINK }}>·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Footer />
    </Frame>
  );
}

function SlideAsk() {
  return (
    <Frame>
      <Kicker>The ask</Kicker>
      <h2 className="mt-10 max-w-[1400px] text-[56px] font-semibold tracking-tight">
        Raising a pre-seed of about $1.0–1.5M on a SAFE.
      </h2>
      <p className="mt-8 max-w-[1200px] text-[28px]" style={{ color: LAV_T }}>
        Funds Q1–Q3: product usability on Robinhood Chain, controlled
        monetization of verifiable decisions, and the first operating capacity
        beyond a solo founder. Product and on-chain hardening first.
      </p>
      <div className="mt-14 grid grid-cols-3 gap-8">
        {[
          "Ship desk UX outsiders can run",
          "Turn on paid decisions carefully",
          "Prove retention before a seed raise",
        ].map((t) => (
          <div
            key={t}
            className="rounded-3xl border p-8 text-[26px] font-semibold"
            style={{ borderColor: BORDER, background: ELEV }}
          >
            {t}
          </div>
        ))}
      </div>
      <Footer />
    </Frame>
  );
}

function SlideClose() {
  return (
    <Frame>
      <Kicker>Close</Kicker>
      <h2 className="mt-16 max-w-[1500px] text-[64px] font-semibold tracking-tight">
        Four agents. One verifiable decision.
        <br />
        You approve every trade.
      </h2>
      <p className="mt-10 text-[30px]" style={{ color: LAV_T }}>
        eqlty.perkos.xyz · stack.perkos.xyz · perkos.xyz/arbitrum
      </p>
      <Footer />
    </Frame>
  );
}

type ArbitrumSlide = {
  hash: string;
  title: string;
  budgetSeconds: number;
  notes: string;
  Component: () => ReactNode;
};

export const ARBITRUM_SLIDES: ArbitrumSlide[] = [
  {
    hash: "hero",
    title: "Recommend · Approve · Buy",
    budgetSeconds: 45,
    notes:
      "Open with the product sentence. EQLTY is the app, PerkOS is infra, Robinhood Chain is the rail. Do not digress into other products.",
    Component: SlideHero,
  },
  {
    hash: "problem",
    title: "Problem",
    budgetSeconds: 60,
    notes:
      "Contrast black-box advice and bots with keys. Our wedge is the human approve gate plus on-chain limits.",
    Component: SlideProblem,
  },
  {
    hash: "loop",
    title: "Product loop",
    budgetSeconds: 60,
    notes:
      "Walk Recommend → Approve → Buy once. Emphasize that buy is optional and gated.",
    Component: SlideLoop,
  },
  {
    hash: "roles",
    title: "Four roles",
    budgetSeconds: 60,
    notes:
      "Scout finds, Risk vetoes, Trader is the only spend role, Auditor reconciles. Mention fail-closed vault.",
    Component: SlideRoles,
  },
  {
    hash: "why-arbitrum",
    title: "Why Robinhood Chain",
    budgetSeconds: 45,
    notes:
      "Orbit chain for stock tokens + USDG. Vault and Uniswap v4 already live. Point to explorer if asked.",
    Component: SlideWhy,
  },
  {
    hash: "traction",
    title: "Closed beta",
    budgetSeconds: 45,
    notes:
      "Honest: ~10 active wallets, not mass scale. Live product and four roles. Self-funded so far.",
    Component: SlideTraction,
  },
  {
    hash: "roadmap",
    title: "Q1 · Q2 · Q3",
    budgetSeconds: 75,
    notes:
      "Q1 = Q4 2026 usability + paid loop. Q2 retention + second desk. Q3 prove company metrics.",
    Component: SlideRoadmap,
  },
  {
    hash: "ask",
    title: "Pre-seed ask",
    budgetSeconds: 60,
    notes:
      "Ask ~$1.0–1.5M SAFE for Q1–Q3. Use of funds: product and hardening, not logo spend.",
    Component: SlideAsk,
  },
  {
    hash: "close",
    title: "Close",
    budgetSeconds: 30,
    notes:
      "Leave them with the line: four agents, one verifiable decision, human approve every trade. Offer EQLTY demo.",
    Component: SlideClose,
  },
];
