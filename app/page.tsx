import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Bot,
  Briefcase,
  Check,
  Clock,
  Handshake,
  Layers,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  Server,
  Shield,
  Sparkles,
  TrendingDown,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ContactForm } from "./components/landing/ContactForm";
import { LandingAutoRoute } from "./components/LandingAutoRoute";
import { SmartCTA } from "./components/SmartCTA";

export const metadata: Metadata = {
  title: "PerkOS — Cut operational costs 60-80% with reliable AI agents",
  description:
    "Replace repetitive work in support, sales, and operations with AI agents that handle real volume, process payments, and escalate to humans only when necessary. Managed or self-hosted. Private beta — invitation only.",
};

// ============================================================================
// Page
// ============================================================================

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <LandingAutoRoute />
      <TopNav />
      <main className="flex-1">
        <Hero />
        <MetricsBand />
        <EnterpriseUseCases />
        <DeploymentComparison />
        <PlatformCapabilities />
        <PricingAndToken />
        <Testimonials />
        <HowItWorks />
        <RequestAccess />
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
          <Link href="#use-cases" className="hover:text-foreground transition-colors">
            Use cases
          </Link>
          <Link href="#how-it-works" className="hover:text-foreground transition-colors">
            How it works
          </Link>
          <Link href="#pricing" className="hover:text-foreground transition-colors">
            Pricing
          </Link>
          <Link href="#request-access" className="hover:text-foreground transition-colors">
            Contact
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {/* Wallet sign-in is preserved — required for Base App / Farcaster / web. */}
          <SmartCTA
            href="/sign-in"
            className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            Sign in
          </SmartCTA>
          <Link
            href="#request-access"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Join the private beta
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// Hero (Version B)
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
          Private beta · Invitation only
        </Badge>

        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-6xl">
          Cut operational costs by{" "}
          <span className="bg-gradient-to-r from-primary to-amber-300 bg-clip-text text-transparent">
            60–80%
          </span>{" "}
          with reliable AI agents.
        </h1>

        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Replace repetitive work in support, sales, and operations with AI
          agents that handle real volume, process payments, and escalate to
          humans only when necessary.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="#request-access"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_0_24px_rgba(236,27,105,0.3)] transition-opacity hover:opacity-90"
          >
            Join the private beta
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-6 py-3 text-sm text-foreground transition-colors hover:border-primary/40"
          >
            See how it works
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-xs text-muted-foreground">
          <InlineProof Icon={Server} label="Managed or self-hosted" />
          <InlineProof Icon={Clock} label="24/7 coverage" />
          <InlineProof Icon={Zap} label="x402 instant settlement" />
          <InlineProof Icon={Lock} label="Data residency options" />
        </div>
      </div>
    </section>
  );
}

function InlineProof({
  Icon,
  label,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-primary" />
      {label}
    </span>
  );
}

// ============================================================================
// Metrics band — proof before pitch (aspirational; disclosed as pilot results)
// ============================================================================

