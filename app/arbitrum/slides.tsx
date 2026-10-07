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

const BG = "#070A08";
const ELEV = "#0E1511";
const BORDER = "#1E2B23";
const FG = "#F5F4F8";
const MUTED = "#8E9A92";
const ACCENT_T = "#7CF0A2";
const ACCENT = "#7CF0A2";
// EQLTY palette (eqlty.perkos.xyz): dark green field with soft glows.
const GLOW =
  "radial-gradient(circle at 82% 16%, rgba(57, 145, 82, 0.13), transparent 28%), radial-gradient(circle at 8% 92%, rgba(196, 255, 42, 0.05), transparent 30%)";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative box-border flex flex-col overflow-hidden"
      style={{ width: W, height: H, background: `${GLOW}, ${BG}`, color: FG, padding: 80 }}
    >
      {children}
    </div>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="h-[4px] w-14 rounded-full" style={{ background: ACCENT }} />
      <span
        className="text-[20px] font-semibold uppercase"
        style={{ color: ACCENT_T, letterSpacing: "0.08em" }}
      >
        {children}
      </span>
    </div>
  );
}

function EqltyMark({ size, wordmark }: { size: number; wordmark: number }) {
  return (
    <div className="flex items-center gap-4">
      <Image src="/eqlty-logo-mark.png" alt="EQLTY" width={size} height={size} />
      <span
        className="font-semibold tracking-tight"
        style={{ fontSize: wordmark, color: FG }}
      >
        EQLTY
      </span>
    </div>
  );
}

/** Chain shown as a labelled pill, the way eqlty.perkos.xyz shows it. */
function ChainPill() {
  return (
    <span
      className="inline-flex items-center gap-3 rounded-full border px-5 py-2 font-mono text-[18px] uppercase"
      style={{ borderColor: "rgba(124, 240, 162, 0.35)", color: ACCENT, letterSpacing: "0.08em" }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} />
      Robinhood Chain
    </span>
  );
}

function Footer() {
  return (
    <div className="mt-auto flex items-center justify-between pt-8">
      <div className="flex items-center gap-6">
        <EqltyMark size={36} wordmark={22} />
        <span className="text-[16px]" style={{ color: MUTED }}>
          powered by
        </span>
        <Image src="/perkos-header.png" alt="PerkOS" width={120} height={26} />
      </div>
      <span className="text-[18px]" style={{ color: MUTED }}>
        perkos.xyz/arbitrum
      </span>
    </div>
  );
}

function SlideHero() {
  return (
    <Frame>
      <div className="mb-14 flex items-center justify-between">
        <EqltyMark size={88} wordmark={44} />
        <ChainPill />
      </div>
      <Kicker>Company pitch · Pre-seed</Kicker>
      <h1
        className="mt-10 max-w-[1500px] font-semibold tracking-tight"
        style={{ fontSize: 68, lineHeight: 1.08 }}
      >
        Agents that recommend stock tokens on Robinhood Chain.
        <br />
        You approve. Then you can buy.
      </h1>
      <p className="mt-8 max-w-[1200px] text-[28px]" style={{ color: MUTED }}>
        <strong style={{ color: FG }}>EQLTY</strong> is the app.{" "}
        <strong style={{ color: FG }}>PerkOS</strong> is the agent
        infrastructure underneath. Live on{" "}
        <strong style={{ color: FG }}>Robinhood Chain</strong> (Arbitrum Orbit).
      </p>
      <Footer />
    </Frame>
  );
}

