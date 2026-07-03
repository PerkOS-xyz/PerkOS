"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Briefcase,
  Calculator,
  Check,
  Coffee,
  GraduationCap,
  Hammer,
  Handshake,
  HeartPulse,
  Home,
  Mail,
  MessageSquare,
  Moon,
  Palette,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  UtensilsCrossed,
  Wand2,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AgentOrb } from "../AgentOrb";
import { ContactForm } from "./ContactForm";
import { SmartCTA } from "../SmartCTA";
import { LanguageSelector } from "../LanguageSelector";

// ============================================================================
// LandingContent — the client-rendered body of the PerkOS landing page.
//
// Split out of app/page.tsx so the page can stay a Server Component (metadata +
// JSON-LD) while all user-facing copy runs through react-i18next (t()) and
// switches with the LanguageSelector. Structure, classNames, icons, hrefs and
// emails are preserved verbatim — only English strings became translation keys.
//
// Audience: NON-TECHNICAL small-business owners first (anxious about AI —
// user testing showed robot imagery + tech jargon scared them), investors /
// partners / developers second (one contained strip).
//
// Vocabulary contract: teammates/team, drafts, you approve, set up, ready in
// minutes. Banned on this page: agent (as a buyer-facing noun), bot, robot,
// deploy, provision, infrastructure, blockchain/x402/token, LLM. "Agentic AI"
// appears exactly once — explained in plain words (expertise section).
// ============================================================================

