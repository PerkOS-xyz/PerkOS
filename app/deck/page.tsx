"use client";

/**
 * /deck — the public 6-slide product deck (no auth).
 *
 * Two modes:
 *  - Overview: slides stacked vertically, scaled to the viewport width.
 *  - Present: PowerPoint-style fullscreen — ←/→/Space/PgUp/PgDn/Home/End or
 *    click to navigate, Esc to exit. A thin progress bar tracks position.
 *
 * Slides are authored on a fixed 1280×720 canvas and scaled with a CSS
 * transform, so the layout is pixel-stable on any screen or projector.
 */

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Calculator,
  CheckCircle2,
  Compass,
  Cpu,
  Eye,
  HeartPulse,
  Megaphone,
  MonitorPlay,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";

const W = 1280;
const H = 720;

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

/** Circular head crop of the persona art — same technique as the app. */
function Head({ src, size, ring }: { src: string; size: number; ring?: string }) {
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden rounded-full bg-[#1a1228]"
      style={{ width: size, height: size, boxShadow: `0 0 0 3px ${ring ?? "#241a35"}` }}
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

function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-[3px] w-10 rounded-full bg-[#ec1b69]" />
      <span className="text-[15px] font-semibold uppercase tracking-[0.3em] text-[#ec1b69]">
        {children}
      </span>
    </div>
  );
}

function DotGrid() {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1.5px, transparent 1.5px)",
        backgroundSize: "26px 26px",
      }}
    />
  );
}