function SlideAudience() {
  return (
    <Frame>
      <Kicker>Who it is for</Kicker>
      <h2 className="mt-10 max-w-[1500px] text-[56px] font-semibold tracking-tight">
        Crypto-native investors who want stock exposure guided by a clear goal.
      </h2>
      <div className="mt-14 grid grid-cols-3 gap-8">
        {[
          {
            t: "Already on-chain",
            d: "Uses a wallet and holds stablecoins. Wants exposure to companies like NVDA or AMZN in eligible regions.",
          },
          {
            t: "Thinks in goals",
            d: "Starts from an outcome, like tech exposure with a monthly budget, and wants the plan in plain words.",
          },
          {
            t: "Keeps control",
            d: "Holds custody, sets limits once, and approves every trade.",
          },
        ].map((c) => (
          <div
            key={c.t}
            className="rounded-3xl border p-10"
            style={{ borderColor: BORDER, background: ELEV }}
          >
            <h3 className="text-[34px] font-semibold">{c.t}</h3>
            <p className="mt-4 text-[24px]" style={{ color: MUTED }}>
              {c.d}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-12 text-[24px]" style={{ color: MUTED }}>
        <strong style={{ color: ACCENT }}>First cohort:</strong> crypto-native
        retail on Robinhood Chain. <strong style={{ color: ACCENT }}>Next:</strong>{" "}
        people with a savings goal who want to start investing.
      </p>
      <Footer />
    </Frame>
  );
}

function SlideProblem() {
  return (
    <Frame>
      <Kicker>Their pain</Kicker>
      <h2 className="mt-10 max-w-[1500px] text-[56px] font-semibold tracking-tight">
        &ldquo;I want stocks from my wallet. Today that means becoming a trader
        or trusting a bot.&rdquo;
      </h2>
      <div className="mt-14 grid grid-cols-2 gap-8">
        {[
          {
            t: "Too many steps",
            d: "Pools, slippage, routes and signatures before a single buy.",
          },
          {
            t: "Advice without proof",
            d: "AI chats answer fast, with no sources, limits or record.",
          },
          {
            t: "Bots with the keys",
            d: "Automation that spends on its own, where one bad call is final.",
          },
          {
            t: "Hard to check",
            d: "No easy way to confirm a decision respected my rules before money moves.",
          },
        ].map((c) => (
          <div
            key={c.t}
            className="rounded-3xl border p-8"
            style={{ borderColor: BORDER, background: ELEV }}
          >
            <h3 className="text-[32px] font-semibold">{c.t}</h3>
            <p className="mt-4 text-[24px]" style={{ color: MUTED }}>
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
            <c.icon className="h-12 w-12" style={{ color: ACCENT }} />
            <h3 className="mt-6 text-[36px] font-semibold">{c.t}</h3>
            <p className="mt-4 text-[24px]" style={{ color: MUTED }}>
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
              <span className="text-[22px] font-semibold" style={{ color: ACCENT_T }}>
                {n}
              </span>
              <h3 className="text-[36px] font-semibold">{name}</h3>
            </div>
            <p className="mt-4 text-[24px]" style={{ color: MUTED }}>
              {job}
            </p>
          </div>
        ))}
      </div>
      <Footer />
    </Frame>
  );
}

function SlideEdge() {
  const rows = [
    ["Robinhood", "Catalog and execution", "A portable decision you can audit outside one platform."],
    ["Uniswap", "Liquidity and routes", "Policy, a veto and a receipt before the swap."],
    ["Social buy apps", "Speed and signals", "Deliberation, evidence and discipline."],
    ["Trading bots", "Automation", "Human approval, on-chain limits, reasoning you can verify."],
  ] as const;
  return (
    <Frame>
      <Kicker>What sets us apart</Kicker>
      <h2 className="mt-8 max-w-[1500px] text-[52px] font-semibold tracking-tight">
        The decision layer between asking and executing.
      </h2>
      <div
        className="mt-12 overflow-hidden rounded-3xl border"
        style={{ borderColor: BORDER, background: ELEV }}
      >
        <div
          className="grid grid-cols-[300px_340px_1fr] gap-8 px-10 py-5 text-[18px] uppercase"
          style={{ color: MUTED, letterSpacing: "0.08em", borderBottom: `1px solid ${BORDER}` }}
        >
          <span>Alternative</span>
          <span>Optimizes for</span>
          <span style={{ color: ACCENT_T }}>EQLTY adds</span>
        </div>
        {rows.map(([who, focus, ours], i) => (
          <div
            key={who}
            className="grid grid-cols-[300px_340px_1fr] items-center gap-8 px-10 py-6 text-[26px]"
            style={i < rows.length - 1 ? { borderBottom: `1px solid ${BORDER}` } : undefined}
          >
            <span className="font-semibold">{who}</span>
            <span style={{ color: MUTED }}>{focus}</span>
            <span>{ours}</span>
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
      <div className="flex items-center justify-between">
        <Kicker>Why Arbitrum</Kicker>
        <ChainPill />
      </div>
      <h2 className="mt-8 max-w-[1400px] text-[52px] font-semibold tracking-tight">
        Built on Robinhood Chain because that is where the stock-token rails are.
      </h2>
      <ul className="mt-14 space-y-8">
        {[
          "Robinhood Chain is an Arbitrum Orbit chain for this RWA surface (stock tokens + USDG).",
          "EQLTYVault and Uniswap v4 rails are already deployed and verifiable on the explorer.",
          "PerkOS Stack runs production agent payments (x402) so decisions can leave a receipt when charging turns on.",
        ].map((line) => (
          <li key={line} className="flex items-start gap-5 text-[28px]">
            <CheckCircle2
              className="mt-1 h-9 w-9 shrink-0"
              style={{ color: ACCENT }}
            />
            <span style={{ color: MUTED }}>{line}</span>
          </li>
        ))}
      </ul>
      <p className="mt-12 font-mono text-[20px]" style={{ color: ACCENT_T }}>
        Vault 0x033f13BC2CCB53dbfBEef7594668F9cfa4A70833
      </p>
      <p className="mt-3 font-mono text-[20px]" style={{ color: MUTED }}>
        Live buy: 1 USDG → AMZN through the vault ·{" "}
        <a
          href="https://robinhoodchain.blockscout.com/tx/0xce325f28bc900d0a2801f7ace3e307db8da402fb3d162627c06726b45b4e7def"
          target="_blank"
          rel="noreferrer"
          style={{ color: ACCENT_T }}
        >
          tx 0xce32…7def
        </a>
      </p>
      <Footer />
    </Frame>
  );
}

function SlideDifferentiation() {
  return (
    <Frame>
      <Kicker>What differentiates us</Kicker>
      <h2 className="mt-8 max-w-[1500px] text-[52px] font-semibold tracking-tight">
        Not another trading bot. A committee with an on-chain gate.
      </h2>
      <div className="mt-12 grid grid-cols-2 gap-8">
        {[
          {
            t: "Human approve is load-bearing",
            d: "Recommendations can be strong. Spend still waits for the user. Speed is secondary to control.",
          },
          {
            t: "Fail-closed vault",
            d: "Policy and limits live in EQLTYVault. No silent spend path if Risk or the human says no.",
          },
          {
            t: "Separated roles",
            d: "Scout, Risk, Trader, Auditor. Only Trader touches the spend rail. Evidence is part of the loop.",
          },
          {
            t: "Rails already live",
            d: "Robinhood Chain + Uniswap v4 + USDG path deployed. Differentiation is product architecture, not a pitch deck claim.",
          },
        ].map((c) => (
          <div
            key={c.t}
            className="rounded-3xl border p-8"
            style={{ borderColor: BORDER, background: ELEV }}
          >
            <h3 className="text-[30px] font-semibold">{c.t}</h3>
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

function SlideAudience() {
  return (
    <Frame>
      <Kicker>Target audience</Kicker>
      <h2 className="mt-8 max-w-[1500px] text-[52px] font-semibold tracking-tight">
        Crypto-native users who want stock tokens without giving a bot the keys.
      </h2>
      <div className="mt-12 grid grid-cols-3 gap-8">
        {[
          {
            t: "Primary",
            d: "Retail and power users on Robinhood Chain who already buy or explore stock tokens and want AI help with a hard approve step.",
          },
          {
            t: "Not for",
            d: "People who want fully autonomous trading, yield promises, or black-box tips with no policy trail.",
          },
          {
            t: "Secondary",
            d: "Small desks and operators who need the same committee + vault pattern for controlled decisions.",
          },
        ].map((c) => (
          <div
            key={c.t}
            className="rounded-3xl border p-8"
            style={{ borderColor: BORDER, background: ELEV }}
          >
            <h3 className="text-[28px] font-semibold" style={{ color: PINK_T }}>
              {c.t}
            </h3>
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

function SlideTraction() {
  const cards = [
    ["Live", "EQLTY on Robinhood Chain with vault + Uniswap v4 path"],
    ["4 roles", "Scout, Risk, Trader, Auditor in production desk flow"],
    ["Beta", "Small invite cohort · ~10 active wallets validating the loop"],
    ["Pre-seed", "Self-funded to date · raising ~$1.0–1.5M SAFE for the next three quarters"],
  ] as const;
  return (
    <Frame>
      <Kicker>Where we are</Kicker>
      <h2 className="mt-8 text-[52px] font-semibold tracking-tight">
        Closed beta, live on mainnet rails.
      </h2>
      <p className="mt-6 max-w-[1200px] text-[26px]" style={{ color: MUTED }}>
        We start with a small invite cohort and a clear path to paid decisions.
      </p>
      <div className="mt-12 grid grid-cols-4 gap-6">
        {cards.map(([t, d]) => (
          <div
            key={t}
            className="rounded-3xl border p-8"
            style={{ borderColor: BORDER, background: ELEV }}
          >
            <p className="text-[40px] font-semibold">{t}</p>
            <p className="mt-4 text-[22px]" style={{ color: MUTED }}>
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
              <span className="text-[24px] font-semibold" style={{ color: ACCENT_T }}>
                {q.when}
              </span>
            </div>
            <h3 className="mt-5 text-[28px] font-semibold">{q.title}</h3>
            <ul className="mt-6 space-y-3">
              {q.items.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-[20px]"
                  style={{ color: MUTED }}
                >
                  <span style={{ color: ACCENT }}>·</span>
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
      <p className="mt-8 max-w-[1200px] text-[28px]" style={{ color: MUTED }}>
        Funds the next three quarters: product usability on Robinhood Chain, controlled
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
      <p className="mt-10 text-[30px]" style={{ color: MUTED }}>
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
    budgetSeconds: 40,
    notes:
      "Open with the product sentence. EQLTY is the app, PerkOS is infra, Robinhood Chain is the rail. Do not digress into other products.",
    Component: SlideHero,
  },
  {
    hash: "user",
    title: "Who it is for",
    budgetSeconds: 45,
    notes:
      "Start from the user. Crypto-native investor, already holds stablecoins, wants stock exposure from a goal and keeps custody. First cohort on Robinhood Chain.",
    Component: SlideAudience,
  },
  {
    hash: "problem",
    title: "Their pain",
    budgetSeconds: 45,
    notes:
      "Read the quote in their voice. Too many steps, advice without proof, bots with keys, nothing to check before money moves.",
    Component: SlideProblem,
  },
  {
    hash: "loop",
    title: "Product loop",
    budgetSeconds: 50,
    notes:
      "Walk Recommend → Approve → Buy once. Emphasize that buy is optional and gated.",
    Component: SlideLoop,
  },
  {
    hash: "roles",
    title: "Four roles",
    budgetSeconds: 45,
    notes:
      "Scout finds, Risk vetoes, Trader is the only spend role, Auditor reconciles. Mention fail-closed vault.",
    Component: SlideRoles,
  },
  {
    hash: "edge",
    title: "What sets us apart",
    budgetSeconds: 50,
    notes:
      "Robinhood and Uniswap solve access and execution. We add the decision layer before money moves: policy, veto, evidence and a receipt.",
    Component: SlideEdge,
  },
  {
    hash: "why-arbitrum",
    title: "Why Robinhood Chain",
    budgetSeconds: 40,
    notes:
      "Orbit chain for stock tokens + USDG. Vault and Uniswap v4 already live. Show the AMZN buy on the explorer.",
    Component: SlideWhy,
  },
  {
    hash: "differentiation",
    title: "What differentiates us",
    budgetSeconds: 60,
    notes:
      "Contrast vs trading bots: human approve, fail-closed vault, separated roles, live rails. Do not claim first/only.",
    Component: SlideDifferentiation,
  },
  {
    hash: "audience",
    title: "Target audience",
    budgetSeconds: 45,
    notes:
      "Primary: crypto-native users who want stock tokens with a hard approve gate. Not autonomous traders. Desks are secondary.",
    Component: SlideAudience,
  },
  {
    hash: "traction",
    title: "Closed beta",
    budgetSeconds: 35,
    notes:
      "Small, deliberate cohort of ~10 active wallets. Live product and four roles. Self-funded so far.",
    Component: SlideTraction,
  },
  {
    hash: "roadmap",
    title: "Next three quarters",
    budgetSeconds: 60,
    notes:
      "Q4 2026 usability + paid loop. Q1 2027 retention + second desk. Q2 2027 prove company metrics.",
    Component: SlideRoadmap,
  },
  {
    hash: "ask",
    title: "Pre-seed ask",
    budgetSeconds: 50,
    notes:
      "Ask ~$1.0–1.5M SAFE for the next three quarters. Use of funds: product and on-chain hardening first.",
    Component: SlideAsk,
  },
  {
    hash: "close",
    title: "Close",
    budgetSeconds: 25,
    notes:
      "Leave them with the line: four agents, one verifiable decision, human approve every trade. Offer EQLTY demo.",
    Component: SlideClose,
  },
];
