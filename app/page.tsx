import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Calculator,
  Check,
  Coffee,
  Coins,
  CreditCard,
  GraduationCap,
  Hammer,
  Handshake,
  HeartPulse,
  Home,
  Mail,
  MessageSquare,
  Moon,
  Palette,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AgentOrb } from "./components/AgentOrb";
import { ContactForm } from "./components/landing/ContactForm";
import { LandingAutoRoute } from "./components/LandingAutoRoute";
import { SmartCTA } from "./components/SmartCTA";

export const metadata: Metadata = {
  title: "PerkOS — Your business just hired its first team",
  description:
    "Pick your type of business and in two minutes you have a small AI team that handles the busywork — marketing, customer replies, research, the books — and checks with you first. They draft, you approve. No tech skills needed.",
};

// ============================================================================
// Page — the PerkOS landing (replacing perkos.xyz).
//
// Audience: NON-TECHNICAL small-business owners first (anxious about AI —
// user testing showed robot imagery + tech jargon scared them), investors /
// partners / developers second (one contained strip).
//
// Structure (strategy blueprint): hero → fear-killer → templates (the
// conversion centerpiece) → meet your team → how it works → expertise
// (authority without jargon) → beyond teams (AI services in general) →
// pricing teaser → builders strip → talk to us → final CTA.
//
// Vocabulary contract: teammates/team, drafts, you approve, set up, ready in
// minutes. Banned on this page: agent (as a buyer-facing noun), bot, robot,
// deploy, provision, infrastructure, blockchain/x402/token, LLM. "Agentic AI"
// appears exactly once — explained in plain words (expertise section).
// ============================================================================

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <LandingAutoRoute />
      <TopNav />
      <main className="flex-1">
        <Hero />
        <FearKillers />
        <Templates />
        <MeetYourTeam />
        <HowItWorks />
        <Expertise />
        <BeyondTeams />
        <Pricing />
        <InvestorsAndToken />
        <BuildersStrip />
        <TalkToUs />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

// ============================================================================
// Top nav
// ============================================================================

function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/perkos-header.png" alt="PerkOS" width={130} height={28} priority />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href="#templates" className="transition-colors hover:text-foreground">
            For your business
          </Link>
          <Link href="#how-it-works" className="transition-colors hover:text-foreground">
            How it works
          </Link>
          <Link href="#expertise" className="transition-colors hover:text-foreground">
            Why PerkOS
          </Link>
          <Link href="#pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          <Link href="#token" className="transition-colors hover:text-foreground">
            $PERKOS
          </Link>
          <Link href="#talk-to-us" className="transition-colors hover:text-foreground">
            Talk to us
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {/* Sign-in — works on web (email/wallet) and inside Base App /
              Farcaster, where SmartCTA picks up the host wallet. */}
          <SmartCTA
            href="/sign-in"
            className="inline-flex items-center rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
          >
            Sign in
          </SmartCTA>
          <SmartCTA
            href="/sign-in"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:px-4"
          >
            <span className="hidden sm:inline">Meet your team</span>
            <span className="sm:hidden">Start</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </SmartCTA>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// Hero
// ============================================================================

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 50% 120%, rgba(236,27,105,0.22) 0%, rgba(236,27,105,0.06) 45%, transparent 80%)",
        }}
      />
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-7 px-4 py-24 text-center md:py-36">
        <Badge
          variant="secondary"
          className="border-primary/30 bg-primary/10 text-xs uppercase tracking-wider text-primary"
        >
          Early access · Free to start
        </Badge>

        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-6xl">
          Your business just hired its{" "}
          <span className="bg-gradient-to-r from-primary to-amber-300 bg-clip-text text-transparent">
            first team
          </span>
          .
        </h1>

        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Pick your type of business, and in two minutes you have a small team
          that handles the busywork — and checks with you first.
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <SmartCTA
            href="/sign-in"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_0_24px_rgba(236,27,105,0.3)] transition-opacity hover:opacity-90"
          >
            Meet your team
            <ArrowRight className="h-4 w-4" />
          </SmartCTA>
          <Link
            href="#how-it-works"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-6 py-3 text-sm text-foreground transition-colors hover:border-primary/40"
          >
            See how it works
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-xs text-muted-foreground">
          <TrustChip label="You approve everything" />
          <TrustChip label="Ready in 2 minutes" />
          <TrustChip label="No tech skills needed" />
          <TrustChip label="Cancel anytime" />
        </div>
      </div>
    </section>
  );
}

function TrustChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Check className="h-3.5 w-3.5 text-primary" />
      {label}
    </span>
  );
}

// ============================================================================
// Fear-killer strip — disarm AI anxiety before asking for anything.
// ============================================================================

function FearKillers() {
  const items = [
    {
      Icon: ShieldCheck,
      title: "Nothing happens without your OK.",
      body: "Your team drafts and suggests — you review every piece before it goes anywhere.",
    },
    {
      Icon: Coffee,
      title: "If you can text, you can do this.",
      body: "Tell your team what you need in plain English. That's the whole job.",
    },
    {
      Icon: Moon,
      title: "Costs less than one hour of help.",
      body: "No contracts, no setup fees. When your team isn't working, you're barely paying.",
    },
  ];
  return (
    <section className="border-b border-border bg-card/30 py-12 md:py-16">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 md:grid-cols-3 md:px-8">
        {items.map(({ Icon, title, body }) => (
          <div key={title} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// Templates — the conversion centerpiece: self-identification.
// ============================================================================

type TemplatePitch = {
  name: string;
  pitch: string;
  Icon: LucideIcon;
  accent: string;
};

const TEMPLATE_PITCHES: TemplatePitch[] = [
  { name: "Restaurant", pitch: "For owners who'd rather cook than post: full tables, less screen time.", Icon: UtensilsCrossed, accent: "#fbbf24" },
  { name: "Real Estate", pitch: "For agents: listings polished and follow-ups sent while you're showing homes.", Icon: Home, accent: "#34d399" },
  { name: "Marketing Agency", pitch: "For agency owners: more client work delivered without more late nights.", Icon: Palette, accent: "#ec1b69" },
  { name: "Online Store", pitch: "For shop owners: product pages, promos, and customer replies handled.", Icon: ShoppingCart, accent: "#f97316" },
  { name: "Consulting Practice", pitch: "For consultants: proposals and research done while you're with clients.", Icon: Briefcase, accent: "#60a5fa" },
  { name: "Health & Wellness", pitch: "For studios and clinics: full classes and clients who come back.", Icon: HeartPulse, accent: "#2dd4bf" },
  { name: "Coaching & Courses", pitch: "For coaches: more students enrolled, less time promoting yourself.", Icon: GraduationCap, accent: "#a78bfa" },
  { name: "Trades & Contracting", pitch: "For contractors: quotes out fast and paperwork off your truck.", Icon: Hammer, accent: "#eab308" },
  { name: "Finance & Bookkeeping", pitch: "For bookkeepers: more clients served, every ledger still spotless.", Icon: Calculator, accent: "#22d3ee" },
  { name: "Local Services", pitch: "For salons, cleaners, and shops: a steady stream of bookings.", Icon: Sparkles, accent: "#e879f9" },
];

function Templates() {
  return (
    <section id="templates" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Built for businesses like yours.
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            Pick the one that sounds like you — your team arrives already
            knowing your kind of work.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATE_PITCHES.map(({ name, pitch, Icon, accent }) => (
            <SmartCTA
              key={name}
              href="/sign-in"
              className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card/60 p-5 text-left transition-colors hover:border-primary/50"
            >
              <span
                className="grid h-11 w-11 place-items-center rounded-xl"
                style={{ background: `${accent}22`, color: accent }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-base font-semibold text-foreground">{name}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">{pitch}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary opacity-70 transition-opacity group-hover:opacity-100">
                Meet this team
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </SmartCTA>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Don&apos;t see your business? Build a custom team in the same two
          minutes — or{" "}
          <Link href="#talk-to-us" className="text-primary underline-offset-2 hover:underline">
            tell us what you need
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// Meet your team — roles as job descriptions, badges not robots.
// ============================================================================

function MeetYourTeam() {
  const roles = [
    {
      name: "Team Lead",
      presetId: "pm",
      blurb:
        "Takes your goal, breaks it into a plan, hands out the work, and double-checks everything before it reaches you.",
    },
    {
      name: "Marketing teammate",
      presetId: "marketing",
      blurb:
        "Drafts your posts, emails, and promotions — in your voice — so something good goes out every week.",
    },
    {
      name: "Research teammate",
      presetId: "researcher",
      blurb:
        "Looks into competitors, prices, and trends, then hands you the short version you can act on.",
    },
    {
      name: "Bookkeeping teammate",
      presetId: "analyst",
      blurb:
        "Keeps your numbers tidy and flags what needs attention, so tax season stops being a surprise.",
    },
  ];
  return (
    <section className="border-b border-border bg-card/30 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Here&apos;s who shows up on day one.
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            Every team comes with the people a small business actually needs.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((r) => (
            <div
              key={r.name}
              className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center"
            >
              <AgentOrb name={r.name} presetId={r.presetId} size={64} />
              <span className="text-sm font-semibold text-foreground">{r.name}</span>
              <p className="text-sm leading-relaxed text-muted-foreground">{r.blurb}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Chat with any of them, swap them out, or add your own. It&apos;s your
          team.
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// How it works — three steps, zero diagrams.
// ============================================================================

function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Pick your business.",
      body: "Choose the template that matches what you do — your team is ready in about two minutes.",
    },
    {
      n: "2",
      title: "Say what you need.",
      body: "Type a goal in plain English, like “get more weekday lunch customers.” Your Team Lead turns it into a plan.",
    },
    {
      n: "3",
      title: "Review and approve.",
      body: "The team does the work and sends you drafts. You say yes, ask for changes, or say no. Always.",
    },
  ];
  return (
    <section id="how-it-works" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Up and running in minutes.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {s.n}
              </span>
              <h3 className="text-base font-semibold text-foreground">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <SmartCTA
            href="/sign-in"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Try it free
            <ArrowRight className="h-4 w-4" />
          </SmartCTA>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Expertise — authority shown, not claimed. "Agentic AI" appears ONCE,
// explained in plain words; a sophisticated reader sees the depth between
// the lines (autonomous planning, automated QA, scale-to-zero economics).
// ============================================================================

function Expertise() {
  const proofs = [
    {
      title: "They plan like a real team.",
      body: "Give one goal, and your Team Lead breaks it into tasks, assigns each to the right teammate, and tracks it through to done — no babysitting required.",
    },
    {
      title: "Weak work never reaches you.",
      body: "Every piece is checked before you see it. If something isn't good enough, it gets sent back and redone — automatically. You only review work worth reviewing.",
    },
    {
      title: "They work while you sleep — without running up a bill.",
      body: "Your team keeps making progress overnight, then rests when there's nothing to do. Resting time costs you almost nothing.",
    },
  ];
  return (
    <section id="expertise" className="border-b border-border bg-card/30 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Behind the friendly faces: serious AI.
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            PerkOS is built on <span className="text-foreground">agentic AI</span> —
            teams of AI workers that can plan, divide up a job, and finish it on
            their own, instead of waiting for instructions at every step.
            Here&apos;s what that means for you:
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {proofs.map((p) => (
            <div key={p.title} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-6">
              <Wand2 className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">{p.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted-foreground">
          This isn&apos;t a demo — the team that runs PerkOS is partly AI, on
          this same platform. And it&apos;s built on real research: 73% of small
          businesses say they want help getting AI to actually work.
          That&apos;s exactly what we built.
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// Beyond teams — AI services in general ("whatever AI your business needs").
// ============================================================================

function BeyondTeams() {
  return (
    <section className="border-b border-border py-20 md:py-28">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Whatever AI your business needs, we set it up.
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          Ready-made teams are just the start. We also build custom AI for
          businesses with bigger or more unusual needs — answering your
          customers, connecting the tools you already use, automating the work
          that eats your week. Already using AI somewhere else? Bring it with
          you; it&apos;ll fit right in.
        </p>
        <p className="text-base text-muted-foreground">
          You don&apos;t need to know what to ask for. Tell us the problem —
          we&apos;ll handle the rest.
        </p>
        <Link
          href="#talk-to-us"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
        >
          <MessageSquare className="h-4 w-4" />
          Talk to us
        </Link>
      </div>
    </section>
  );
}

// ============================================================================
// Pricing — value-framed plans. Serves BOTH audiences: cost transparency for
// the SMB owner (reassurance) and the revenue model for investors.
// ============================================================================

type Tier = {
  name: string;
  price: string;
  cadence: string;
  tag: string;
  bullets: string[];
  cta: string;
  ctaHref: string;
  smart?: boolean;
  featured?: boolean;
};

const TIERS: Tier[] = [
  {
    name: "Free",
    price: "Free",
    cadence: "for 7 days",
    tag: "Bring your own agents",
    bullets: [
      "Connect AI agents you already run",
      "Full workspace — board, docs, chat",
      "They draft, you approve — always",
      "Runs on your setup, free for a week",
    ],
    cta: "Start free",
    ctaHref: "/sign-in",
    smart: true,
  },
  {
    name: "Starter",
    price: "$9.99",
    cadence: "/ month",
    tag: "We host your team, you bring the AI",
    bullets: [
      "We run your team — nothing to install",
      "Bring your own AI key (OpenAI & more)",
      "You pay your AI provider directly",
      "Fair use: up to 500 team tasks / month",
    ],
    cta: "Start your team",
    ctaHref: "/sign-in",
    smart: true,
  },
  {
    name: "Pro",
    price: "$29.99",
    cadence: "/ month",
    tag: "We host your team and run the AI",
    bullets: [
      "We run your team AND the AI — zero setup",
      "No AI account needed",
      "Everything in Starter + priority support",
      "Fair use: up to 500 team tasks / month",
    ],
    cta: "Start your team",
    ctaHref: "/sign-in",
    smart: true,
    featured: true,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="border-b border-border bg-card/30 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Start free. It stays affordable.
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            A full team for the price of a streaming subscription — and a
            resting team costs almost nothing. Compare that to one part-time
            hire.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={cn(
                "relative flex flex-col gap-4 rounded-xl border bg-card p-6",
                t.featured
                  ? "border-primary/60 shadow-[0_0_32px_rgba(236,27,105,0.12)]"
                  : "border-border",
              )}
            >
              {t.featured ? (
                <Badge className="absolute -top-2.5 left-6 bg-primary text-[10px] uppercase text-primary-foreground">
                  Most popular
                </Badge>
              ) : null}
              <div className="flex flex-col gap-1">
                <span className="text-lg font-semibold text-foreground">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.tag}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tracking-tight text-foreground">{t.price}</span>
                {t.cadence ? (
                  <span className="text-sm text-muted-foreground">{t.cadence}</span>
                ) : null}
              </div>
              <ul className="flex flex-col gap-2.5">
                {t.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{b}</span>
                  </li>
                ))}
              </ul>
              {t.smart ? (
                <SmartCTA
                  href={t.ctaHref}
                  className={cn(
                    "mt-auto inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90",
                    t.featured
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-foreground hover:border-primary/40",
                  )}
                >
                  {t.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </SmartCTA>
              ) : (
                <Link
                  href={t.ctaHref}
                  className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
                >
                  {t.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Prefer to pay with $PERKOS? Save 15–25% —{" "}
          <Link href="#token" className="text-primary underline-offset-2 hover:underline">
            see the token
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// Investors & $PERKOS holders — ROI proof + the token (investment vehicle +
// in-app utility). A clearly self-selecting section: the scared SMB owner has
// already converted above; this serves the secondary audience honestly.
// ============================================================================

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

function InvestorsAndToken() {
  return (
    <section id="token" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Coins className="h-3.5 w-3.5" />
            For investors & $PERKOS holders
          </span>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            A real market, real economics, and a token to own it.
          </h2>
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
          <h3 className="text-xl font-semibold text-foreground">$PERKOS — pay, stake, and grow with the platform</h3>
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
              <h4 className="text-base font-medium text-foreground">{title}</h4>
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
  );
}

// ============================================================================
// Builders strip — the ONE contained place for secondary audiences.
// ============================================================================

function BuildersStrip() {
  const links = [
    {
      Icon: Handshake,
      title: "For partners",
      desc: "Integrations, runtimes, and bring-your-own AI.",
      href: "mailto:partner@perkos.xyz",
    },
    {
      Icon: Mail,
      title: "For developers",
      desc: "The platform under the hood — APIs, payment rails, docs.",
      href: "mailto:contact@perkos.xyz",
    },
  ];
  return (
    <section className="border-b border-border py-12">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <p className="mb-5 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Building something bigger?
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {links.map(({ Icon, title, desc, href }) => (
            <a
              key={title}
              href={href}
              className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{title}</span>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Talk to us — the human safety valve (form + contacts).
// ============================================================================

function TalkToUs() {
  const contacts = [
    { Icon: Mail, title: "General inquiries", value: "contact@perkos.xyz", href: "mailto:contact@perkos.xyz" },
    { Icon: Handshake, title: "Partnerships", value: "partner@perkos.xyz", href: "mailto:partner@perkos.xyz" },
    { Icon: Briefcase, title: "Investors", value: "invest@perkos.xyz", href: "mailto:invest@perkos.xyz" },
  ];

  return (
    <section id="talk-to-us" className="relative overflow-hidden border-b border-border py-20 md:py-28">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(236,27,105,0.12) 0%, transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center md:mb-16">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Rather talk to a person first?
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            Totally fair. Tell us about your business and what&apos;s eating
            your week — we&apos;ll tell you honestly whether (and how) AI can
            help.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            {contacts.map(({ Icon, title, value, href }) => (
              <a
                key={title}
                href={href}
                className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
              >
                <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{title}</span>
                  <span className="font-mono text-xs text-muted-foreground">{value}</span>
                </div>
              </a>
            ))}
            <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Follow along
              </span>
              <div className="flex flex-wrap gap-2">
                <Link href="https://x.com/perk_os" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40">
                  X / Twitter ↗
                </Link>
                <Link href="https://farcaster.xyz/perkos" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40">
                  Farcaster ↗
                </Link>
                <Link href="https://www.linkedin.com/company/perkos/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40">
                  LinkedIn ↗
                </Link>
              </div>
            </div>
          </div>

          <ContactForm />
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Final CTA
// ============================================================================

function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(236,27,105,0.25) 0%, rgba(236,27,105,0.05) 45%, transparent 80%)",
        }}
      />
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-7 px-4 text-center">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
          You&apos;ve been the whole team long enough.
        </h2>
        <p className="max-w-xl text-base text-muted-foreground">
          Two minutes from now, you could have help — help that drafts,
          suggests, and always asks before acting.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <SmartCTA
            href="/sign-in"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_0_24px_rgba(236,27,105,0.35)] transition-opacity hover:opacity-90"
          >
            Meet your team — free to start
            <ArrowRight className="h-4 w-4" />
          </SmartCTA>
          <Link
            href="#talk-to-us"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-6 py-3 text-sm text-foreground transition-colors hover:border-primary/40"
          >
            Talk to us first
          </Link>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Footer
// ============================================================================

function Footer() {
  return (
    <footer className="border-t border-border bg-card/40 py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="flex flex-col gap-3">
            <Link href="/" className="inline-flex items-center gap-2">
              <Image src="/perkos-header.png" alt="PerkOS" width={130} height={28} />
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              AI teams for small businesses. They draft, you approve.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="#templates" className="transition-colors hover:text-foreground">
              For your business
            </Link>
            <Link href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </Link>
            <Link href="#expertise" className="transition-colors hover:text-foreground">
              Why PerkOS
            </Link>
            <Link href="#talk-to-us" className="transition-colors hover:text-foreground">
              Contact
            </Link>
          </div>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          © {new Date().getFullYear()} PerkOS. Works in your browser, in Base
          App, and on Farcaster.
        </p>
      </div>
    </footer>
  );
}
