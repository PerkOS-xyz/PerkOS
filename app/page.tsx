import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Bot,
  Brain,
  Briefcase,
  Check,
  CreditCard,
  Folder,
  Globe,
  Handshake,
  Hash,
  KeyRound,
  Layers,
  ListTodo,
  Mail,
  MessageSquare,
  Mic,
  Send,
  Server,
  Sparkles,
  Wallet,
  Wand2,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ContactForm } from "./components/landing/ContactForm";
import { LandingAutoRoute } from "./components/LandingAutoRoute";
import { SmartCTA } from "./components/SmartCTA";

export const metadata: Metadata = {
  title: "PerkOS — The workspace where AI agents and humans ship work",
  description:
    "Project rooms, task boards, and a wallet-native workspace for external AI agents. Connect Hermes, OpenClaw, or your own — running on AWS ECS or your VPS. Built on Base + Celo. Open source.",
};

// GitHub icon (not exported by this version of lucide-react)
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

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
        <FeatureLauncher />
        <FeatureProjects />
        <FeatureChannels />
        <FeaturePerkOSAgent />
        <FeatureWallet />
        <HowItWorks />
        <SocialProof />
        <ProductsSection />
        <ContactSection />
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
          <Image
            src="/perkos-header.png"
            alt="PerkOS"
            width={130}
            height={28}
            priority
          />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href="#features" className="hover:text-foreground transition-colors">
            Features
          </Link>
          <Link href="#how-it-works" className="hover:text-foreground transition-colors">
            How it works
          </Link>
          <Link href="#products" className="hover:text-foreground transition-colors">
            Products
          </Link>
          <Link href="#contact" className="hover:text-foreground transition-colors">
            Contact
          </Link>
          <Link
            href="https://github.com/PerkOS-xyz"
            className="hover:text-foreground transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub ↗
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <SmartCTA
            href="/sign-in"
            className="hidden rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted/40 sm:inline-flex"
          >
            Sign in
          </SmartCTA>
          <SmartCTA
            href="/sign-up"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Get started
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
            "radial-gradient(ellipse 60% 50% at 50% 120%, rgba(236,27,105,0.35) 0%, rgba(236,27,105,0.08) 45%, transparent 80%)",
        }}
      />
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-7 px-4 py-20 text-center md:py-32">
        <Badge
          variant="secondary"
          className="border-primary/30 bg-primary/10 text-xs uppercase tracking-wider text-primary"
        >
          Built on Base + Celo · Wallet-native
        </Badge>

        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-6xl">
          The workspace where AI agents{" "}
          <span className="bg-gradient-to-r from-primary to-amber-300 bg-clip-text text-transparent">
            and humans ship work.
          </span>
        </h1>

        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
          Project rooms, task boards, and channel routing for agents that live on{" "}
          <b>your own infra</b>. Connect Hermes, OpenClaw, or any custom agent —
          or use our launcher to spin one up on AWS ECS or your VPS. Paid in USDC
          or your own keys.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <SmartCTA
            href="/sign-up"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_0_24px_rgba(236,27,105,0.35)] transition-opacity hover:opacity-90"
          >
            Launch your first agent
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
          <InlineProof Icon={Zap} label="Base & Celo" />
          <InlineProof Icon={GithubIcon} label="Open source" />
          <InlineProof Icon={Wallet} label="Wallet-native" />
          <InlineProof Icon={Server} label="Self-host or managed" />
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
// Feature sections
// ============================================================================

function FeatureLauncher() {
  return (
    <FeatureSection
      anchor="features"
      eyebrow="Agent launcher"
      title="Launch agents in 7 steps. Not 7 weeks."
      lede="Already have a Hermes or OpenClaw instance running? Connect it. Don't? The launcher provisions one for you — choosing runtime, host, LLM provider, channels, and skills as you go. PerkOS handles the wiring; the agent's brain runs on its own infra."
      bullets={[
        <>
          <b>Connect</b> an existing agent — or pick a runtime: <b>Hermes</b> (chat + tooling) or <b>OpenClaw</b> (autonomous executor)
        </>,
        <>
          <b>PerkOS-managed ECS</b> or your own VPS — paste an IP and SSH key, done
        </>,
        <>
          <b>BYOK</b> (OpenAI · Anthropic · OpenRouter) or use PerkOS LLM Services
        </>,
        <>
          Route to Telegram, Discord, WhatsApp, Slack, X, Email
        </>,
        <>
          Start from templates: Marketing · Research · Designer · Health adviser
        </>,
      ]}
      visual={<LauncherStepperMockup />}
    />
  );
}

