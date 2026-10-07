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
        technology behind it. Live on{" "}
        <strong style={{ color: FG }}>Robinhood Chain</strong> (an Arbitrum chain).
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
        Crypto users who want to invest in stocks with a clear goal.
      </h2>
      <div className="mt-14 grid grid-cols-3 gap-8">
        {[
          {
            t: "Already uses crypto",
            d: "Has a wallet and stablecoins. Wants stock tokens of companies like NVDA or AMZN, where they are allowed.",
          },
          {
            t: "Thinks in goals",
            d: "Starts from a goal, like investing in tech with a monthly budget, and wants a simple plan.",
          },
          {
            t: "Keeps control",
            d: "Keeps the money in their own wallet, sets limits once, and approves every trade.",
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
        <strong style={{ color: ACCENT }}>First users:</strong> crypto users on Robinhood
        Chain. <strong style={{ color: ACCENT }}>Next:</strong>{" "}
        people with a savings goal, and small teams that
        need the same agents and vault.
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
            d: "Pools, prices, routes and signatures before one buy.",
          },
          {
            t: "Advice without proof",
            d: "AI chats answer fast, but show no sources, no limits and no record.",
          },
          {
            t: "Bots with the keys",
            d: "Bots spend money on their own. One bad move cannot be undone.",
          },
          {
            t: "Hard to check",
            d: "I cannot check that my rules were followed before money moves.",
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
            d: "Four agents compare options and show the evidence. Risk can say no.",
          },
          {
            icon: Shield,
            t: "Approve",
            d: "Your rules and spending limits live on-chain in the EQLTY vault. Nothing moves without you.",
          },
          {
            icon: Workflow,
            t: "Buy",
            d: "If you approve, the buy runs on Uniswap v4 on Robinhood Chain, paid in USDG.",
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

function SlideApp() {
  const shots = [
    {
      src: "/arbitrum/eqlty-home.jpg",
      t: "Ask four agents",
      d: "Say your goal in plain words.",
    },
    {
      src: "/arbitrum/eqlty-markets.jpg",
      t: "194 stock tokens",
      d: "Live Uniswap markets on Robinhood Chain.",
    },
    {
      src: "/arbitrum/rhc-amzn-buy.jpg",
      t: "Every buy is on-chain",
      d: "1 USDG to AMZN, confirmed on Robinhood Chain.",
    },
  ];
  return (
    <Frame>
      <Kicker>The live app</Kicker>
      <h2 className="mt-8 max-w-[1500px] text-[52px] font-semibold tracking-tight">
        A real product, live on Robinhood Chain.
      </h2>
      <div className="mt-12 grid grid-cols-3 gap-8">
        {shots.map((shot) => (
          <figure
            key={shot.src}
            className="overflow-hidden rounded-3xl border"
            style={{ borderColor: BORDER, background: ELEV }}
          >
            <div className="relative h-[330px] w-full">
              <Image
                src={shot.src}
                alt={shot.t}
                fill
                sizes="560px"
                className="object-cover object-top"
              />
            </div>
            <figcaption className="p-7">
              <p className="text-[28px] font-semibold">{shot.t}</p>
              <p className="mt-2 text-[22px]" style={{ color: MUTED }}>
                {shot.d}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
      <Footer />
    </Frame>
  );
}

function SlideRoles() {
  const roles = [
    ["01", "Scout", "Finds stock tokens you can buy and collects market data."],
    ["02", "Risk", "Checks your rules, fresh data, liquidity and limits. Can say no."],
    ["03", "Trader", "Prepares the Uniswap v4 trade. The only agent that can spend."],
    ["04", "Auditor", "Checks the decision against what happened on-chain."],
  ] as const;
  return (
    <Frame>
      <Kicker>The agents</Kicker>
      <h2 className="mt-8 text-[52px] font-semibold tracking-tight">
        Four agents. One decision you can verify.
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
    ["Robinhood", "Stock catalog and trading", "A decision you can check, on any platform."],
    ["Uniswap", "Liquidity and trades", "Your rules, the option to say no, and a receipt before the trade."],
    ["Social buy apps", "Speed and trends", "Time to think, real evidence and clear rules."],
    ["Trading bots", "Automation", "You approve, limits on-chain, reasons you can check."],
  ] as const;
  return (
    <Frame>
      <Kicker>What sets us apart</Kicker>
      <h2 className="mt-8 max-w-[1500px] text-[52px] font-semibold tracking-tight">
        The step between asking and buying.
      </h2>
      <div
        className="mt-12 overflow-hidden rounded-3xl border"
        style={{ borderColor: BORDER, background: ELEV }}
      >
        <div
          className="grid grid-cols-[300px_340px_1fr] gap-8 px-10 py-5 text-[18px] uppercase"
          style={{ color: MUTED, letterSpacing: "0.08em", borderBottom: `1px solid ${BORDER}` }}
        >
          <span>Others</span>
          <span>Good at</span>
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
        We build on Robinhood Chain because the stock tokens live there.
      </h2>
      <ul className="mt-14 space-y-8">
        {[
          "Robinhood Chain is an Arbitrum chain made for stock tokens and USDG.",
          "Our vault and the Uniswap v4 trades are live, and anyone can check them on the explorer.",
          "PerkOS already runs agent payments (x402), so each decision can come with a receipt.",
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

function SlideTraction() {
  const cards = [
    ["Live", "EQLTY on Robinhood Chain, with the vault and Uniswap v4"],
    ["4 roles", "Scout, Risk, Trader and Auditor working in the live app"],
    ["Beta", "Invite only · ~10 active wallets testing the flow"],
    ["Pre-seed", "Self-funded so far · raising ~$1.0–1.5M on a SAFE"],
  ] as const;
  return (
    <Frame>
      <Kicker>Where we are</Kicker>
      <h2 className="mt-8 text-[52px] font-semibold tracking-tight">
        Closed beta, live on mainnet.
      </h2>
      <p className="mt-6 max-w-[1200px] text-[26px]" style={{ color: MUTED }}>
        We start with a small group of invited users and a clear plan to charge for decisions.
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
      title: "Easy to use without our help",
      items: [
        "Ask for a goal in a simple chat",
        "Stronger vault and rules on Robinhood Chain",
        "Start charging for decisions (x402)",
        "First outside users every week",
      ],
    },
    {
      id: "Q2",
      when: "Q1 2027",
      title: "Users come back, and a second product",
      items: [
        "Users who come back on their own",
        "A second product on the same PerkOS tools",
        "Partnerships with Robinhood Chain and Arbitrum to reach users",
      ],
    },
    {
      id: "Q3",
      when: "Q2 2027",
      title: "Prove the business",
      items: [
        "First monthly revenue",
        "First hire, if the round allows it",
        "Numbers ready for a seed round",
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
        It covers the next three quarters: an easier product on Robinhood Chain,
        charging for decisions step by step, and our first team member. Product
        and security first.
      </p>
      <div className="mt-14 grid grid-cols-3 gap-8">
        {[
          "A product anyone can use",
          "Start charging, step by step",
          "Show users come back before a seed round",
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
        Four agents. One decision you can verify.
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
      "Open with the product sentence. EQLTY is the app, PerkOS is the technology behind it, Robinhood Chain is where it runs. Keep the focus on EQLTY.",
    Component: SlideHero,
  },
  {
    hash: "user",
    title: "Who it is for",
    budgetSeconds: 45,
    notes:
      "Start with the user: a crypto user with stablecoins who wants to invest in stocks from a goal and keep control. First users on Robinhood Chain.",
    Component: SlideAudience,
  },
  {
    hash: "problem",
    title: "Their pain",
    budgetSeconds: 45,
    notes:
      "Read the quote as the user. Too many steps, advice without proof, bots with the keys, nothing to check before money moves.",
    Component: SlideProblem,
  },
  {
    hash: "loop",
    title: "How it works",
    budgetSeconds: 50,
    notes:
      "Go through Recommend, Approve, Buy once. Say that buying is optional and always needs your OK.",
    Component: SlideLoop,
  },
  {
    hash: "app",
    title: "The live app",
    budgetSeconds: 40,
    notes:
      "Show the real app: ask in plain words, 194 stock tokens, and a real buy on the explorer.",
    Component: SlideApp,
  },
  {
    hash: "roles",
    title: "Four agents",
    budgetSeconds: 45,
    notes:
      "Scout finds, Risk can say no, Trader is the only one that can spend, Auditor checks. The vault blocks anything outside your limits.",
    Component: SlideRoles,
  },
  {
    hash: "edge",
    title: "What sets us apart",
    budgetSeconds: 50,
    notes:
      "Robinhood and Uniswap already solve access and trading. We add the step before money moves: your rules, the option to say no, evidence and a receipt.",
    Component: SlideEdge,
  },
  {
    hash: "why-arbitrum",
    title: "Why Robinhood Chain",
    budgetSeconds: 40,
    notes:
      "Robinhood Chain is an Arbitrum chain for stock tokens and USDG. The vault and Uniswap v4 are live. Show the AMZN buy on the explorer.",
    Component: SlideWhy,
  },
  {
    hash: "traction",
    title: "Closed beta",
    budgetSeconds: 35,
    notes:
      "Small group on purpose: ~10 active wallets. Live product, four agents. Self-funded so far.",
    Component: SlideTraction,
  },
  {
    hash: "roadmap",
    title: "Next three quarters",
    budgetSeconds: 60,
    notes:
      "Q4 2026: easier product and first charges. Q1 2027: users come back, second product. Q2 2027: prove the business.",
    Component: SlideRoadmap,
  },
  {
    hash: "ask",
    title: "Pre-seed ask",
    budgetSeconds: 50,
    notes:
      "Ask ~$1.0–1.5M on a SAFE for the next three quarters. The money goes to product and security first.",
    Component: SlideAsk,
  },
  {
    hash: "close",
    title: "Close",
    budgetSeconds: 25,
    notes:
      "End with: four agents, one decision you can verify, you approve every trade. Offer an EQLTY demo.",
    Component: SlideClose,
  },
];
