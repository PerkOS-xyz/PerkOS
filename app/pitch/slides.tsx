"use client";

/**
 * /pitch — slide content for the 15-minute PerkOS presentation.
 *
 * Authored on a fixed 1920×1080 canvas (scaled by the engine in page.tsx).
 * PITCH_META is the single source of truth for order, hash slugs, speaker
 * notes, and per-slide time budgets; the presenter view reads it too.
 *
 * Copy rules: English only, no em dashes, team language (never robots).
 */

import Image from "next/image";
import { type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Coins,
  Eye,
  Flag,
  Globe2,
  KeyRound,
  Landmark,
  Layers,
  LockKeyhole,
  Mail,
  Network,
  Package,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
  Wallet,
} from "lucide-react";

export const W = 1920;
export const H = 1080;

// Design tokens (video-call safe, from the pitch design spec).
const BG = "#0D0D14";
const ELEV = "#17161F";
const BORDER = "#2A2935";
const FG = "#F5F4F8";
const LAV_T = "#B0ACD9"; // secondary text, safe at any size
const PINK_T = "#FF8AB4"; // small pink text, safe at any size
const PINK = "#EC1B69"; // large/decorative only
const LAV = "#7975A8"; // large/decorative only

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

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

/** Square product monogram (products are squares; agents are circles). */
function ProductMark({ label, size = 64 }: { label: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-2xl font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, ${PINK} 0%, ${LAV} 100%)`,
      }}
    >
      {label}
    </span>
  );
}

/** Circular head crop of the persona art (agents only, same as the app). */
function Head({ src, size, ring }: { src: string; size: number; ring?: string }) {
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: "#1a1228",
        boxShadow: `0 0 0 3px ${ring ?? "#241a35"}`,
      }}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes={`${size}px`}
        className="origin-[50%_22%] scale-[2.1] object-cover"
      />
    </span>
  );
}

function SlideFrame({
  children,
  kicker,
  hideChrome,
}: {
  children: ReactNode;
  kicker?: string;
  hideChrome?: boolean;
}) {
  return (
    <div
      className="relative flex flex-col overflow-hidden"
      style={{ width: W, height: H, background: BG, color: FG }}
    >
      {/* ambient glow, decorative, never behind body text */}
      <div
        aria-hidden
        className="absolute -bottom-64 -right-48 h-[700px] w-[700px] rounded-full blur-[160px]"
        style={{ background: "rgba(236,27,105,0.10)" }}
      />
      <div
        aria-hidden
        className="absolute -left-64 -top-64 h-[600px] w-[600px] rounded-full blur-[160px]"
        style={{ background: "rgba(121,117,168,0.09)" }}
      />
      <div className="relative z-10 flex h-full flex-col px-[120px] py-[72px]">
        {!hideChrome ? (
          <div className="mb-10 flex items-center justify-between">
            <span className="flex items-center gap-3">
              <Image src="/logo.png" alt="" width={40} height={40} />
              <span className="text-[22px] font-semibold" style={{ color: LAV_T }}>
                PerkOS
              </span>
            </span>
            {kicker ? <Kicker>{kicker}</Kicker> : null}
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={"rounded-2xl border p-8 " + className}
      style={{ background: ELEV, borderColor: BORDER, ...style }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------------

const ORBIT = [
  "/avatars/13.Marketing.png",
  "/avatars/04.Support.png",
  "/avatars/05.Researcher.png",
  "/avatars/06.Analyst.png",
  "/avatars/12.Sales.png",
];

function SlideHero() {
  return (
    <SlideFrame hideChrome>
      <div className="flex h-full items-center gap-24">
        <div className="flex max-w-[980px] flex-col gap-10">
          <Kicker>PerkOS · 2026</Kicker>
          <div className="flex items-center gap-6">
            <Image src="/logo.png" alt="PerkOS" width={96} height={96} />
            <span className="text-[56px] font-semibold tracking-tight">PerkOS</span>
          </div>
          <h1 className="text-[104px] font-bold leading-[1.05] tracking-tight">
            The agent economy,
            <br />
            <span style={{ color: PINK }}>for small business.</span>
          </h1>
          <p className="text-[36px] font-medium leading-snug" style={{ color: LAV_T }}>
            Launch a working AI team in one click. The team does real work.
            Every job settles on-chain in stablecoins.
          </p>
        </div>
        <div className="relative h-[560px] w-[560px] shrink-0">
          <div aria-hidden className="absolute inset-0 rounded-full border" style={{ borderColor: "rgba(236,27,105,0.25)" }} />
          <div aria-hidden className="absolute inset-[90px] rounded-full border" style={{ borderColor: "rgba(121,117,168,0.25)" }} />
          <div
            className="absolute left-1/2 top-1/2 z-10 grid h-36 w-36 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-3xl border"
            style={{ background: "#140b1f", borderColor: "rgba(236,27,105,0.5)", boxShadow: "0 0 80px -12px rgba(236,27,105,0.7)" }}
          >
            <Image src="/logo.png" alt="" width={84} height={84} />
          </div>
          {ORBIT.map((src, i) => {
            const angle = -Math.PI / 2 + (i / ORBIT.length) * 2 * Math.PI;
            const r = 235;
            return (
              <span
                key={src}
                className="absolute"
                style={{ left: 280 + r * Math.cos(angle) - 49, top: 280 + r * Math.sin(angle) - 49 }}
              >
                <Head src={src} size={98} ring={i === 0 ? PINK : undefined} />
              </span>
            );
          })}
        </div>
      </div>
      <div className="flex items-end justify-between text-[24px]" style={{ color: LAV_T }}>
        <span>Julio M. Cruz · Founder</span>
        <span className="text-[20px]">perkos.xyz</span>
      </div>
    </SlideFrame>
  );
}

function SlideThesis() {
  return (
    <SlideFrame kicker="The thesis">
      <div className="flex h-full items-center justify-center">
        <h2 className="max-w-[1400px] text-center text-[96px] font-bold leading-[1.12] tracking-tight">
          A chatbot answers questions.
          <br />
          <span style={{ color: PINK }}>A team does the work.</span>
        </h2>
      </div>
    </SlideFrame>
  );
}

function SlideProblem() {
  const rails = [
    { Icon: KeyRound, label: "Identity", copy: "Who is this teammate, and can it act for you." },
    { Icon: Wallet, label: "Payments", copy: "How work gets paid, without a subscription owners cancel." },
    { Icon: Users, label: "Coordination", copy: "A lead and workers planning together, not one lonely chat." },
    { Icon: BadgeCheck, label: "Validation", copy: "Proof the work actually happened." },
  ];
  return (
    <SlideFrame kicker="The problem">
      <h2 className="text-[72px] font-semibold leading-tight tracking-tight">
        The AI is <span style={{ color: PINK }}>the easy part.</span>
      </h2>
      <p className="mt-4 text-[30px]" style={{ color: LAV_T }}>
        The hard part is everything around it. Nobody has packaged it for a
        non-technical owner.
      </p>
      <div className="mt-14 grid flex-1 grid-cols-4 gap-6">
        {rails.map(({ Icon, label, copy }) => (
          <Card key={label} className="flex flex-col gap-5">
            <span className="grid h-16 w-16 place-items-center rounded-2xl" style={{ background: "rgba(121,117,168,0.15)", color: LAV_T }}>
              <Icon className="h-8 w-8" />
            </span>
            <span className="text-[26px] font-semibold uppercase tracking-wide" style={{ color: PINK_T }}>
              {label}
            </span>
            <p className="text-[24px] leading-normal" style={{ color: LAV_T }}>
              {copy}
            </p>
          </Card>
        ))}
      </div>
      <p className="mt-10 text-[28px] font-medium">
        We call these <span style={{ color: PINK_T }}>the four rails</span>. Every
        product you are about to see runs on them.
      </p>
    </SlideFrame>
  );
}

function SlideCoreLoop() {
  const steps = [
    { Icon: Flag, label: "Goal", copy: "The owner describes it in plain words." },
    { Icon: ClipboardList, label: "Plan", copy: "A team lead turns it into tasks." },
    { Icon: Users, label: "Work", copy: "Worker teammates execute on a shared board." },
    { Icon: CheckCircle2, label: "Approve", copy: "The owner reviews and signs off." },
  ];
  return (
    <SlideFrame kicker="The core loop">
      <h2 className="text-[72px] font-semibold leading-tight tracking-tight">
        Describe a goal. <span style={{ color: PINK }}>Get it done.</span>
      </h2>
      <div className="mt-20 flex flex-1 items-start justify-between gap-6">
        {steps.map(({ Icon, label, copy }, i) => (
          <div key={label} className="flex flex-1 items-start gap-6">
            <div className="flex flex-1 flex-col items-center gap-6 text-center">
              <span
                className="grid h-[140px] w-[140px] place-items-center rounded-[32px] border"
                style={{ background: ELEV, borderColor: BORDER, color: LAV_T }}
              >
                <Icon className="h-14 w-14" />
              </span>
              <span className="text-[32px] font-semibold">{label}</span>
              <p className="max-w-[300px] text-[22px] leading-normal" style={{ color: LAV_T }}>
                {copy}
              </p>
            </div>
            {i < steps.length - 1 ? (
              <ArrowRight className="mt-14 h-12 w-12 shrink-0" style={{ color: LAV }} />
            ) : null}
          </div>
        ))}
      </div>
      <div className="mb-2 flex items-center justify-center gap-3 text-[24px]" style={{ color: PINK_T }}>
        <Timer className="h-6 w-6" />
        <span>Repeats autonomously. No prompt engineering, no setup.</span>
      </div>
    </SlideFrame>
  );
}

function SlidePayPerOutcome() {
  const steps = [
    { Icon: ShieldCheck, title: "Accept a plan", copy: "The cost reserves. Nothing is charged." },
    { Icon: Users, title: "The team runs", copy: "Teammates hibernate when idle, wake on work." },
    { Icon: LockKeyhole, title: "Locked preview", copy: "See that results exist before paying." },
    { Icon: Coins, title: "Unlock to pay", copy: "Money moves only here. Failed jobs never charge." },
  ];
  return (
    <SlideFrame kicker="Pay per outcome">
      <h2 className="text-[72px] font-semibold leading-tight tracking-tight">
        See the work <span style={{ color: PINK }}>before you pay.</span>
      </h2>
      <div className="mt-16 grid flex-1 grid-cols-4 gap-6">
        {steps.map(({ Icon, title, copy }, i) => (
          <Card key={title} className="flex flex-col gap-5">
            <span className="text-[64px] font-bold leading-none" style={{ color: PINK }}>
              {i + 1}
            </span>
            <span className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: "rgba(236,27,105,0.12)", color: PINK_T }}>
              <Icon className="h-7 w-7" />
            </span>
            <span className="text-[28px] font-semibold leading-snug">{title}</span>
            <p className="text-[22px] leading-normal" style={{ color: LAV_T }}>
              {copy}
            </p>
          </Card>
        ))}
      </div>
      <p className="mt-10 text-[28px] font-medium">
        Idle teammates cost about <span style={{ color: PINK_T }}>$0.02 per month</span>.
        A full team on standby, for pocket change.
      </p>
    </SlideFrame>
  );
}

const SUITE = [
  { mark: "A", name: "PerkOS App", blurb: "One-click AI teams for small businesses." },
  { mark: "M", name: "PerkOS MiniPay", blurb: "Teams for Global South merchants." },
  { mark: "B", name: "PerkOS B2B", blurb: "White-label portals for partners." },
  { mark: "K", name: "PerkOS Knowledge", blurb: "The two-sided context market." },
  { mark: "S", name: "PerkOS Stack", blurb: "Agentic commerce and payments." },
  { mark: "L", name: "PerkOS LLM", blurb: "The self-hosted model gateway." },
];

function SlideSuite() {
  return (
    <SlideFrame kicker="The suite">
      <h2 className="text-[72px] font-semibold leading-tight tracking-tight">
        Six products. <span style={{ color: PINK }}>Four rails.</span>
      </h2>
      <div className="mt-14 grid flex-1 grid-cols-3 grid-rows-2 gap-6">
        {SUITE.map(({ mark, name, blurb }) => (
          <Card key={name} className="flex flex-col justify-center gap-5">
            <div className="flex items-center gap-5">
              <ProductMark label={mark} size={56} />
              <span className="text-[32px] font-semibold">{name}</span>
            </div>
            <p className="text-[24px] leading-normal" style={{ color: LAV_T }}>
              {blurb}
            </p>
          </Card>
        ))}
      </div>
    </SlideFrame>
  );
}

function ProductSlide({
  kicker,
  mark,
  name,
  domain,
  oneLiner,
  bullets,
  visual,
}: {
  kicker: string;
  mark: string;
  name: string;
  domain?: string;
  oneLiner: string;
  bullets: string[];
  visual: ReactNode;
}) {
  return (
    <SlideFrame kicker={kicker}>
      <div className="flex h-full items-center gap-16">
        <div className="flex max-w-[860px] flex-1 flex-col gap-8">
          <div className="flex items-center gap-6">
            <ProductMark label={mark} />
            <div className="flex flex-col">
              <span className="text-[56px] font-bold leading-tight">{name}</span>
              {domain ? (
                <span className="text-[24px]" style={{ color: PINK_T }}>
                  {domain}
                </span>
              ) : null}
            </div>
          </div>
          <p className="text-[30px] leading-snug" style={{ color: LAV_T }}>
            {oneLiner}
          </p>
          <ul className="flex flex-col gap-6">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-4 text-[28px] font-medium leading-snug">
                <span className="mt-3 h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: PINK }} />
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex w-[680px] shrink-0 items-center justify-center">{visual}</div>
      </div>
    </SlideFrame>
  );
}

function SlideApp() {
  return (
    <ProductSlide
      kicker="Product 1 of 6"
      mark="A"
      name="PerkOS App"
      domain="app.perkos.xyz"
      oneLiner="The flagship: a real team for anyone who cannot hire one."
      bullets={[
        "Company templates, one-click launch",
        "Team lead + workers on a shared job board",
        "Isolated containers, two agent frameworks: Hermes and OpenClaw",
        "Teammates hibernate when idle, wake on demand",
        "Rent your teammates to others and earn",
      ]}
      visual={
        <div className="flex flex-col items-center gap-8">
          <div className="flex items-center -space-x-4">
            {ORBIT.map((s, i) => (
              <Head key={s} src={s} size={110} ring={i === 0 ? PINK : undefined} />
            ))}
          </div>
          <span
            className="inline-flex items-center gap-3 rounded-full border px-6 py-3 text-[24px] font-medium"
            style={{ borderColor: "rgba(52,211,153,0.4)", background: "rgba(52,211,153,0.1)", color: "#6ee7b7" }}
          >
            <span className="h-3 w-3 rounded-full bg-emerald-400" /> 5 teammates online
          </span>
        </div>
      }
    />
  );
}

function SlideMiniPay() {
  return (
    <ProductSlide
      kicker="Product 2 of 6"
      mark="M"
      name="PerkOS MiniPay"
      domain="Mini App inside Opera MiniPay"
      oneLiner="AI teams where the next billion owners already keep their money."
      bullets={[
        "16M+ wallets, 65+ countries",
        "20 templates on a shared fleet, live in seconds",
        "Pay per task in cUSD, priced like airtime",
      ]}
      visual={
        <div className="flex flex-col items-center gap-6">
          <span className="grid h-40 w-40 place-items-center rounded-[40px]" style={{ background: "rgba(236,27,105,0.12)" }}>
            <Globe2 className="h-20 w-20" style={{ color: PINK_T }} />
          </span>
          <span className="text-center text-[96px] font-bold leading-none" style={{ color: PINK }}>
            16M+
          </span>
          <span className="text-[26px]" style={{ color: LAV_T }}>
            activated wallets to reach
          </span>
        </div>
      }
    />
  );
}

function PairCard({
  mark,
  name,
  domain,
  oneLiner,
  bullets,
}: {
  mark: string;
  name: string;
  domain: string;
  oneLiner: string;
  bullets: string[];
}) {
  return (
    <Card className="flex flex-col gap-6 p-12">
      <div className="flex items-center gap-5">
        <ProductMark label={mark} />
        <div className="flex flex-col">
          <span className="text-[40px] font-bold">{name}</span>
          <span className="text-[22px]" style={{ color: PINK_T }}>{domain}</span>
        </div>
      </div>
      <p className="text-[24px] leading-snug" style={{ color: LAV_T }}>
        {oneLiner}
      </p>
      <ul className="flex flex-col gap-5 text-[26px] font-medium leading-snug">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-4">
            <span className="mt-3 h-3 w-3 shrink-0 rounded-sm" style={{ background: PINK }} />
            {b}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SlideB2BKnowledge() {
  return (
    <SlideFrame kicker="Products 3 and 4 of 6">
      <h2 className="text-[64px] font-semibold leading-tight tracking-tight">
        Distribution and <span style={{ color: PINK }}>context.</span>
      </h2>
      <div className="mt-14 grid flex-1 grid-cols-2 gap-8">
        <PairCard
          mark="B"
          name="PerkOS B2B"
          domain="b2b.perkos.xyz"
          oneLiner="Enterprise multi-tenancy: partners resell PerkOS teams as their own product."
          bullets={[
            "Every partner: a branded portal on its own subdomain",
            "Tenant-scoped teams, users, and billing",
            "Built for agencies, ISVs, and platforms serving SMBs",
            "Their brand and distribution, our engine underneath",
          ]}
        />
        <PairCard
          mark="K"
          name="PerkOS Knowledge"
          domain="knowledge.perkos.xyz"
          oneLiner="The context economy: teams buy the operational knowledge they need."
          bullets={[
            "Two-sided market: providers publish, teams consume",
            "Providers earn every time their knowledge answers",
            "Prepaid credits, x402 deposits, on-chain payouts (75 / 20 / 5)",
            "Every answer makes every team smarter: a compounding moat",
          ]}
        />
      </div>
    </SlideFrame>
  );
}

function SlideStackLLM() {
  return (
    <SlideFrame kicker="Products 5 and 6 of 6">
      <h2 className="text-[64px] font-semibold leading-tight tracking-tight">
        The rails <span style={{ color: PINK }}>we own.</span>
      </h2>
      <div className="mt-14 grid flex-1 grid-cols-2 gap-8">
        <PairCard
          mark="S"
          name="PerkOS Stack"
          domain="stack.perkos.xyz"
          oneLiner="The commerce rail: everything an autonomous team needs to transact."
          bullets={[
            "x402 machine-native stablecoin payments on Base and Celo",
            "On-chain agent identity and reputation (ERC-8004 registries)",
            "Wallets, authorization, and settlement for agent commerce",
            "Standards-first, ahead of the emerging agent protocols",
          ]}
        />
        <PairCard
          mark="L"
          name="PerkOS LLM"
          domain="model gateway"
          oneLiner="The model rail: control over every token of inference."
          bullets={[
            "Self-hosted gateway on our own infrastructure",
            "Per-teammate keys, metered usage, full cost attribution",
            "Bring your own model: OpenAI, Anthropic, or local",
            "No vendor lock, for us or for our customers",
          ]}
        />
      </div>
    </SlideFrame>
  );
}

function InfraChip({ label }: { label: string }) {
  return (
    <span
      className="rounded-xl border px-5 py-3 text-[22px] font-medium"
      style={{ borderColor: "rgba(121,117,168,0.45)", background: "rgba(13,13,20,0.6)", color: FG }}
    >
      {label}
    </span>
  );
}

function SlideInfra() {
  return (
    <SlideFrame kicker="The moat">
      <h2 className="text-[64px] font-semibold leading-tight tracking-tight">
        Everything an agent economy needs, <span style={{ color: PINK }}>we built it.</span>
      </h2>
      <div className="mt-12 flex flex-1 flex-col gap-4">
        <div className="flex flex-1 flex-col justify-center gap-4 rounded-2xl px-10" style={{ background: "rgba(236,27,105,0.10)" }}>
          <span className="flex items-center gap-3 text-[22px] font-semibold uppercase tracking-wide" style={{ color: PINK_T }}>
            <Boxes className="h-6 w-6" /> Products
          </span>
          <div className="flex flex-wrap gap-3">
            {SUITE.map((p) => (
              <span key={p.name} className="flex items-center gap-3 rounded-xl border px-5 py-2.5 text-[22px] font-medium" style={{ borderColor: BORDER, background: "rgba(13,13,20,0.6)" }}>
                <ProductMark label={p.mark} size={32} /> {p.name.replace("PerkOS ", "")}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-4 rounded-2xl px-10" style={{ background: ELEV }}>
          <span className="flex items-center gap-3 text-[22px] font-semibold uppercase tracking-wide" style={{ color: LAV_T }}>
            <Network className="h-6 w-6" /> Platform services
          </span>
          <div className="flex flex-wrap gap-3">
            <InfraChip label="Platform API" />
            <InfraChip label="A2A bridge (npm)" />
            <InfraChip label="Real-time chat" />
            <InfraChip label="Agent relay" />
            <InfraChip label="Runtimes: Hermes + OpenClaw" />
            <InfraChip label="Wallet-scoped tools" />
            <InfraChip label="@perkos packages" />
            <InfraChip label="Admin console" />
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-4 rounded-2xl px-10" style={{ background: "rgba(121,117,168,0.12)" }}>
          <span className="flex items-center gap-3 text-[22px] font-semibold uppercase tracking-wide" style={{ color: LAV_T }}>
            <Landmark className="h-6 w-6" /> On-chain, live and verified
          </span>
          <div className="flex flex-wrap gap-3">
            <InfraChip label="PerkosClaimVault · earnings claims" />
            <InfraChip label="PerkosCredits · zero-gas ledger" />
            <InfraChip label="PerkosInteractionRegistry · proof of work" />
            <InfraChip label="Base mainnet" />
            <InfraChip label="Celo mainnet" />
          </div>
        </div>
      </div>
      <p className="mt-8 text-[22px]" style={{ color: LAV_T }}>
        Every product ships on the same platform and settles on-chain. Nobody reproduces this in a weekend.
      </p>
    </SlideFrame>
  );
}

function SlideTraction() {
  const stats = [
    { big: "Live", label: "6 products in production today" },
    { big: "Secs", label: "teammates answer in persona, from a shared fleet" },
    { big: "2", label: "mainnets with verified contracts: Base and Celo" },
    { big: "$0.02", label: "per month for an idle teammate" },
  ];
  return (
    <SlideFrame kicker="Proof">
      <h2 className="text-[72px] font-semibold leading-tight tracking-tight">
        Live today. <span style={{ color: PINK }}>Not a demo.</span>
      </h2>
      <div className="mt-16 grid flex-1 grid-cols-4 gap-6">
        {stats.map(({ big, label }) => (
          <Card key={label} className="flex flex-col justify-center gap-6 text-center">
            <span className="text-[104px] font-bold leading-none" style={{ color: PINK }}>
              {big}
            </span>
            <p className="text-[24px] leading-normal" style={{ color: LAV_T }}>
              {label}
            </p>
          </Card>
        ))}
      </div>
      <p className="mt-10 flex items-center gap-3 text-[26px] font-medium">
        <Eye className="h-7 w-7" style={{ color: PINK_T }} />
        Rental cycles validated end to end, with per-renter isolation proven.
      </p>
    </SlideFrame>
  );
}

function SlideWhyNow() {
  const items = [
    { Icon: Package, copy: "Agent runtimes matured and went open source." },
    { Icon: Wallet, copy: "Stablecoin wallets hit mass scale in emerging markets." },
    { Icon: Coins, copy: "Machine-native payments landed: x402." },
    { Icon: Sparkles, copy: "Nobody owns the small-business agent economy." },
  ];
  return (
    <SlideFrame kicker="Why now">
      <h2 className="text-[72px] font-semibold leading-tight tracking-tight">
        Four shifts, <span style={{ color: PINK }}>one moment.</span>
      </h2>
      <div className="mt-16 grid flex-1 grid-cols-2 grid-rows-2 gap-6">
        {items.map(({ Icon, copy }, i) => (
          <Card key={copy} className="flex items-center gap-8 p-10">
            <span className="text-[72px] font-bold leading-none" style={{ color: PINK }}>
              {i + 1}
            </span>
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl" style={{ background: "rgba(121,117,168,0.15)", color: LAV_T }}>
              <Icon className="h-8 w-8" />
            </span>
            <p className="text-[30px] font-medium leading-snug">{copy}</p>
          </Card>
        ))}
      </div>
    </SlideFrame>
  );
}

function SlideModel() {
  const lines = [
    { name: "Pay per outcome", detail: "Stablecoin credits + credit packs. No subscriptions where they do not fit." },
    { name: "Rental take rate", detail: "We earn when owners earn from their teams." },
    { name: "Knowledge market", detail: "75 provider / 20 platform / 5 rewards." },
    { name: "B2B white-label", detail: "Recurring platform revenue from partners." },
  ];
  return (
    <SlideFrame kicker="Business model">
      <h2 className="text-[72px] font-semibold leading-tight tracking-tight">
        We earn when work <span style={{ color: PINK }}>gets done.</span>
      </h2>
      <div className="mt-16 grid flex-1 grid-cols-2 grid-rows-2 gap-6">
        {lines.map(({ name, detail }) => (
          <Card key={name} className="flex flex-col justify-center gap-4 p-10">
            <span className="text-[36px] font-bold">{name}</span>
            <p className="text-[26px] leading-normal" style={{ color: LAV_T }}>
              {detail}
            </p>
          </Card>
        ))}
      </div>
      <p className="mt-10 text-[26px] font-medium" style={{ color: LAV_T }}>
        All four lines are tied to real work, denominated in stablecoins, settled on-chain.
      </p>
    </SlideFrame>
  );
}

function SlideCta() {
  const contacts = [
    { Icon: Globe2, label: "perkos.xyz" },
    { Icon: Layers, label: "@perk_os" },
    { Icon: Mail, label: "julio.cruz@perkos.xyz" },
  ];
  return (
    <SlideFrame hideChrome>
      <div className="flex h-full flex-col items-center justify-center gap-16 text-center">
        <Image src="/logo.png" alt="PerkOS" width={110} height={110} />
        <h2 className="max-w-[1400px] text-[88px] font-bold leading-[1.1] tracking-tight">
          Let&apos;s build the agent economy
          <span style={{ color: PINK }}> together.</span>
        </h2>
        <div className="flex items-center gap-10">
          {contacts.map(({ Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-4 rounded-2xl border-2 px-8 py-5 text-[30px] font-semibold"
              style={{ borderColor: PINK, background: ELEV }}
            >
              <Icon className="h-8 w-8" style={{ color: PINK_T }} />
              {label}
            </span>
          ))}
        </div>
        <p className="text-[28px]" style={{ color: LAV_T }}>
          We are looking for partners, pilots, and backers.
        </p>
      </div>
    </SlideFrame>
  );
}

// ---------------------------------------------------------------------------
// Meta: single source of truth for order, slugs, notes, budgets.
// ---------------------------------------------------------------------------

export type PitchSlide = {
  hash: string;
  title: string;
  budgetSeconds: number;
  notes: string;
  Component: () => ReactNode;
};

export const PITCH_SLIDES: PitchSlide[] = [
  {
    hash: "hero",
    title: "PerkOS: the agent economy for small business",
    budgetSeconds: 60,
    notes:
      "Thanks for the time. I am Julio, founder of PerkOS. In one sentence: PerkOS lets a small-business owner launch a working AI team in one click, the team does real work, and every job settles on-chain in stablecoins. Most people building in AI are building a smarter place to chat. We are building the layer underneath a working team. What I will show you today is not a concept deck: it is a suite of products live in production right now, backed by smart contracts running on two mainnets.",
    Component: SlideHero,
  },
  {
    hash: "thesis",
    title: "A chatbot answers. A team does the work.",
    budgetSeconds: 30,
    notes:
      "Start with the person. A small-business owner has no team and no time. When AI arrived, what they actually got was a chatbot: a place to ask questions and copy answers back out by hand. That is not help, that is more homework. The gap between a chatbot and a team is the entire opportunity.",
    Component: SlideThesis,
  },
  {
    hash: "problem",
    title: "The AI is the easy part (the four rails)",
    budgetSeconds: 75,
    notes:
      "Here is the insight the market keeps missing. The model is the easy part now. The hard part is everything around the AI. Four things. Identity: who is this teammate, can it be trusted to act. Payments: how does work get paid for, cleanly, without a subscription the owner will cancel. Coordination: how do a lead and workers plan and execute together. Validation: how do you prove work actually happened. We call these the four rails. Nobody has packaged them for a non-technical owner. That packaging is PerkOS.",
    Component: SlideProblem,
  },
  {
    hash: "core-loop",
    title: "The core loop: goal, plan, work, approve",
    budgetSeconds: 60,
    notes:
      "How does it feel to use? The owner describes a goal in plain words, the way they would tell a new hire. A team lead agent turns it into a plan. Worker teammates execute on a shared job board. The owner reviews and approves. No prompt engineering, no wiring. You describe the outcome, a team organizes around it, and you stay in control at the approval step. And the owner never pays to talk: money only shows up at the end, which is the next slide.",
    Component: SlideCoreLoop,
  },
  {
    hash: "pay-per-outcome",
    title: "See the work before you pay",
    budgetSeconds: 60,
    notes:
      "This is the mechanic I am most proud of, because it aligns trust with money. Accepting a plan reserves the cost, it does not charge. The team runs. Results come back as a locked preview: you can see the work exists, but not consume it yet. Money only moves when the owner unlocks. Discarded or failed jobs never charge. That single rule removes the fear that keeps non-technical owners away from AI. Underneath: teammates hibernate at about two cents a month and wake instantly, so a full team on standby costs pocket change.",
    Component: SlidePayPerOutcome,
  },
  {
    hash: "suite-overview",
    title: "Six products, four rails",
    budgetSeconds: 45,
    notes:
      "We did not build one app and call it a company. We built a suite, and every product maps to the four rails. Two customer-facing teams: the App for small businesses and MiniPay for merchants in emerging markets. Knowledge feeds teammates context. Stack and LLM are the payment and model rails everything runs on. B2B is how partners put their brand on top. Let me take them quickly, one at a time. These are live, not roadmap.",
    Component: SlideSuite,
  },
  {
    hash: "product-app",
    title: "PerkOS App",
    budgetSeconds: 60,
    notes:
      "PerkOS App is the flagship, live at app.perkos.xyz. Pick a company template and in one click you get an autonomous team lead and worker teammates collaborating on a shared job board. Under the hood, each team runs in isolated containers on two hardened agent frameworks, Hermes and OpenClaw, and multiple teammates share one runtime to keep costs low. Idle teammates hibernate for about two cents a month and wake on demand. And there is a rental layer: if your team is good, rent your teammates to other owners and earn. We validated full rental cycles with strict per-renter isolation.",
    Component: SlideApp,
  },
  {
    hash: "product-minipay",
    title: "PerkOS MiniPay",
    budgetSeconds: 60,
    notes:
      "The wedge I am most excited about. MiniPay is Opera's stablecoin wallet: over sixteen million activated wallets across sixty-five plus countries. Our Mini App puts AI teams where Global South merchants already keep money. Twenty templates on a shared agent fleet: a merchant activates in seconds, by voice or text. They pay per task in cUSD, priced like buying airtime. Same see-before-you-pay engine. No subscription, no bank, no laptop. This is how the next billion owners get a team, and it is distribution that is very hard to copy.",
    Component: SlideMiniPay,
  },
  {
    hash: "product-b2b-knowledge",
    title: "PerkOS B2B + PerkOS Knowledge",
    budgetSeconds: 60,
    notes:
      "Two products here, and this is where the enterprise story lives. B2B is a true multi-tenant platform: a partner gets a fully branded portal on its own subdomain, with teams, users, and billing scoped per tenant. Agencies, software vendors, and platforms resell PerkOS teams as their own product: their brand and distribution, our engine underneath. Knowledge is the context economy: a two-sided market where teams buy the operational knowledge they need and providers earn every time their knowledge answers. Prepaid credits, x402 deposits, on-chain payouts with a transparent 75-20-5 split. And every answer makes every team smarter, so the moat compounds.",
    Component: SlideB2BKnowledge,
  },
  {
    hash: "product-stack-llm",
    title: "PerkOS Stack + PerkOS LLM",
    budgetSeconds: 60,
    notes:
      "The rails everything runs on, and both are enterprise infrastructure in their own right. Stack is the commerce rail: x402 machine-native stablecoin payments on Base and Celo, on-chain agent identity and reputation through the ERC-8004 registries, plus the wallets, authorization, and settlement an autonomous team needs to transact. PerkOS LLM is the model rail: a self-hosted gateway on our own infrastructure, per-teammate keys with metered usage and full cost attribution, and bring-your-own-model support for OpenAI, Anthropic, or local models. No vendor lock, for us or for our customers. Payments rail and model rail, both owned, both live.",
    Component: SlideStackLLM,
  },
  {
    hash: "infra-map",
    title: "The infrastructure moat",
    budgetSeconds: 75,
    notes:
      "This is the moat. Behind the six products is a full stack we built ourselves: a platform API for provisioning, lifecycle, and billing; an agent-to-agent bridge published on npm; a real-time chat backend and an agent relay; hardened multi-arch runtime images wrapping Hermes and OpenClaw; a wallet-scoped tools API; shared npm packages; an admin console. Anchored on-chain: PerkosClaimVault for earnings, PerkosCredits as a zero-gas ledger, and PerkosInteractionRegistry anchoring a hash of every analysis and task while content never leaves the platform. All live and verified on Base and Celo mainnet. Nobody reproduces this in a weekend.",
    Component: SlideInfra,
  },
  {
    hash: "traction",
    title: "Live today, not a demo",
    budgetSeconds: 60,
    notes:
      "Let me make the live claim concrete. The products are in production today. Teammates answer in persona, in seconds, from a shared fleet. Full rental cycles ran end to end with per-renter isolation proven. Multi-agent teams inside one runtime validated end to end. Hibernation economics are real: about two cents per month idle. Contracts live and verified on two mainnets. This is not a prototype waiting for a check to become real. What we are raising for is to pour fuel on distribution.",
    Component: SlideTraction,
  },
  {
    hash: "why-now",
    title: "Why now",
    budgetSeconds: 60,
    notes:
      "Four things just converged. One: agent runtimes grew up and went open source, so we orchestrate the brain instead of building it. Two: stablecoin wallets reached mass scale in emerging markets, MiniPay alone past sixteen million. Three: machine-native payment standards like x402 landed, so agents can pay without a human in the loop. Four, the important one: nobody owns the agent economy for small businesses. The big labs chase enterprise and consumer chat. The small owner and the Global South merchant are wide open. Together, these make right now the moment.",
    Component: SlideWhyNow,
  },
  {
    hash: "business-model",
    title: "Business model",
    budgetSeconds: 60,
    notes:
      "The model follows the product. Core revenue is pay-per-outcome in stablecoin credits, with credit packs. No subscriptions on the Global South surface, because subscriptions are exactly the friction that keeps that customer out. On top: a take rate on agent rentals, so we earn when customers earn; a share of the knowledge market, the 75-20-5 split; and B2B white-label as recurring platform revenue. Four lines, all tied to real work happening, all settling on-chain. We make money when the owner gets an outcome.",
    Component: SlideModel,
  },
  {
    hash: "cta",
    title: "Contact",
    budgetSeconds: 90,
    notes:
      "That is PerkOS: a working AI team in one click, real work done, settled on-chain, built on rails we own and proven live today. If you take one thing away: the AI is the easy part. We built everything around it, for the person who has no team and no time. Website perkos.xyz, we build in public on X at perk underscore os, and you can reach me by email. We are looking for partners who want teams in front of their users, pilots with real businesses, and backers who want to own this layer with us. I will stop here and take questions.",
    Component: SlideCta,
  },
];
