import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Code,
  Cpu,
  HeartHandshake,
  Sparkles,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

// ============================================================================
// /artizen — public, no-auth page that explains what PerkOS is and who it is
// for. It is linked from grant and community submissions, so readers arrive
// with no context and click through to the live product and the open code.
//
// Editorial guidelines for this page:
//   - Plain language. Describe what people can do, not how the system works.
//   - The audience is a community manager, a small business, or an early
//     stage startup, so lead with community, open source, the languages the
//     product speaks, and the fact that anyone can run it themselves.
//   - Infrastructure and payment details belong on the product and developer
//     pages, where there is room to explain them properly.
//   - No em dashes in visible copy.
// ============================================================================

export const metadata: Metadata = {
  title: "Why PerkOS qualifies — open-source community AI",
  description:
    "PerkOS is open-source AI infrastructure that lets anyone build a small team of helpful AI for their community, in plain words and in their own language. See how it meets Artizen's community, open-source, human-benefit, and frontier-tech criteria.",
  // Unlisted: reachable only by direct link (used in grant submissions), kept
  // out of search and out of the site nav.
  robots: { index: false, follow: false },
};

const STATS = [
  { value: "80+", label: "Open-source repositories" },
  { value: "Running", label: "In closed beta at app.perkos.xyz" },
  { value: "7", label: "Languages, Spanish and Portuguese included" },
  { value: "0", label: "Outside investors, fully independent" },
];

const PILLARS = [
  {
    Icon: Users,
    title: "Community",
    copy: "Anyone can build a small team of AI helpers for the people they serve. A community manager, a small business, or an early stage startup creates them in plain words, and what those helpers produce stays with the community.",
  },
  {
    Icon: Code,
    title: "Open source",
    copy: "The whole stack is public. 80+ open repositories cover the AI runtimes, the shared knowledge commons, and the tools that connect them, so anyone can inspect it, fork it, and run it themselves.",
  },
  {
    Icon: HeartHandshake,
    title: "Human benefit",
    copy: "PerkOS gives regular people something usually reserved for big tech: a small team of AI that works for them, speaks their language, and can run on a machine they control. It grows what everyday people can do.",
  },
  {
    Icon: Cpu,
    title: "Frontier tech",
    copy: "PerkOS is multi-agent AI in production. Helpers plan a goal together, split the work on a shared board, and report back. Like the best frontier tech, it is built to quietly fade into the background.",
  },
];

const CRITERIA = [
  {
    title: "A public good, built for people",
    copy: "Made for individuals and communities, not corporations or enterprise.",
  },
  {
    title: "Fully open source",
    copy: "The entire stack is public across 80+ repositories under the PerkOS org.",
  },
  {
    title: "Working today, in closed beta",
    copy: "Running at app.perkos.xyz with a small group of people, while we make sure it holds up before we open it wider.",
  },
  {
    title: "Direct human agency",
    copy: "Everyday people own AI that works for them, described in plain words, in their own language.",
  },
  {
    title: "Independent and unfunded",
    copy: "Built in the open, with no large institution or corporation behind it.",
  },
  {
    title: "Built to scale",
    copy: "Open, foundational infrastructure meant to reach millions of community helpers worldwide.",
  },
];

const PROOF = [
  {
    label: "See it running",
    detail: "The product, in closed beta",
    href: "https://app.perkos.xyz",
  },
  {
    label: "Anna, on your phone",
    detail: "A helper for small teams",
    href: "https://minipay.perkos.xyz",
  },
  {
    label: "Read the code",
    detail: "80+ open repositories",
    href: "https://github.com/PerkOS-xyz",
  },
  {
    label: "Run it yourself",
    detail: "Public runtimes, one command",
    href: "https://github.com/PerkOS-xyz/Perkos-Containers",
  },
];

export default function ArtizenPage() {
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
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 60% 50% at 50% 120%, rgba(236,27,105,0.22) 0%, rgba(236,27,105,0.06) 45%, transparent 80%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Public good · Open source · Built for people
              </span>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
                AI that belongs to people, built in the open.
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
                PerkOS is open-source infrastructure that lets anyone build a small
                team of helpful AI for their community, in plain words and in their
                own language. It is running today in a closed beta, independent, and free
                for anyone to inspect, fork, and run.
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="https://app.perkos.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  See it running
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                <a
                  href="https://github.com/PerkOS-xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
                >
                  <Code className="h-4 w-4" />
                  Read the code
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="py-14 md:py-16">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <dl className="grid grid-cols-2 gap-y-8 rounded-xl border border-border bg-card/60 py-10 md:grid-cols-4 md:gap-0">
              {STATS.map((m, i) => (
                <div
                  key={m.label}
                  className={cn(
                    "flex flex-col items-center gap-1 px-4 text-center",
                    i < STATS.length - 1 && "md:border-r md:border-border",
                  )}
                >
                  <dd className="text-2xl font-bold tracking-tight text-foreground md:text-4xl">{m.value}</dd>
                  <dt className="text-xs text-muted-foreground md:text-sm">{m.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Pillars — one per Artizen theme */}
        <section className="pb-16 md:pb-20">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <div className="mb-8 flex flex-col items-center gap-2 text-center">
              <h2 className="text-xl font-semibold text-foreground md:text-2xl">
                Why PerkOS fits Artizen
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                The same project speaks to every theme Artizen supports: community,
                open source, human benefit, and frontier technology.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
              {PILLARS.map(({ Icon, title, copy }) => (
                <div key={title} className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="text-base font-medium text-foreground">{title}</h3>
                  <p className="text-sm text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Eligibility checklist */}
        <section className="border-t border-border bg-card/30 py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <div className="mb-8 flex flex-col items-center gap-2 text-center">
              <h2 className="text-xl font-semibold text-foreground md:text-2xl">
                How PerkOS meets the criteria
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Point by point, against what Artizen funds look for.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CRITERIA.map(({ title, copy }) => (
                <div key={title} className="flex items-start gap-3 rounded-lg border border-border bg-background/60 p-5">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                    <p className="text-sm text-muted-foreground">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Live proof */}
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-4 md:px-8">
            <div className="mb-8 flex flex-col items-center gap-2 text-center">
              <h2 className="text-xl font-semibold text-foreground md:text-2xl">
                See it for yourself
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Everything here is public and running. Click through.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              {PROOF.map(({ label, detail, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col gap-1 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
                >
                  <span className="flex items-center justify-between text-base font-medium text-foreground">
                    {label}
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                  </span>
                  <span className="text-sm text-muted-foreground">{detail}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card/40 py-10">
        <div className="mx-auto max-w-7xl px-4 text-sm text-muted-foreground md:px-8">
          <Link href="/" className="transition-colors hover:text-foreground">
            ← PerkOS · open-source AI for communities
          </Link>
          <p className="mt-3 text-xs">© {new Date().getFullYear()} PerkOS. Independent and community-built.</p>
        </div>
      </footer>
    </div>
  );
}