export function LandingContent() {
  return (
    <>
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
        <BuildersStrip />
        <TalkToUs />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}

// ============================================================================
// Top nav
// ============================================================================

function TopNav() {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/perkos-header.png" alt="PerkOS" width={130} height={28} priority />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href="#templates" className="transition-colors hover:text-foreground">
            {t("landing.nav.forYourBusiness")}
          </Link>
          <Link href="#how-it-works" className="transition-colors hover:text-foreground">
            {t("landing.nav.howItWorks")}
          </Link>
          <Link href="#expertise" className="transition-colors hover:text-foreground">
            {t("landing.nav.whyPerkos")}
          </Link>
          <Link href="#pricing" className="transition-colors hover:text-foreground">
            {t("landing.nav.pricing")}
          </Link>
          <Link href="#talk-to-us" className="transition-colors hover:text-foreground">
            {t("landing.nav.talkToUs")}
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {/* Language selector — browser-only (self-hidden inside Mini App hosts). */}
          <LanguageSelector />
          {/* Single entry point — "Start". SmartCTA connects the host wallet
              (Farcaster / Base App) or opens the browser sign-in as needed. */}
          <SmartCTA
            href="/sign-in"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:px-4"
          >
            <span className="hidden sm:inline">{t("landing.nav.meetYourTeam")}</span>
            <span className="sm:hidden">{t("landing.nav.start")}</span>
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
  const { t } = useTranslation();
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
          {t("landing.hero.badge")}
        </Badge>

        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-6xl">
          {t("landing.hero.titleBefore")}{" "}
          <span className="bg-gradient-to-r from-primary to-amber-300 bg-clip-text text-transparent">
            {t("landing.hero.titleHighlight")}
          </span>
          {t("landing.hero.titleAfter")}
        </h1>

        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
          {t("landing.hero.subtitle")}
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <SmartCTA
            href="/sign-in"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_0_24px_rgba(236,27,105,0.3)] transition-opacity hover:opacity-90"
          >
            {t("landing.hero.ctaPrimary")}
            <ArrowRight className="h-4 w-4" />
          </SmartCTA>
          <Link
            href="#how-it-works"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-6 py-3 text-sm text-foreground transition-colors hover:border-primary/40"
          >
            {t("landing.hero.ctaSecondary")}
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-xs text-muted-foreground">
          <TrustChip label={t("landing.hero.trust.approve")} />
          <TrustChip label={t("landing.hero.trust.ready")} />
          <TrustChip label={t("landing.hero.trust.noTech")} />
          <TrustChip label={t("landing.hero.trust.cancel")} />
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

const FEAR_KILLERS: { Icon: LucideIcon; key: string }[] = [
  { Icon: ShieldCheck, key: "approval" },
  { Icon: Coffee, key: "simple" },
  { Icon: Moon, key: "affordable" },
];

function FearKillers() {
  const { t } = useTranslation();
  return (
    <section className="border-b border-border bg-card/30 py-12 md:py-16">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 md:grid-cols-3 md:px-8">
        {FEAR_KILLERS.map(({ Icon, key }) => (
          <div key={key} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-semibold text-foreground">
              {t(`landing.fearKillers.items.${key}.title`)}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(`landing.fearKillers.items.${key}.body`)}
            </p>
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
  key: string;
  Icon: LucideIcon;
  accent: string;
};

const TEMPLATE_PITCHES: TemplatePitch[] = [
  { key: "restaurant", Icon: UtensilsCrossed, accent: "#fbbf24" },
  { key: "realEstate", Icon: Home, accent: "#34d399" },
  { key: "growthAgency", Icon: Palette, accent: "#ec1b69" },
  { key: "onlineStore", Icon: ShoppingCart, accent: "#f97316" },
  { key: "consulting", Icon: Briefcase, accent: "#60a5fa" },
  { key: "healthWellness", Icon: HeartPulse, accent: "#2dd4bf" },
  { key: "coaching", Icon: GraduationCap, accent: "#a78bfa" },
  { key: "trades", Icon: Hammer, accent: "#eab308" },
  { key: "finance", Icon: Calculator, accent: "#22d3ee" },
  { key: "localServices", Icon: Sparkles, accent: "#e879f9" },
];

function Templates() {
  const { t } = useTranslation();
  return (
    <section id="templates" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {t("landing.templates.heading")}
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            {t("landing.templates.subheading")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATE_PITCHES.map(({ key, Icon, accent }) => (
            <SmartCTA
              key={key}
              href="/sign-in"
              className="group flex h-full flex-col gap-3 rounded-xl border border-border bg-card/60 p-5 text-left transition-colors hover:border-primary/50"
            >
              <span
                className="grid h-11 w-11 place-items-center rounded-xl"
                style={{ background: `${accent}22`, color: accent }}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-base font-semibold text-foreground">
                {t(`landing.templates.items.${key}.name`)}
              </span>
              <span className="text-sm leading-relaxed text-muted-foreground">
                {t(`landing.templates.items.${key}.pitch`)}
              </span>
              <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary opacity-70 transition-opacity group-hover:opacity-100">
                {t("landing.templates.cardCta")}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </SmartCTA>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          {t("landing.templates.footNoteBefore")}{" "}
          <Link href="#talk-to-us" className="text-primary underline-offset-2 hover:underline">
            {t("landing.templates.footNoteLink")}
          </Link>
          {t("landing.templates.footNoteAfter")}
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// Meet your team — roles as job descriptions, badges not robots.
// ============================================================================

const TEAM_ROLES: { key: string; presetId: string }[] = [
  { key: "teamLead", presetId: "pm" },
  { key: "distribution", presetId: "marketing" },
  { key: "research", presetId: "researcher" },
  { key: "bookkeeping", presetId: "analyst" },
];

function MeetYourTeam() {
  const { t } = useTranslation();
  return (
    <section className="border-b border-border bg-card/30 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {t("landing.meetYourTeam.heading")}
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            {t("landing.meetYourTeam.subheading")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM_ROLES.map((r) => {
            const name = t(`landing.meetYourTeam.roles.${r.key}.name`);
            return (
              <div
                key={r.key}
                className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center"
              >
                <AgentOrb name={name} presetId={r.presetId} size={64} />
                <span className="text-sm font-semibold text-foreground">{name}</span>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`landing.meetYourTeam.roles.${r.key}.blurb`)}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t("landing.meetYourTeam.footNote")}
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// How it works — three steps, zero diagrams.
// ============================================================================

const HOW_IT_WORKS_STEPS: { n: string; key: string }[] = [
  { n: "1", key: "pick" },
  { n: "2", key: "say" },
  { n: "3", key: "review" },
];

function HowItWorks() {
  const { t } = useTranslation();
  return (
    <section id="how-it-works" className="border-b border-border py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {t("landing.howItWorks.heading")}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((s) => (
            <div key={s.n} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {s.n}
              </span>
              <h3 className="text-base font-semibold text-foreground">
                {t(`landing.howItWorks.steps.${s.key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`landing.howItWorks.steps.${s.key}.body`)}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <SmartCTA
            href="/sign-in"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {t("landing.howItWorks.cta")}
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

const EXPERTISE_PROOFS = ["plan", "quality", "sleep"];

function Expertise() {
  const { t } = useTranslation();
  return (
    <section id="expertise" className="border-b border-border bg-card/30 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {t("landing.expertise.heading")}
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            {t("landing.expertise.introBefore")}{" "}
            <span className="text-foreground">agentic AI</span>{" "}
            {t("landing.expertise.introAfter")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {EXPERTISE_PROOFS.map((key) => (
            <div key={key} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-6">
              <Wand2 className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">
                {t(`landing.expertise.proofs.${key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`landing.expertise.proofs.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted-foreground">
          {t("landing.expertise.footNote")}
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// Beyond teams — AI services in general ("whatever AI your business needs").
// ============================================================================

function BeyondTeams() {
  const { t } = useTranslation();
  return (
    <section className="border-b border-border py-20 md:py-28">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {t("landing.beyondTeams.heading")}
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          {t("landing.beyondTeams.body1")}
        </p>
        <p className="text-base text-muted-foreground">
          {t("landing.beyondTeams.body2")}
        </p>
        <Link
          href="#talk-to-us"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
        >
          <MessageSquare className="h-4 w-4" />
          {t("landing.beyondTeams.cta")}
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
  key: string;
  ctaHref: string;
  smart?: boolean;
  featured?: boolean;
};

const TIERS: Tier[] = [
  { key: "free", ctaHref: "/sign-in", smart: true },
  { key: "starter", ctaHref: "/sign-in", smart: true },
  { key: "pro", ctaHref: "/sign-in", smart: true, featured: true },
  { key: "scale", ctaHref: "/sign-in", smart: true },
];

function Pricing() {
  const { t } = useTranslation();
  return (
    <section id="pricing" className="border-b border-border bg-card/30 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {t("landing.pricing.heading")}
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            {t("landing.pricing.subheading")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => {
            const bullets = t(`landing.pricing.tiers.${tier.key}.bullets`, {
              returnObjects: true,
            }) as unknown as string[];
            const cadence = t(`landing.pricing.tiers.${tier.key}.cadence`);
            const cta = t(`landing.pricing.tiers.${tier.key}.cta`);
            return (
              <div
                key={tier.key}
                className={cn(
                  "relative flex flex-col gap-4 rounded-xl border bg-card p-6",
                  tier.featured
                    ? "border-primary/60 shadow-[0_0_32px_rgba(236,27,105,0.12)]"
                    : "border-border",
                )}
              >
                {tier.featured ? (
                  <Badge className="absolute -top-2.5 left-6 bg-primary text-[10px] uppercase text-primary-foreground">
                    {t("landing.pricing.mostPopular")}
                  </Badge>
                ) : null}
                <div className="flex flex-col gap-1">
                  <span className="text-lg font-semibold text-foreground">
                    {t(`landing.pricing.tiers.${tier.key}.name`)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(`landing.pricing.tiers.${tier.key}.tag`)}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tracking-tight text-foreground">
                    {t(`landing.pricing.tiers.${tier.key}.price`)}
                  </span>
                  {cadence ? (
                    <span className="text-sm text-muted-foreground">{cadence}</span>
                  ) : null}
                </div>
                <ul className="flex flex-col gap-2.5">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{b}</span>
                    </li>
                  ))}
                </ul>
                {tier.smart ? (
                  <SmartCTA
                    href={tier.ctaHref}
                    className={cn(
                      "mt-auto inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90",
                      tier.featured
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-foreground hover:border-primary/40",
                    )}
                  >
                    {cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </SmartCTA>
                ) : (
                  <Link
                    href={tier.ctaHref}
                    className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40"
                  >
                    {cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted-foreground">
          {t("landing.pricing.footNote")}
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// Builders strip — the ONE contained place for secondary audiences.
// ============================================================================

const BUILDER_LINKS: { Icon: LucideIcon; key: string; href: string }[] = [
  { Icon: Handshake, key: "partners", href: "mailto:partner@perkos.xyz" },
  { Icon: Mail, key: "developers", href: "mailto:contact@perkos.xyz" },
];

function BuildersStrip() {
  const { t } = useTranslation();
  return (
    <section className="border-b border-border py-12">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <p className="mb-5 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("landing.buildersStrip.heading")}
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {BUILDER_LINKS.map(({ Icon, key, href }) => (
            <a
              key={key}
              href={href}
              className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {t(`landing.buildersStrip.links.${key}.title`)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`landing.buildersStrip.links.${key}.desc`)}
                </span>
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

const CONTACTS: { Icon: LucideIcon; key: string; value: string; href: string }[] = [
  { Icon: Mail, key: "general", value: "contact@perkos.xyz", href: "mailto:contact@perkos.xyz" },
  { Icon: Handshake, key: "partnerships", value: "partner@perkos.xyz", href: "mailto:partner@perkos.xyz" },
  { Icon: Briefcase, key: "investors", value: "invest@perkos.xyz", href: "mailto:invest@perkos.xyz" },
];

function TalkToUs() {
  const { t } = useTranslation();
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
            {t("landing.talkToUs.heading")}
          </h2>
          <p className="max-w-2xl text-base text-muted-foreground">
            {t("landing.talkToUs.subheading")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            {CONTACTS.map(({ Icon, key, value, href }) => (
              <a
                key={key}
                href={href}
                className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
              >
                <span className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {t(`landing.talkToUs.contacts.${key}.title`)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{value}</span>
                </div>
              </a>
            ))}
            <div className="flex flex-col gap-3 rounded-md border border-border bg-card p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("landing.talkToUs.followAlong")}
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
  const { t } = useTranslation();
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
          {t("landing.finalCTA.heading")}
        </h2>
        <p className="max-w-xl text-base text-muted-foreground">
          {t("landing.finalCTA.subheading")}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <SmartCTA
            href="/sign-in"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-[0_0_24px_rgba(236,27,105,0.35)] transition-opacity hover:opacity-90"
          >
            {t("landing.finalCTA.ctaPrimary")}
            <ArrowRight className="h-4 w-4" />
          </SmartCTA>
          <Link
            href="#talk-to-us"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-6 py-3 text-sm text-foreground transition-colors hover:border-primary/40"
          >
            {t("landing.finalCTA.ctaSecondary")}
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
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border bg-card/40 py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="flex flex-col gap-3">
            <Link href="/" className="inline-flex items-center gap-2">
              <Image src="/perkos-header.png" alt="PerkOS" width={130} height={28} />
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              {t("landing.footer.tagline")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="#templates" className="transition-colors hover:text-foreground">
              {t("landing.footer.links.forYourBusiness")}
            </Link>
            <Link href="#how-it-works" className="transition-colors hover:text-foreground">
              {t("landing.footer.links.howItWorks")}
            </Link>
            <Link href="#expertise" className="transition-colors hover:text-foreground">
              {t("landing.footer.links.whyPerkos")}
            </Link>
            <Link href="#talk-to-us" className="transition-colors hover:text-foreground">
              {t("landing.footer.links.contact")}
            </Link>
            <Link href="/investors" className="transition-colors hover:text-foreground">
              {t("landing.footer.links.investors")}
            </Link>
          </div>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          {t("landing.footer.copyright", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