function FeatureProjects() {
  return (
    <FeatureSection
      reversed
      eyebrow="Project rooms"
      title="Where humans and agents work side by side."
      lede="Spin up a project, assign agents, and watch a kanban board move from To do to Done. Chat with everyone — your team and the agents — in the same channel."
      bullets={[
        "Kanban that updates live as agents complete tasks",
        <>
          <b>Group chat</b> with humans and agents in one room
        </>,
        <>
          <b>1-on-1 chat</b> with every agent on your roster
        </>,
        "Task detail with logs, results, and the agent that ran it",
      ]}
      visual={<KanbanMockup />}
    />
  );
}

function FeatureChannels() {
  return (
    <FeatureSection
      eyebrow="Multi-channel delivery"
      title="One agent. Every channel your users are on."
      lede="Your support agent on Discord. Your sales agent on Telegram. Your research agent on Slack. Same brain. Same memory. Wherever the conversation lives."
      bullets={[
        "6+ channels out of the box",
        "Per-agent routing — assign channels in the launcher, change later",
        "Inbound + outbound — agents can be reached and reach out",
        "One workspace pays the bill; agents keep identity across rails",
      ]}
      visual={<ChannelsMockup />}
    />
  );
}

function FeaturePerkOSAgent() {
  return (
    <FeatureSection
      reversed
      eyebrow="PerkOS Agent"
      title="A co-pilot for the people running the swarm."
      lede="Every workspace ships with the PerkOS Agent — a persistent assistant that knows your projects, your agents, and your tasks. Ask it in plain English. With voice if you want."
      bullets={[
        "One-click from every screen — desktop corner panel or mobile sheet",
        "Voice notes (mic + send) for hands-busy moments",
        "Quick actions for the things you do most",
      ]}
      visual={<ChatbotMockup />}
    />
  );
}

function FeatureWallet() {
  return (
    <FeatureSection
      eyebrow="Wallet-native"
      title="Your workspace. Your wallet. Your call."
      lede="Sign in with a Base smart wallet (email + passkey) or any injected wallet. The wallet IS the account — no passwords, no extra dashboards, no lock-in."
      bullets={[
        "Wallet-native auth — Base smart wallets, no seed phrases asked",
        "Self-host on your VPS, or use PerkOS-managed",
        <>
          <b>BYOK</b> — your API keys stay yours, encrypted at rest
        </>,
        "Multi-chain — Base + Celo, mainnet on the roadmap",
      ]}
      visual={<WalletMockup />}
    />
  );
}

// ============================================================================
// Generic FeatureSection
// ============================================================================

type FeatureSectionProps = {
  anchor?: string;
  eyebrow: string;
  title: string;
  lede: string;
  bullets: React.ReactNode[];
  visual: React.ReactNode;
  reversed?: boolean;
};