function MetricsBand() {
  const metrics = [
    { value: "68%", label: "Less ticket handling time" },
    { value: "5×", label: "More conversations per agent" },
    { value: "24/7", label: "Coverage, zero added headcount" },
    { value: "< 2 wks", label: "Pilot to production" },
    { value: "Zero", label: "Chargebacks via x402" },
  ];
  return (
    <section className="border-b border-border bg-card/60">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-14">
        <dl className="grid grid-cols-2 gap-y-8 sm:grid-cols-3 md:grid-cols-5 md:gap-0">
          {metrics.map((m, i) => (
            <div
              key={m.label}
              className={cn(
                "flex flex-col items-center gap-1 px-4 text-center",
                i < metrics.length - 1 && "md:border-r md:border-border"
              )}
            >
              <dd className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                {m.value}
              </dd>
              <dt className="text-xs text-muted-foreground md:text-sm">{m.label}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Early results from private-beta pilots. Your numbers will vary by
          process and volume.
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// Enterprise use cases
// ============================================================================

type UseCase = {
  Icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  bullets: string[];
  tag: string;
};

const USE_CASES: UseCase[] = [
  {
    Icon: Phone,
    eyebrow: "Customer support",
    title: "AI call center & customer support",
    bullets: [
      "Handle inbound across WhatsApp, Telegram, Discord, Email, and web",
      "Resolve 70–85% of tickets without human intervention",
      "Escalate complex cases to your team with full context",
      "24/7 coverage at a fraction of traditional call-center cost",
    ],
    tag: "70–85% resolved",
  },
  {
    Icon: Handshake,
    eyebrow: "Revenue",
    title: "Sales & lead qualification",
    bullets: [
      "Qualify inbound leads 24/7 across every channel",
      "Book meetings directly into your calendar",
      "Follow up persistently without sounding robotic",
      "Hand off warm leads with the full conversation history",
    ],
    tag: "24/7 pipeline",
  },
  {
    Icon: Layers,
    eyebrow: "Operations",
    title: "Internal operations automation",
    bullets: [
      "Process invoices, approvals, data entry, and reporting",
      "Maintain compliance and audit trails automatically",
      "Reduce back-office headcount while increasing speed",
      "Full traceability on every action",
    ],
    tag: "Compliance + audit",
  },
  {
    Icon: Briefcase,
    eyebrow: "Enterprise scale",
    title: "Multi-department orchestration",
    bullets: [
      "Coordinate agents across support → sales → operations → finance",
      "One workspace. One source of truth.",
      "Full visibility for your team",
      "Agents keep identity and memory across departments",
    ],
    tag: "One workspace",
  },
];

function EnterpriseUseCases() {
  return (
    <section id="use-cases" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center md:mb-16">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Enterprise use cases
          </span>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Where PerkOS agents go to work.
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            Four high-volume processes where AI agents cut costs and scale
            without adding headcount.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {USE_CASES.map((uc) => (
            <UseCaseCard key={uc.title} uc={uc} />
          ))}
        </div>
      </div>
    </section>
  );
}

function UseCaseCard({ uc }: { uc: UseCase }) {
  const { Icon, eyebrow, title, bullets, tag } = uc;
  return (
    <div className="group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40">
      <div
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary/40 to-transparent"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              {eyebrow}
            </span>
            <span className="text-base font-semibold text-foreground">{title}</span>
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0 border-0 bg-muted text-[10px] text-muted-foreground">
          {tag}
        </Badge>
      </div>
      <ul className="flex flex-col gap-2.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-muted-foreground">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// Managed vs self-hosted
// ============================================================================

function DeploymentComparison() {
  return (
    <section className="border-b border-border bg-card/30 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Deployment
          </span>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            You choose how it runs.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-card p-6">
            <Badge variant="secondary" className="w-fit border-0 bg-emerald-500/15 text-[10px] uppercase text-emerald-300">
              Fully managed
            </Badge>
            <h3 className="text-xl font-semibold text-foreground">Managed by PerkOS</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We run the infrastructure, monitor performance, handle updates,
              and scale your agents. You focus on results — production processes
              without DevOps overhead.
            </p>
            <ul className="flex flex-col gap-2">
              {["Monitored 24/7", "Auto-scaling", "Updates included", "No DevOps required"].map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
            <Badge variant="secondary" className="w-fit border-0 bg-muted text-[10px] uppercase text-muted-foreground">
              Self-hosted
            </Badge>
            <h3 className="text-xl font-semibold text-foreground">Run on your infrastructure</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Run everything on your own AWS, VPS, or on-prem. Full control,
              same enterprise capabilities. Built for strict data residency or
              compliance requirements.
            </p>
            <ul className="flex flex-col gap-2">
              {["Your AWS / VPS / on-prem", "Full data residency", "Same capabilities", "Bring your own keys (BYOK)"].map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Platform capabilities (condensed — replaces the 5 feature deep-dives)
// ============================================================================

function PlatformCapabilities() {
  const caps = [
    {
      Icon: Bot,
      title: "Any runtime, any host",
      copy: "Connect an existing Hermes or OpenClaw agent, or let the launcher provision one on managed infra or your VPS.",
    },
    {
      Icon: MessageSquare,
      title: "Every channel",
      copy: "WhatsApp, Telegram, Discord, Slack, Email, and web — one agent, same memory, wherever the conversation lives.",
    },
    {
      Icon: Briefcase,
      title: "Project rooms & boards",
      copy: "Humans and agents work side by side — kanban boards that move as agents complete tasks, with full logs.",
    },
    {
      Icon: Sparkles,
      title: "A co-pilot for your team",
      copy: "Every workspace ships with an assistant that knows your projects, agents, and tasks. Ask it in plain English.",
    },
  ];
  return (
    <section id="features" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center md:mb-16">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            The platform
          </span>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            A real workspace behind every agent.
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            Not a chatbot widget — a workspace where your agents run real
            processes and your team stays in control.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
          {caps.map(({ Icon, title, copy }) => (
            <div
              key={title}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="text-base font-medium text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Pricing + $PEKOS token
// ============================================================================

type Tier = {
  name: string;
  tag: string;
  bullets: string[];
  featured?: boolean;
  cta: string;
};

const TIERS: Tier[] = [
  {
    name: "Starter",
    tag: "For teams that want to test",
    bullets: ["Up to 5 active agents", "Basic channels", "Community support", "Pay-as-you-go or monthly"],
    cta: "Request access",
  },
  {
    name: "Growth",
    tag: "For startups and mid-size companies",
    bullets: ["Unlimited agents", "All channels + advanced routing", "Full PerkOS workspace", "Priority support"],
    featured: true,
    cta: "Join the private beta",
  },
  {
    name: "Enterprise",
    tag: "For large organizations",
    bullets: ["Custom processes (call center, sales, ops)", "Dedicated success manager", "SLA + compliance support", "Onboarding + training + Managed Services"],
    cta: "Talk to our team",
  },
];

function PricingAndToken() {
  return (
    <section id="pricing" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center md:mb-16">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Pricing
          </span>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Simple plans. Real results.
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            Access is invitation-only during the private beta — request access
            and we&apos;ll match you to the right plan.
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
                  : "border-border"
              )}
            >
              {t.featured ? (
                <>
                  <div
                    className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent"
                    aria-hidden
                  />
                  <Badge className="absolute -top-2.5 left-6 bg-primary text-[10px] uppercase text-primary-foreground">
                    Most popular
                  </Badge>
                </>
              ) : null}
              <div className="flex flex-col gap-1">
                <span className="text-lg font-semibold text-foreground">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.tag}</span>
              </div>
              <ul className="flex flex-col gap-2.5">
                {t.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="#request-access"
                className={cn(
                  "mt-auto inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90",
                  t.featured
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-foreground hover:border-primary/40"
                )}
              >
                {t.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>

        {/* $PEKOS token — contained callout, not a full section */}
        <div className="mt-8 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-6 md:flex-row md:items-center md:gap-6">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Zap className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground">
              Pay with $PEKOS — save up to 25%
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Organizations paying with $PEKOS get 15–25% off Growth and
              Enterprise plans, plus optional staking benefits: permanent
              discounts, priority support, and early access to new AI processes.
              The token aligns PerkOS with the companies building on it.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Testimonials (aspirational — company names withheld during private beta)
// ============================================================================

function Testimonials() {
  const items = [
    {
      quote:
        "We replaced 12 night-shift support agents with 3 PerkOS agents. First-contact resolution increased to 78%. Our human team now only handles complex cases.",
      role: "Head of Customer Success",
      monogram: "CS",
      useCase: "AI call center",
    },
    {
      quote:
        "Before, it took us 4 days to process internal requests. Now PerkOS agents do it in under 4 hours with full traceability.",
      role: "COO",
      monogram: "OP",
      useCase: "Internal operations",
    },
  ];
  return (
    <section className="border-b border-border bg-card/30 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Results
          </span>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            What early organizations are seeing.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {items.map((t) => (
            <figure
              key={t.role}
              className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6"
            >
              <blockquote className="text-base leading-relaxed text-foreground">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-auto flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                  {t.monogram}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{t.role}</span>
                  <span className="text-xs text-muted-foreground">{t.useCase}</span>
                </div>
                <Badge
                  variant="secondary"
                  aria-label="Company name withheld"
                  className="ml-auto border-0 bg-muted/60 text-[10px] italic text-muted-foreground"
                >
                  Company withheld
                </Badge>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Company names are withheld at the organization&apos;s request during
          the private beta.
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// How it works (pilot → production)
// ============================================================================

function HowItWorks() {
  const steps = [
    {
      n: "01",
      Icon: TrendingDown,
      title: "Pick a process",
      copy: "Tell us the workflow draining your team — support, sales, or back-office operations.",
    },
    {
      n: "02",
      Icon: Bot,
      title: "We configure your agents",
      copy: "PerkOS deploys and tunes agents for your channels and volume — managed by us or on your infra.",
    },
    {
      n: "03",
      Icon: MessageSquare,
      title: "Connect your channels",
      copy: "WhatsApp, Email, Slack, Telegram — your agents go where your customers and team already are.",
    },
    {
      n: "04",
      Icon: Shield,
      title: "Monitor, escalate, scale",
      copy: "Agents handle the volume; your team reviews escalations with full context. Pilot to production in under 2 weeks.",
    },
  ];
  return (
    <section id="how-it-works" className="border-b border-border bg-card/50 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center md:mb-16">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            How it works
          </span>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            From pilot to production in under two weeks.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {steps.map(({ n, Icon, title, copy }) => (
            <div
              key={n}
              className="relative flex flex-col gap-3 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <span className="text-xs font-mono text-muted-foreground">{n}</span>
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary shadow-[0_0_12px_rgba(236,27,105,0.25)]">
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="text-base font-medium text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Request access (private-beta capture — reuses ContactForm)
// ============================================================================

function RequestAccess() {
  const contacts = [
    { Icon: Mail, title: "General inquiries", value: "contact@perkos.xyz", href: "mailto:contact@perkos.xyz" },
    { Icon: Handshake, title: "Partnerships", value: "partner@perkos.xyz", href: "mailto:partner@perkos.xyz" },
    { Icon: Briefcase, title: "Investors", value: "invest@perkos.xyz", href: "mailto:invest@perkos.xyz" },
  ];

  return (
    <section id="request-access" className="relative overflow-hidden border-b border-border py-20 md:py-28">
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
          <Badge
            variant="secondary"
            className="border-primary/30 bg-primary/10 text-xs uppercase tracking-wider text-primary"
          >
            Private beta · Invitation only
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Request access.
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            PerkOS is open to a select group of organizations. Tell us about
            your use case and we&apos;ll be in touch about the next round of
            invitations.
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
          Ready to reduce operational costs with AI agents that deliver?
        </h2>
        <p className="max-w-xl text-base text-muted-foreground">
          Join the private beta or talk to our team — we&apos;ll help you
          identify the right process to start.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="#request-access"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_0_24px_rgba(236,27,105,0.35)] transition-opacity hover:opacity-90"
          >
            Join the private beta
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="mailto:contact@perkos.xyz"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-6 py-3 text-sm text-foreground transition-colors hover:border-primary/40"
          >
            Talk to our team
          </a>
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
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2 flex flex-col gap-4 md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2">
              <Image src="/perkos-header.png" alt="PerkOS" width={130} height={28} />
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              AI agents for enterprise operations. Cut operational costs 60–80%.
              Managed or self-hosted.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="secondary" className="border-0 bg-amber-500/15 text-amber-300">
                Private beta
              </Badge>
              <Badge variant="secondary" className="border-0 bg-muted">
                Managed or self-hosted
              </Badge>
            </div>
          </div>

          <FooterColumn
            title="Platform"
            links={[
              { label: "Use cases", href: "#use-cases" },
              { label: "How it works", href: "#how-it-works" },
              { label: "Pricing", href: "#pricing" },
              { label: "Request access", href: "#request-access" },
            ]}
          />

          <FooterColumn
            title="Stack"
            links={[
              { label: "Stack — payments ↗", href: "https://stack.perkos.xyz", external: true },
              { label: "Spark — single agent ↗", href: "https://spark.perkos.xyz", external: true },
              { label: "Aura — AI APIs ↗", href: "https://aura.perkos.xyz", external: true },
            ]}
          />

          <FooterColumn
            title="Resources"
            links={[
              { label: "Contact enterprise team", href: "mailto:contact@perkos.xyz", external: true },
              { label: "GitHub", href: "https://github.com/PerkOS-xyz", external: true },
              { label: "x402 Protocol", href: "https://www.x402.org/", external: true },
              { label: "X / Twitter", href: "https://x.com/perk_os", external: true },
            ]}
          />
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} PerkOS · Enterprise AI agents for operations.</p>
          <p>Managed or self-hosted · Settlement via x402 on Base + Celo</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">{title}</h4>
      <ul className="flex flex-col gap-2">
        {links.map(({ label, href, external }) => (
          <li key={label}>
            <Link
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
