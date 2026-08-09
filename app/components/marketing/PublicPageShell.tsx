import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";

import { SmartCTA } from "../SmartCTA";

type Props = {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
  ctaId: string;
};

export function PublicPageShell({ eyebrow, title, intro, children, ctaId }: Props) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/90">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 md:px-8">
          <Link href="/" aria-label="PerkOS AI home">
            <Image src="/perkos-header.png" alt="PerkOS AI" width={150} height={52} priority />
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/about" className="hidden hover:text-foreground sm:inline">About</Link>
            <Link href="/ai-teams-for-small-business" className="hidden hover:text-foreground md:inline">AI teams</Link>
            <SmartCTA
              href="/sign-in"
              analyticsId={`${ctaId}_nav`}
              className="brand-gradient inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium text-primary-foreground"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </SmartCTA>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border/60 py-24 md:py-32">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(236,27,105,0.18),transparent_38%)]" />
          <div className="relative mx-auto max-w-4xl px-4 md:px-8">
            <p className="mb-5 font-mono text-xs uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">{title}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">{intro}</p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <SmartCTA
                href="/sign-in"
                analyticsId={`${ctaId}_hero`}
                className="brand-gradient inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold text-primary-foreground"
              >
                Meet your AI team <ArrowRight className="h-4 w-4" />
              </SmartCTA>
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary" /> Free to start · You approve every action
              </span>
            </div>
          </div>
        </section>

        {children}

        <section className="border-t border-border py-20">
          <div className="mx-auto flex max-w-4xl flex-col items-center px-4 text-center md:px-8">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Your business does not need more busywork.</h2>
            <p className="mt-4 max-w-xl text-muted-foreground">Start with a ready-made team, give it one goal, and stay in control of every result.</p>
            <SmartCTA
              href="/sign-in"
              analyticsId={`${ctaId}_final`}
              className="brand-gradient mt-7 inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-semibold text-primary-foreground"
            >
              Start with PerkOS AI <ArrowRight className="h-4 w-4" />
            </SmartCTA>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row md:px-8">
          <p>© {new Date().getFullYear()} PerkOS AI. AI teams for small businesses.</p>
          <div className="flex flex-wrap gap-5">
            <Link href="/">Home</Link>
            <Link href="/about">About</Link>
            <Link href="/ai-teams-for-small-business">AI teams</Link>
            <Link href="/solutions/restaurants">Restaurants</Link>
            <Link href="/solutions/real-estate">Real estate</Link>
            <Link href="/solutions/ecommerce">Ecommerce</Link>
            <Link href="/solutions/agencies">Agencies</Link>
            <Link href="/privacy">Privacy</Link>
            <a href="https://www.instagram.com/perkos.xyz/" target="_blank" rel="noopener noreferrer">Instagram</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function ContentSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-4 md:px-8">
        <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">{title}</h2>
        <div className="mt-6 space-y-5 text-base leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </section>
  );
}

export function FeatureGrid({
  items,
}: {
  items: Array<{ title: string; body: string }>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <article key={item.title} className="rounded-2xl border border-border bg-card p-6">
          <h3 className="font-semibold text-foreground">{item.title}</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
        </article>
      ))}
    </div>
  );
}