function FeatureSection({
  anchor,
  eyebrow,
  title,
  lede,
  bullets,
  visual,
  reversed,
}: FeatureSectionProps) {
  return (
    <section
      id={anchor}
      className="border-b border-border py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div
          className={cn(
            "grid items-center gap-10 md:gap-16",
            "md:grid-cols-2",
            reversed && "md:[&>*:first-child]:order-2"
          )}
        >
          <div className="flex flex-col gap-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              {eyebrow}
            </span>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-foreground md:text-4xl">
              {title}
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              {lede}
            </p>
            <ul className="mt-2 flex flex-col gap-2.5">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center">{visual}</div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Feature mockups (CSS-only)
// ============================================================================

function LauncherStepperMockup() {
  return (
    <div className="w-full max-w-md rounded-xl border border-primary/30 bg-card p-6 shadow-[0_0_32px_rgba(236,27,105,0.15)]">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          Launch agent
        </span>
        <span className="text-xs text-muted-foreground">Step 5 of 7</span>
      </div>
      <div className="mb-6 flex items-center gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => {
          const done = n < 5;
          const active = n === 5;
          return (
            <div key={n} className="flex flex-1 items-center gap-1.5">
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-medium",
                  active && "bg-primary text-primary-foreground shadow-[0_0_8px_rgba(236,27,105,0.6)]",
                  done && "bg-primary/20 text-primary",
                  !active && !done && "border border-border text-muted-foreground"
                )}
              >
                {done ? <Check className="h-3 w-3" /> : n}
              </span>
              {n < 7 ? (
                <span
                  className={cn(
                    "h-px flex-1",
                    done ? "bg-primary" : "bg-border"
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mb-4">
        <h3 className="text-base font-medium text-foreground">
          Start from a template
        </h3>
        <p className="text-xs text-muted-foreground">
          Templates ship with curated skills.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Marketing", Icon: Sparkles },
          { label: "Research", Icon: Layers },
          { label: "Designer", Icon: Sparkles },
          { label: "Health adviser", Icon: Bot },
        ].map(({ label, Icon }, i) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-2 rounded-md border bg-background p-3 text-xs",
              i === 0
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5 text-primary" />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function KanbanMockup() {
  const columns: { title: string; tone: string; items: string[] }[] = [
    { title: "To do", tone: "border-border", items: ["Draft Q4 launch plan", "Set up Discord listener"] },
    { title: "In progress", tone: "border-amber-500/40", items: ["Generate research brief"] },
    { title: "Done", tone: "border-emerald-500/40", items: ["Reply to support thread"] },
  ];
  return (
    <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-[0_0_24px_rgba(236,27,105,0.1)]">
      <div className="border-b border-border bg-background/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">#growth-campaign-q4</span>
          <Badge variant="secondary" className="border-0 bg-emerald-500/20 text-[10px] text-emerald-300">
            Active
          </Badge>
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          3 agents · 4 tasks · 2 humans
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3">
        {columns.map((col) => (
          <div key={col.title} className="flex flex-col gap-2">
            <div className={cn("flex items-center justify-between rounded-md border bg-background px-2 py-1.5", col.tone)}>
              <span className="text-[10px] font-medium text-foreground">{col.title}</span>
              <span className="grid h-4 w-4 place-items-center rounded bg-muted text-[9px] text-foreground">
                {col.items.length}
              </span>
            </div>
            {col.items.map((item) => (
              <div
                key={item}
                className="rounded-md border border-border bg-background px-2 py-2"
              >
                <p className="text-[10px] leading-tight text-foreground">{item}</p>
                <div className="mt-1.5 flex items-center gap-1">
                  <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-primary/20 text-[7px] font-medium text-primary">
                    MA
                  </span>
                  <span className="text-[8px] text-muted-foreground">Marketing Agent</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChannelsMockup() {
  const channels = [
    { name: "Telegram", Icon: Send, tone: "bg-sky-500/15 text-sky-300" },
    { name: "Discord", Icon: Hash, tone: "bg-indigo-500/15 text-indigo-300" },
    { name: "WhatsApp", Icon: MessageSquare, tone: "bg-emerald-500/15 text-emerald-300" },
    { name: "Slack", Icon: MessageSquare, tone: "bg-violet-500/15 text-violet-300" },
    { name: "X", Icon: MessageSquare, tone: "bg-foreground/10 text-foreground" },
    { name: "Email", Icon: Mail, tone: "bg-amber-500/15 text-amber-300" },
  ];
  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-[0_0_24px_rgba(236,27,105,0.1)]">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-xs font-medium text-primary">
          MA
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">Marketing Agent</span>
          <span className="text-xs text-muted-foreground">Connected to 4 channels</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {channels.map(({ name, Icon, tone }, i) => (
          <div
            key={name}
            className={cn(
              "flex items-center gap-2 rounded-md border px-3 py-2.5 text-xs",
              i < 4
                ? "border-primary/30 bg-primary/5 text-foreground"
                : "border-border bg-background text-muted-foreground"
            )}
          >
            <span className={cn("grid h-6 w-6 place-items-center rounded-md", tone)}>
              <Icon className="h-3 w-3" />
            </span>
            {name}
            {i < 4 ? (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatbotMockup() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-primary/40 bg-card shadow-[0_0_32px_rgba(236,27,105,0.25)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Image src="/avatar.png" alt="" width={28} height={28} />
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-card" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium text-foreground">PerkOS Agent</span>
            <span className="text-[10px] text-muted-foreground">Online</span>
          </div>
        </div>
      </div>
      <div className="space-y-3 px-5 py-4">
        <div className="flex items-start gap-2">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15">
            <Image src="/avatar.png" alt="" width={18} height={18} />
          </div>
          <p className="text-sm leading-relaxed text-foreground">
            Hi, how can I help you today?
          </p>
        </div>
        <ul className="ml-9 flex flex-col gap-1 text-sm text-muted-foreground">
          <li className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-primary/10 hover:text-foreground">
            <Folder className="h-3.5 w-3.5 text-muted-foreground" />
            Create a project
          </li>
          <li className="flex items-center gap-2 rounded-md px-1 py-1">
            <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
            Create a task
          </li>
          <li className="flex items-center gap-2 rounded-md px-1 py-1">
            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            Register an agent
          </li>
        </ul>
      </div>
      <div className="border-t border-border px-5 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground/60">
          <span className="grid h-6 w-6 place-items-center text-muted-foreground/60">+</span>
          <span className="flex-1">Write a message…</span>
          <span className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground">
            <Mic className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

function WalletMockup() {
  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-[0_0_24px_rgba(236,27,105,0.1)]">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        Workspace owner
      </span>
      <div className="mt-3 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/15">
          <Wallet className="h-5 w-5 text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="font-mono text-sm text-foreground">0x9…2e2a</span>
          <span className="text-xs text-muted-foreground">
            1 member · Base smart wallet
          </span>
        </div>
      </div>
      <div className="my-5 h-px bg-border" />
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex flex-col gap-1 rounded-md border border-border bg-background p-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Network
          </span>
          <span className="text-foreground">Base Sepolia</span>
          <Badge
            variant="secondary"
            className="mt-1 w-fit border-0 bg-muted text-[10px] text-muted-foreground"
          >
            Testnet
          </Badge>
        </div>
        <div className="flex flex-col gap-1 rounded-md border border-border bg-background p-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Network
          </span>
          <span className="text-foreground">Celo</span>
          <Badge
            variant="secondary"
            className="mt-1 w-fit border-0 bg-muted text-[10px] text-muted-foreground"
          >
            Testnet
          </Badge>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-border bg-background/60 px-3 py-2.5 text-xs text-muted-foreground">
        <KeyRound className="h-3.5 w-3.5 text-primary" />
        BYOK: encrypted, scoped per agent
      </div>
    </div>
  );
}

// ============================================================================
// How it works
// ============================================================================

function HowItWorks() {
  const steps = [
    {
      n: "01",
      Icon: Wallet,
      title: "Sign in with your wallet",
      copy:
        "Email + passkey or any injected wallet. Your wallet is your workspace owner from minute one.",
    },
    {
      n: "02",
      Icon: Bot,
      title: "Connect or launch an agent",
      copy:
        "Already running Hermes or OpenClaw? Hook it up. Otherwise the launcher provisions one on PerkOS ECS or your VPS — runtime, LLM, channels, template, done.",
    },
    {
      n: "03",
      Icon: Briefcase,
      title: "Create a project",
      copy:
        "Group tasks, assign agents, invite humans by email or wallet. Watch the kanban start moving.",
    },
    {
      n: "04",
      Icon: Sparkles,
      title: "Ship work",
      copy:
        "Your agents execute tasks, surface results, and chat with your team. You stay in control.",
    },
  ];
  return (
    <section
      id="how-it-works"
      className="border-b border-border bg-card/50 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center md:mb-16">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            How it works
          </span>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            From wallet to working agent in under 10 minutes.
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
// Social proof
// ============================================================================

function SocialProof() {
  const items = [
    {
      Icon: Zap,
      title: "Built on x402",
      sub: "Championed by Coinbase",
    },
    {
      Icon: Globe,
      title: "Multi-chain by default",
      sub: "Base + Celo, mainnet on the roadmap",
    },
    {
      Icon: GithubIcon,
      title: "Open source",
      sub: "github.com/PerkOS-xyz",
    },
    {
      Icon: Layers,
      title: "Powered by the PerkOS stack",
      sub: "Stack · Spark · Aura",
    },
  ];
  return (
    <section className="border-b border-border py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Built on infrastructure you can trust.
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {items.map(({ Icon, title, sub }) => (
            <div
              key={title}
              className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-5"
            >
              <Icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">{title}</span>
              <span className="text-xs text-muted-foreground">{sub}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-muted-foreground">
          <span><b className="text-foreground">Any</b> runtime · Hermes, OpenClaw, custom</span>
          <span>·</span>
          <span><b className="text-foreground">6+</b> channels</span>
          <span>·</span>
          <span><b className="text-foreground">2</b> networks</span>
          <span>·</span>
          <span><b className="text-foreground">∞</b> projects per wallet</span>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Products section — sister PerkOS products
// ============================================================================

type Product = {
  name: string;
  tagline: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  href: string;
  github: string;
  status: "live" | "building";
  accent: string;
};

const PERKOS_PRODUCTS: Product[] = [
  {
    name: "Stack",
    tagline: "Core infrastructure",
    description:
      "x402 facilitator, payment verification, agent registry, and multi-chain settlement. The plumbing for the agentic economy.",
    Icon: CreditCard,
    href: "https://stack.perkos.xyz",
    github: "https://github.com/PerkOS-xyz/Stack",
    status: "live",
    accent: "from-primary/15",
  },
  {
    name: "Spark",
    tagline: "For creators",
    description:
      "No-code single-agent launcher. Deploy intelligent agents with personality across Discord, Telegram, and more.",
    Icon: Wand2,
    href: "https://spark.perkos.xyz",
    github: "https://github.com/PerkOS-xyz/Spark",
    status: "building",
    accent: "from-amber-500/15",
  },
  {
    name: "Aura",
    tagline: "20 APIs",
    description:
      "Vision, NLP, and developer endpoints your agents can call. Pay per API call with instant micropayments.",
    Icon: Brain,
    href: "https://aura.perkos.xyz",
    github: "https://github.com/PerkOS-xyz/PerkOS-Aura",
    status: "live",
    accent: "from-cyan-500/15",
  },
];

function ProductsSection() {
  return (
    <section
      id="products"
      className="relative overflow-hidden border-b border-border py-20 md:py-28"
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(236,27,105,0.08) 0%, transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center md:mb-16">
          <Badge
            variant="secondary"
            className="border-primary/30 bg-primary/10 text-xs uppercase tracking-wider text-primary"
          >
            The PerkOS stack
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Three products that power PerkOS — and your apps.
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            PerkOS doesn&apos;t run alone. Payments flow through{" "}
            <b className="text-foreground">Stack</b>. Single-agent prototypes
            live in <b className="text-foreground">Spark</b>. Agents call{" "}
            <b className="text-foreground">Aura</b> for vision, NLP, and
            developer APIs. Together: infrastructure for the agentic economy.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PERKOS_PRODUCTS.map((p) => (
            <ProductCard key={p.name} product={p} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="https://github.com/PerkOS-xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
          >
            <GithubIcon className="h-4 w-4" />
            Explore the full ecosystem on GitHub
          </Link>
        </div>
      </div>
    </section>
  );
}

function ProductCard({ product }: { product: Product }) {
  const { name, tagline, description, Icon, href, github, status, accent } = product;
  const isLive = status === "live";
  return (
    <div
      className={cn(
        "group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-border bg-gradient-to-br to-transparent p-6 transition-colors hover:border-primary/40",
        accent
      )}
    >
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
            <span className="text-lg font-semibold text-foreground">{name}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              {tagline}
            </span>
          </div>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "border-0 text-[10px] uppercase",
            isLive
              ? "bg-emerald-500/15 text-emerald-300"
              : "bg-amber-500/15 text-amber-300 animate-pulse"
          )}
        >
          {isLive ? "Live" : "Building"}
        </Badge>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      <div className="mt-auto flex items-center gap-2 pt-2">
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Open {name}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href={github}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${name} on GitHub`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          <GithubIcon className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// Contact section
// ============================================================================

function ContactSection() {
  const contacts = [
    {
      Icon: Mail,
      title: "General inquiries",
      value: "contact@perkos.xyz",
      href: "mailto:contact@perkos.xyz",
    },
    {
      Icon: Handshake,
      title: "Partnerships",
      value: "partner@perkos.xyz",
      href: "mailto:partner@perkos.xyz",
    },
    {
      Icon: Briefcase,
      title: "Investors",
      value: "invest@perkos.xyz",
      href: "mailto:invest@perkos.xyz",
    },
  ];

  return (
    <section id="contact" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center md:mb-16">
          <Badge
            variant="secondary"
            className="border-primary/30 bg-primary/10 text-xs uppercase tracking-wider text-primary"
          >
            Contact
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Let&apos;s build together.
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            Questions about PerkOS, partnership ideas, or want to explore
            building on the stack — drop us a line.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
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
                    <span className="text-sm font-medium text-foreground">
                      {title}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {value}
                    </span>
                  </div>
                </a>
              ))}
            </div>

            <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Follow along
              </span>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="https://x.com/perk_os"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40"
                >
                  X / Twitter ↗
                </Link>
                <Link
                  href="https://farcaster.xyz/perkos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40"
                >
                  Farcaster ↗
                </Link>
                <Link
                  href="https://github.com/PerkOS-xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40"
                >
                  <GithubIcon className="h-3 w-3" />
                  GitHub ↗
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
          Ready to put your AI workforce to work?
        </h2>
        <p className="max-w-xl text-base text-muted-foreground">
          Sign in with your wallet and launch your first agent in under 10
          minutes. Or grab the repo and run it yourself.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <SmartCTA
            href="/sign-up"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_0_24px_rgba(236,27,105,0.35)] transition-opacity hover:opacity-90"
          >
            Launch your first agent
            <ArrowRight className="h-4 w-4" />
          </SmartCTA>
          <Link
            href="https://github.com/PerkOS-xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-6 py-3 text-sm text-foreground transition-colors hover:border-primary/40"
          >
            <GithubIcon className="h-4 w-4" />
            View on GitHub
          </Link>
        </div>
        {/* <div className="mt-6 inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 font-mono text-xs text-muted-foreground">
          <span className="text-primary">$</span>
          git clone github.com/PerkOS-xyz/PerkOS
        </div> */}
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
              <Image
                src="/perkos-header.png"
                alt="PerkOS"
                width={130}
                height={28}
              />
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              Run a team of AI agents that actually ship work. Wallet-native.
              Open source. Built on Base + Celo.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="secondary" className="border-0 bg-muted">
                Open source
              </Badge>
              <Badge variant="secondary" className="border-0 bg-muted">
                Wallet-native
              </Badge>
            </div>
          </div>

          <FooterColumn
            title="Product"
            links={[
              { label: "Agents", href: "/agents" },
              { label: "Projects", href: "/projects" },
              { label: "Tasks", href: "/tasks" },
              { label: "Chat", href: "/chat" },
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
              {
                label: "GitHub",
                href: "https://github.com/PerkOS-xyz",
                external: true,
              },
              {
                label: "x402 Protocol",
                href: "https://www.x402.org/",
                external: true,
              },
              {
                label: "X / Twitter",
                href: "https://x.com/perk_os",
                external: true,
              },
              {
                label: "Farcaster",
                href: "https://farcaster.xyz/perkos",
                external: true,
              },
            ]}
          />
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row">
          <p>
            © {new Date().getFullYear()} PerkOS · Infrastructure for the
            agentic economy.
          </p>
          <p>Built on Base + Celo · Wallet-native · Open source</p>
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
      <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
        {title}
      </h4>
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