function SlideFrame({ children, footer }: { children: ReactNode; footer?: string }) {
  return (
    <div
      className="relative flex flex-col overflow-hidden bg-[#0b0512] text-[#ececff]"
      style={{ width: W, height: H }}
    >
      <DotGrid />
      {/* ambient glows */}
      <div aria-hidden className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-[#ec1b69]/12 blur-[120px]" />
      <div aria-hidden className="absolute -bottom-48 -right-32 h-[420px] w-[420px] rounded-full bg-[#7c3aed]/10 blur-[120px]" />
      <div className="relative z-10 flex h-full flex-col px-20 py-14">{children}</div>
      <div className="absolute inset-x-20 bottom-6 z-10 flex items-center justify-between text-[13px] text-[#7975a8]">
        <span className="flex items-center gap-2">
          <Image src="/logo.png" alt="" width={16} height={16} />
          PerkOS
        </span>
        <span>{footer ?? "perkos.xyz"}</span>
      </div>
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

function SlideTitle() {
  return (
    <SlideFrame footer="The AI workforce for small business">
      <div className="flex h-full items-center gap-16">
        <div className="flex max-w-[620px] flex-col gap-7">
          <Image src="/perkos-header.png" alt="PerkOS" width={210} height={72} />
          <h1 className="text-[76px] font-semibold leading-[1.02] tracking-tight">
            Hire your
            <br />
            <span className="text-[#ec1b69]">AI team.</span>
          </h1>
          <p className="text-[22px] leading-relaxed text-[#b9b4dd]">
            PerkOS launches a team of AI agents that runs your business ops —
            they plan, work, and report. You stay in charge.
          </p>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#ec1b69]/40 bg-[#ec1b69]/10 px-5 py-2 text-[15px] font-medium text-[#ec1b69]">
            <Sparkles className="h-4 w-4" /> perkos.xyz · built on Base
          </span>
        </div>

        {/* Team orbit */}
        <div className="relative h-[440px] w-[440px] shrink-0">
          <div aria-hidden className="absolute inset-0 rounded-full border border-[#ec1b69]/20" />
          <div aria-hidden className="absolute inset-[70px] rounded-full border border-[#7975a8]/20" />
          <div className="absolute left-1/2 top-1/2 z-10 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-3xl border border-[#ec1b69]/50 bg-[#140b1f] shadow-[0_0_60px_-10px_rgba(236,27,105,0.7)]">
            <Image src="/logo.png" alt="PerkOS" width={64} height={64} />
          </div>
          {ORBIT.map((src, i) => {
            const angle = -Math.PI / 2 + (i / ORBIT.length) * 2 * Math.PI;
            const r = 185;
            return (
              <span
                key={src}
                className="absolute"
                style={{
                  left: 220 + r * Math.cos(angle) - 39,
                  top: 220 + r * Math.sin(angle) - 39,
                }}
              >
                <Head src={src} size={78} ring={i === 0 ? "#ec1b69" : undefined} />
              </span>
            );
          })}
        </div>
      </div>
    </SlideFrame>
  );
}

const JOBS = [
  { Icon: Megaphone, label: "Growth", hue: 330 },
  { Icon: Bot, label: "Customer support", hue: 160 },
  { Icon: Calculator, label: "Bookkeeping", hue: 200 },
  { Icon: HeartPulse, label: "Scheduling", hue: 270 },
  { Icon: Search, label: "Research", hue: 40 },
];

function SlideProblem() {
  return (
    <SlideFrame footer="02 — The problem">
      <Kicker>The problem</Kicker>
      <h2 className="mt-6 max-w-[900px] text-[54px] font-semibold leading-[1.08] tracking-tight">
        Running a small business is{" "}
        <span className="text-[#ec1b69]">five jobs at once.</span>
      </h2>
      <div className="mt-12 flex flex-1 items-start gap-16">
        <div className="flex w-[420px] flex-col gap-4">
          {JOBS.map(({ Icon, label, hue }, i) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-2xl border border-[#1b1833] bg-[#0e0716]/80 px-6 py-4"
              style={{ marginLeft: i * 18 }}
            >
              <span
                className="grid h-11 w-11 place-items-center rounded-xl"
                style={{ background: `hsla(${hue},75%,60%,0.15)`, color: `hsl(${hue},75%,65%)` }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[20px] font-medium">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex max-w-[520px] flex-col gap-8 pt-4">
          <p className="text-[24px] leading-relaxed text-[#b9b4dd]">
            Owners spend their evenings on ops instead of customers. AI was
            supposed to help — but a chatbot answers questions.{" "}
            <span className="text-[#ececff]">It doesn&apos;t do the work.</span>
          </p>
          <div className="rounded-2xl border border-[#ec1b69]/30 bg-[#ec1b69]/8 p-7">
            <p className="text-[26px] font-semibold leading-snug">
              You don&apos;t need another tool.
              <br />
              <span className="text-[#ec1b69]">You need staff.</span>
            </p>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}

function SlideHow() {
  const steps = [
    {
      n: "1",
      title: "Pick a business template",
      copy: "Ten ready-made teams — Restaurant, Real Estate, Health, Online Store… — each a curated team of roles for that business.",
      visual: (
        <div className="flex items-center -space-x-3">
          {ORBIT.slice(0, 4).map((s, i) => (
            <Head key={s} src={s} size={56} ring={i === 0 ? "#ec1b69" : undefined} />
          ))}
        </div>
      ),
    },
    {
      n: "2",
      title: "Launch your team",
      copy: "Your agents come online in minutes — each with its own role, persona, and skills. No setup, no servers.",
      visual: (
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-[15px] font-medium text-emerald-300">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> 4 agents online
        </span>
      ),
    },
    {
      n: "3",
      title: "Put the team to work",
      copy: "Your Team Lead reads the goal, plans it into tasks, and the team executes — while you watch it happen live.",
      visual: (
        <span className="inline-flex items-center gap-2 rounded-full bg-[#ec1b69] px-5 py-2 text-[15px] font-semibold text-white shadow-[0_0_30px_-6px_rgba(236,27,105,0.9)]">
          <Sparkles className="h-4 w-4" /> Put the team to work
        </span>
      ),
    },
  ];
  return (
    <SlideFrame footer="03 — How it works">
      <Kicker>How it works</Kicker>
      <h2 className="mt-6 text-[54px] font-semibold leading-tight tracking-tight">
        From idea to working team in <span className="text-[#ec1b69]">three clicks.</span>
      </h2>
      <div className="mt-14 grid flex-1 grid-cols-3 gap-8">
        {steps.map((s) => (
          <div
            key={s.n}
            className="flex flex-col gap-5 rounded-3xl border border-[#1b1833] bg-[#0e0716]/80 p-8"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ec1b69]/15 text-[24px] font-bold text-[#ec1b69]">
              {s.n}
            </span>
            <h3 className="text-[26px] font-semibold leading-snug">{s.title}</h3>
            <p className="text-[17px] leading-relaxed text-[#b9b4dd]">{s.copy}</p>
            <div className="mt-auto">{s.visual}</div>
          </div>
        ))}
      </div>
      <p className="mt-8 flex items-center gap-2 text-[18px] text-[#b9b4dd]">
        <ShieldCheck className="h-5 w-5 text-emerald-300" />
        Your team drafts and suggests — <span className="font-semibold text-[#ececff]">nothing happens without your OK.</span>
      </p>
    </SlideFrame>
  );
}

function MiniCard({ title, agent, tone, result }: { title: string; agent: string; tone: "todo" | "doing" | "done"; result?: string }) {
  return (
    <div
      className={
        "rounded-xl border bg-[#0e0716] px-4 py-3 " +
        (tone === "done"
          ? "border-emerald-500/40"
          : tone === "doing"
            ? "border-amber-500/40"
            : "border-[#1b1833]")
      }
    >
      <p className="text-[14px] font-medium leading-snug">{title}</p>
      <p className="mt-1 text-[12px] text-[#7975a8]">Agent: {agent}</p>
      {result ? (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-emerald-200/70">{result}</p>
      ) : null}
    </div>
  );
}

function SlideVisibility() {
  const feed = [
    { who: "Cafe-Manager", what: "completed Price the signature menu", t: "2m", done: true },
    { who: "Team Lead", what: "planned 4 tasks · round 1", t: "6m" },
    { who: "Recipe-Researcher", what: "started Map local suppliers", t: "9m" },
    { who: "Cafe-Promoter", what: "came online", t: "12m" },
  ];
  return (
    <SlideFrame footer="04 — Live visibility">
      <Kicker>Live visibility</Kicker>
      <h2 className="mt-6 text-[54px] font-semibold leading-tight tracking-tight">
        Watch your team work — <span className="text-[#ec1b69]">live.</span>
      </h2>
      <div className="mt-12 grid flex-1 grid-cols-[1.2fr_1fr] gap-10">
        {/* mini kanban */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { col: "To do", cards: [<MiniCard key="a" title="Write the landlord pitch" agent="Cafe-Promoter" tone="todo" />] },
            { col: "In progress", cards: [
              <MiniCard key="b" title="Draft opening-week social calendar" agent="Cafe-Promoter" tone="doing" />,
              <MiniCard key="c" title="Plan friends-and-family tasting" agent="Cafe-Manager" tone="doing" />,
            ] },
            { col: "Done", cards: [
              <MiniCard key="d" title="Price the signature menu" agent="Cafe-Manager" tone="done" result="Menu priced at 70% target margin; two recipes flagged for a cost tweak." />,
              <MiniCard key="e" title="Shortlist 5 signature recipes" agent="Recipe-Researcher" tone="done" result="Top pick: cardamom bun — 68% margin." />,
            ] },
          ].map(({ col, cards }) => (
            <div key={col} className="flex flex-col gap-3">
              <span className="rounded-lg border border-[#1b1833] bg-[#0e0716] px-3 py-2 text-[14px] font-medium">
                {col}
              </span>
              {cards}
            </div>
          ))}
        </div>
        {/* feed + stats */}
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-[#1b1833] bg-[#0e0716]/80 p-5">
            <p className="mb-3 flex items-center justify-between text-[13px] font-semibold uppercase tracking-wider text-[#7975a8]">
              Recent activity
              <span className="rounded-full border border-[#ec1b69]/40 bg-[#ec1b69]/10 px-2 py-0.5 font-mono text-[10px] normal-case text-[#ec1b69]">live</span>
            </p>
            <div className="flex flex-col gap-2.5">
              {feed.map((f) => (
                <p key={f.what} className="flex items-baseline gap-2 text-[14px]">
                  {f.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-emerald-300" />
                  ) : (
                    <Compass className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-[#ec1b69]" />
                  )}
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{f.who}</span>{" "}
                    <span className="text-[#b9b4dd]">{f.what}</span>
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[11px] text-[#7975a8]">{f.t}</span>
                </p>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6 rounded-2xl border border-[#1b1833] bg-[#0e0716]/80 p-5">
            <Eye className="h-8 w-8 shrink-0 text-[#ec1b69]" />
            <p className="text-[17px] leading-relaxed text-[#b9b4dd]">
              Every result on the card. Every step in the feed. A live map of
              who&apos;s doing what —{" "}
              <span className="text-[#ececff]">no black box.</span>
            </p>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}

function SlideDifferent() {
  const items = [
    {
      Icon: Compass,
      title: "A real team, not a chatbot",
      copy: "A Team Lead plans and delegates; specialist agents execute. Work is structured — tasks, reviews, results.",
    },
    {
      Icon: BadgeCheck,
      title: "You approve everything",
      copy: "Agents draft and suggest; plans wait for your sign-off. Human-in-the-loop by design, not as an afterthought.",
    },
    {
      Icon: Cpu,
      title: "Your AI or ours",
      copy: "Run on PerkOS-hosted models, or bring your own OpenAI-compatible key. Switch any time.",
    },
    {
      Icon: Wallet,
      title: "Wallet-native on Base",
      copy: "Sign in with a smart wallet, pay in USDC or $PERKOS. Agents rest when idle — you don't pay for idle time.",
    },
  ];
  return (
    <SlideFrame footer="05 — Why PerkOS">
      <Kicker>Why PerkOS</Kicker>
      <h2 className="mt-6 text-[54px] font-semibold leading-tight tracking-tight">
        Built <span className="text-[#ec1b69]">different.</span>
      </h2>
      <div className="mt-14 grid flex-1 grid-cols-2 gap-8">
        {items.map(({ Icon, title, copy }) => (
          <div key={title} className="flex gap-6 rounded-3xl border border-[#1b1833] bg-[#0e0716]/80 p-8">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#ec1b69]/15 text-[#ec1b69]">
              <Icon className="h-7 w-7" />
            </span>
            <div>
              <h3 className="text-[24px] font-semibold leading-snug">{title}</h3>
              <p className="mt-2 text-[17px] leading-relaxed text-[#b9b4dd]">{copy}</p>
            </div>
          </div>
        ))}
      </div>
    </SlideFrame>
  );
}

function SlidePricing() {
  const tiers = [
    { name: "Free", price: "$0", tag: "7 days · bring your own agents", featured: false },
    { name: "Starter", price: "$29.97", tag: "50 Infra hours · BYOK", featured: false },
    { name: "Pro", price: "$89.97", tag: "150 Infra hours · prepaid Managed AI", featured: true },
    { name: "Scale", price: "$239.97", tag: "500 Infra hours · prepaid Managed AI", featured: false },
  ];
  return (
    <SlideFrame footer="06 — Get started">
      <Kicker>Pricing</Kicker>
      <h2 className="mt-6 text-[54px] font-semibold leading-tight tracking-tight">
        Staff for the price of <span className="text-[#ec1b69]">lunch.</span>
      </h2>
      <div className="mt-12 grid grid-cols-4 gap-6">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={
              "flex flex-col gap-2 rounded-3xl border p-7 " +
              (t.featured
                ? "border-[#ec1b69]/60 bg-[#ec1b69]/8 shadow-[0_0_50px_-12px_rgba(236,27,105,0.55)]"
                : "border-[#1b1833] bg-[#0e0716]/80")
            }
          >
            <span className="text-[15px] font-semibold uppercase tracking-wider text-[#7975a8]">
              {t.name}
            </span>
            <span className="text-[40px] font-semibold leading-none">
              {t.price}
              {t.price !== "$0" ? <span className="text-[16px] text-[#7975a8]"> /mo</span> : null}
            </span>
            <span className="text-[14px] leading-snug text-[#b9b4dd]">{t.tag}</span>
            {t.featured ? (
              <span className="mt-2 w-fit rounded-full bg-[#ec1b69] px-3 py-1 text-[12px] font-semibold text-white">
                Most popular
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between rounded-3xl border border-[#ec1b69]/40 bg-gradient-to-r from-[#ec1b69]/15 to-transparent px-10 py-7">
        <p className="text-[30px] font-semibold">
          Launch your team today — <span className="text-[#ec1b69]">perkos.xyz</span>
        </p>
        <ArrowRight className="h-9 w-9 text-[#ec1b69]" />
      </div>
    </SlideFrame>
  );
}

const SLIDES = [SlideTitle, SlideProblem, SlideHow, SlideVisibility, SlideDifferent, SlidePricing];

// ---------------------------------------------------------------------------
// Page: overview + present mode
// ---------------------------------------------------------------------------

export default function DeckPage() {
  const [presenting, setPresenting] = useState(false);
  const [current, setCurrent] = useState(0);
  const [scale, setScale] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);

  // Present-mode scale: fit the 1280×720 canvas into the viewport.
  useEffect(() => {
    if (!presenting) return;
    const fit = () =>
      setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [presenting]);

  const enterPresent = useCallback((at = 0) => {
    setCurrent(at);
    setPresenting(true);
    // Real fullscreen when the browser allows it; the fixed overlay is the fallback.
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const exitPresent = useCallback(() => {
    setPresenting(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return exitPresent();
      if (["ArrowRight", " ", "PageDown", "Enter"].includes(e.key)) {
        e.preventDefault();
        setCurrent((c) => Math.min(c + 1, SLIDES.length - 1));
      } else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        setCurrent((c) => Math.max(c - 1, 0));
      } else if (e.key === "Home") setCurrent(0);
      else if (e.key === "End") setCurrent(SLIDES.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, exitPresent]);

  // Leaving browser fullscreen (e.g. via Esc handled by the browser) exits too.
  useEffect(() => {
    if (!presenting) return;
    const onFs = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [presenting]);

  if (presenting) {
    const Slide = SLIDES[current];
    return (
      <div
        ref={stageRef}
        className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black"
        onClick={() => setCurrent((c) => Math.min(c + 1, SLIDES.length - 1))}
      >
        {/* progress */}
        <div className="absolute inset-x-0 top-0 z-20 h-1 bg-white/10">
          <div
            className="h-full bg-[#ec1b69] transition-[width] duration-300"
            style={{ width: `${((current + 1) / SLIDES.length) * 100}%` }}
          />
        </div>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
          <Slide />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            exitPresent();
          }}
          aria-label="Exit presentation"
          className="absolute right-5 top-5 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/70 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="absolute bottom-5 right-6 z-20 font-mono text-sm text-white/50">
          {current + 1} / {SLIDES.length}
        </span>
        <span className="absolute bottom-5 left-6 z-20 text-xs text-white/30">
          ← → navigate · Esc exit
        </span>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#08030d] pb-24 text-[#ececff]">
      {/* top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#1b1833] bg-[#08030d]/90 px-6 py-4 backdrop-blur">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/perkos-header.png" alt="PerkOS" width={120} height={40} />
          <span className="rounded-full border border-[#1b1833] px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-[#7975a8]">
            Product deck
          </span>
        </Link>
        <button
          type="button"
          onClick={() => enterPresent(0)}
          className="inline-flex items-center gap-2 rounded-full bg-[#ec1b69] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_30px_-8px_rgba(236,27,105,0.9)] transition-opacity hover:opacity-90"
        >
          <MonitorPlay className="h-4 w-4" />
          Present
        </button>
      </header>

      <div className="mx-auto flex max-w-[1080px] flex-col gap-10 px-6 pt-10">
        <p className="text-sm text-[#7975a8]">
          6 slides · click any slide to present from there · ← → to navigate,
          Esc to exit
        </p>
        {SLIDES.map((Slide, i) => (
          <ScaledSlide key={i} index={i} onPresent={() => enterPresent(i)}>
            <Slide />
          </ScaledSlide>
        ))}
      </div>
    </main>
  );
}

/** Overview wrapper: scales the fixed 1280×720 slide to the container width. */
function ScaledSlide({
  children,
  index,
  onPresent,
}: {
  children: ReactNode;
  index: number;
  onPresent: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-xs text-[#7975a8]">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={onPresent}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onPresent();
        }}
        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[#1b1833] transition-colors hover:border-[#ec1b69]/50"
        style={{ height: scale > 0 ? H * scale : undefined, aspectRatio: scale > 0 ? undefined : "16/9" }}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: W, height: H }}>
          {children}
        </div>
        <span className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <Play className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}
