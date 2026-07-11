"use client";

// ============================================================================
// SectionsV2 — every remaining section of the original landing, adapted to
// the v2 motion system so /preview is section-complete vs /. Same i18n keys,
// same hrefs/emails, aggressive scroll patterns from the new references:
//   FearKillers  → marquee ticker + hard slide-in cards      (dieantwoord)
//   HowItWorks   → pinned scene, steps rotate inside          (lesa.is)
//   Expertise    → clip-path wipe reveals                     (viktoriia)
//   BeyondTeams  → scrubbed word-by-word reading reveal       (dieantwoord)
//   Pricing      → kinetic heading + cascading scrub, featured glow
//   Builders     → compact scrub band
//   TalkToUs     → slide-in contacts + existing ContactForm (unchanged)
// ============================================================================

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  MessageSquare,
  Moon,
  Route,
  type LucideIcon,
} from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SmartCTA } from "../../SmartCTA";
import { ContactForm } from "../ContactForm";
import { KineticHeading } from "./KineticHeading";
import { Marquee } from "./Marquee";
import { WordReveal } from "./WordReveal";
import { ParallaxLayer } from "./ParallaxLayer";
import { ScrubItem, ScrubBlock, useScrubProgress } from "./Scrub";
import { TiltCard } from "./TiltCard";
import { useActiveSlot } from "./useActiveSlot";
import { useMounted } from "./useMounted";
import {
  FEAR_KILLERS,
  HOW_IT_WORKS_STEPS,
  EXPERTISE_PROOFS,
  TIERS,
  BUILDER_LINKS,
  CONTACTS,
} from "./landingData";

// ============================================================================
// Fear killers — ticker band + hard slide-in cards
// ============================================================================

export function FearKillersV2() {
  const { t } = useTranslation();
  const gridRef = useRef<HTMLDivElement>(null);
  const progress = useScrubProgress(gridRef);

  return (
    <section className="relative overflow-hidden bg-background py-16 md:py-24">
      {/* Ticker: the three fear-killer titles on an infinite band */}
      <Marquee className="mb-14 border-y border-border/60 py-4 font-mono text-sm uppercase tracking-[0.18em] text-foreground/50">
        {FEAR_KILLERS.map(({ key }) => (
          <span key={key} className="inline-flex items-center">
            <span className="px-6">{t(`landing.fearKillers.items.${key}.title`)}</span>
            <span className="text-primary">✦</span>
          </span>
        ))}
      </Marquee>

      <div
        ref={gridRef}
        className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 md:grid-cols-3 md:px-8"
      >
        {FEAR_KILLERS.map(({ Icon, key }, i) => (
          <ScrubItem key={key} progress={progress} index={i} cols={3} travel={220}>
            <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-6 glow-card">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary">
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="text-base font-semibold text-foreground">
                {t(`landing.fearKillers.items.${key}.title`)}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`landing.fearKillers.items.${key}.body`)}
              </p>
            </div>
          </ScrubItem>
        ))}
      </div>
    </section>
  );
}

// ============================================================================
// How it works — pinned scene, the 3 steps rotate inside as you scroll
// ============================================================================

export function HowItWorksV2() {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  // State-driven active step: exactly one visible at a time — no overlap and
  // no stale "step 3 showing at the start" from unmeasured progress values.
  const active = useActiveSlot(scrollYProgress, HOW_IT_WORKS_STEPS.length);
  const mounted = useMounted();

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="relative bg-background"
      style={{ height: "300vh" }}
    >
      <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
        <KineticHeading className="pt-24" from="-10%" to="6%">
          {t("landing.howItWorks.heading")}
        </KineticHeading>

        {/* Stage: only the active step is visible; swaps as you scroll */}
        <div className="relative mx-auto w-full max-w-4xl flex-1 px-4 md:px-8">
          {mounted
            ? HOW_IT_WORKS_STEPS.map((s, i) => (
                <motion.div
                  key={s.key}
                  className="absolute inset-x-4 top-1/2 md:inset-x-8"
                  initial={false}
                  animate={{
                    opacity: active === i ? 1 : 0,
                    y: active === i ? "-50%" : active > i ? "-62%" : "-34%",
                  }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:gap-12">
                    <span
                      className="brand-gradient-text font-semibold"
                      style={{ fontSize: "clamp(6rem, 18vw, 13rem)", lineHeight: 0.9 }}
                    >
                      {s.n}
                    </span>
                    <div className="flex max-w-md flex-col gap-3">
                      <h3 className="text-2xl font-semibold text-foreground md:text-3xl">
                        {t(`landing.howItWorks.steps.${s.key}.title`)}
                      </h3>
                      <p className="text-base leading-relaxed text-muted-foreground">
                        {t(`landing.howItWorks.steps.${s.key}.body`)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            : null}

          {/* Progress rail */}
          <div className="absolute right-4 top-1/2 hidden h-40 w-px -translate-y-1/2 bg-border md:block">
            {mounted ? (
              <motion.div
                className="brand-gradient w-px origin-top"
                style={{ height: "100%", scaleY: scrollYProgress }}
              />
            ) : null}
          </div>
        </div>

        <div className="flex justify-center pb-16">
          <SmartCTA
            href="/sign-in"
            className="brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-[0_0_36px_rgba(236,27,105,0.4)] transition-transform hover:scale-[1.03]"
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
// Expertise — matches the page's approved poster language: each proof is a
// deck-texture poster card with the brand veil that RISES INTO PLACE in 3D
// (rotateX 40°→0, scrubbed to the wheel, staggered), a giant gradient index
// glowing behind the copy. Heading = word-by-word reveal + editorial kicker.
// ============================================================================

export function ExpertiseV2() {
  const { t } = useTranslation();
  return (
    <section id="expertise" className="relative overflow-hidden bg-background py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">
          <span className="text-primary">✦</span> {t("landing.nav.whyPerkos")}
        </div>
        <WordReveal
          as="h2"
          text={t("landing.expertise.heading")}
          className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl"
        />
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          {t("landing.expertise.introBefore")}{" "}
          <span className="text-foreground">agentic AI</span>{" "}
          {t("landing.expertise.introAfter")}
        </p>

        <div
          className="mt-28 grid grid-cols-1 gap-6 md:mt-36 md:grid-cols-3"
          style={{ perspective: 1100 }}
        >
          {EXPERTISE_PROOFS.map((key, i) => (
            <ProofPoster key={key} proofKey={key} index={i} />
          ))}
        </div>

        <p className="mx-auto mt-24 max-w-2xl pb-6 text-center text-sm text-muted-foreground md:mt-32">
          {t("landing.expertise.footNote")}
        </p>
      </div>
    </section>
  );
}

// Distinct identity per proof — icon + brand-family accent (no repeated Wand2).
const PROOF_VISUAL: Record<string, { Icon: LucideIcon; accent: string }> = {
  plan: { Icon: Route, accent: "#ec1b69" },
  quality: { Icon: BadgeCheck, accent: "#f05b57" },
  sleep: { Icon: Moon, accent: "#a78bfa" },
};

function ProofPoster({ proofKey, index }: { proofKey: string; index: number }) {
  const { t } = useTranslation();
  // Measure on a STATIC wrapper (not the transforming motion div) so the
  // scroll progress mapping stays stable while the card animates.
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const { Icon, accent } = PROOF_VISUAL[proofKey] ?? PROOF_VISUAL.plan;

  // Directional 3D entrance per column (refs-inspired): left card swings in
  // from the left, middle rises from below, right card swings in from the
  // right — all scrubbed to the wheel, staggered.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.95", `start ${0.42 - index * 0.05}`],
  });
  const dir = index === 0 ? -1 : index === 2 ? 1 : 0;
  const x = useTransform(scrollYProgress, [0, 1], [dir * 140, 0]);
  const rotateY = useTransform(scrollYProgress, [0, 1], [dir * 32, 0]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [dir === 0 ? 46 : 12, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [dir === 0 ? 170 : 60, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0, 1]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.88, 1]);

  const inner = (
    <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
      {/* Poster background — same language as the templates deck, tinted per proof */}
      <div className="absolute inset-0">
        <Image
          src="/hero/deck-texture.png"
          alt=""
          fill
          sizes="400px"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(160deg, ${accent}2e 0%, rgba(14,7,22,0.9) 55%, rgba(14,7,22,0.97) 100%)`,
          }}
        />
      </div>

      <div className="relative flex h-full min-h-[280px] flex-col gap-4 p-8">
        <div className="flex items-start justify-between">
          <span
            className="grid h-12 w-12 place-items-center rounded-xl border border-white/10"
            style={{ background: `${accent}26`, color: accent, boxShadow: `0 0 24px ${accent}30` }}
          >
            <Icon className="h-6 w-6" />
          </span>
          <span className="font-mono text-sm text-foreground/50">
            ({String(index + 1).padStart(2, "0")})
          </span>
        </div>
        <h3 className="mt-2 text-lg font-semibold leading-snug text-foreground md:text-xl">
          {t(`landing.expertise.proofs.${proofKey}.title`)}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t(`landing.expertise.proofs.${proofKey}.body`)}
        </p>
        {/* Editorial baseline rule with accent tick */}
        <div className="mt-auto flex items-center gap-2 pt-4">
          <span className="h-px flex-1 bg-white/10" />
          <span className="h-1.5 w-6 rounded-full" style={{ background: accent }} />
        </div>
      </div>
    </div>
  );

  if (!mounted) {
    return (
      <div ref={ref} className="h-full">
        {inner}
      </div>
    );
  }
  return (
    <div ref={ref} className="h-full">
      <motion.div
        className="h-full"
        style={{
          x,
          y,
          rotateX,
          rotateY,
          opacity,
          scale,
          transformStyle: "preserve-3d",
          willChange: "transform, opacity",
        }}
      >
        {/* Continuous differential float: middle card drifts against the
            sides while scrolling, so the trio never reads as static. */}
        <ParallaxLayer speed={index === 1 ? 44 : -26} className="h-full">
          <TiltCard className="h-full" max={7} hoverScale={1.02}>
            {inner}
          </TiltCard>
        </ParallaxLayer>
      </motion.div>
    </div>
  );
}

// ============================================================================
// Beyond teams — scrubbed word-by-word reading reveal
// ============================================================================

export function BeyondTeamsV2() {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden bg-background py-24 md:py-36">
      <div
        aria-hidden
        className="brand-blob pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 opacity-30"
      />
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-7 px-4 text-center">
        <WordReveal
          as="h2"
          text={t("landing.beyondTeams.heading")}
          className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl"
        />
        <WordReveal
          text={t("landing.beyondTeams.body1")}
          className="text-base leading-relaxed text-muted-foreground md:text-lg"
        />
        <WordReveal
          text={t("landing.beyondTeams.body2")}
          className="text-base text-muted-foreground md:text-lg"
        />
        <ScrubBlock travel={60}>
          <Link
            href="#talk-to-us"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-7 py-3.5 text-[15px] font-medium text-primary transition-colors hover:bg-primary/15"
          >
            <MessageSquare className="h-4 w-4" />
            {t("landing.beyondTeams.cta")}
          </Link>
        </ScrubBlock>
      </div>
    </section>
  );
}

// ============================================================================
// Pricing — cascading scrub, featured tier glowing
// ============================================================================

export function PricingV2() {
  const { t } = useTranslation();
  const gridRef = useRef<HTMLDivElement>(null);
  const progress = useScrubProgress(gridRef);

  return (
    <section id="pricing" className="relative overflow-hidden bg-background py-20 md:py-28">
      <KineticHeading className="mb-4" from="6%" to="-12%">
        {t("landing.pricing.heading")}
      </KineticHeading>

      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <ScrubBlock className="mb-14 max-w-2xl" travel={70}>
          <p className="text-base text-muted-foreground md:text-lg">
            {t("landing.pricing.subheading")}
          </p>
        </ScrubBlock>

        <div
          ref={gridRef}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {TIERS.map((tier, i) => {
            const bullets = t(`landing.pricing.tiers.${tier.key}.bullets`, {
              returnObjects: true,
            }) as unknown as string[];
            const cadence = t(`landing.pricing.tiers.${tier.key}.cadence`);
            const cta = t(`landing.pricing.tiers.${tier.key}.cta`);
            return (
              <ScrubItem
                key={tier.key}
                progress={progress}
                index={i}
                cols={4}
                travel={200}
                className="h-full"
              >
                <div
                  className={cn(
                    "relative flex h-full flex-col gap-4 rounded-2xl border bg-card p-6",
                    tier.featured
                      ? "border-primary/60 shadow-[0_0_48px_rgba(236,27,105,0.22)]"
                      : "border-border",
                  )}
                >
                  {tier.featured ? (
                    <Badge className="brand-gradient absolute -top-2.5 left-6 text-[10px] uppercase text-primary-foreground">
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
                  <SmartCTA
                    href={tier.ctaHref}
                    className={cn(
                      "mt-auto inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition-transform hover:scale-[1.02]",
                      tier.featured
                        ? "brand-gradient text-primary-foreground"
                        : "border border-border bg-background text-foreground hover:border-primary/40",
                    )}
                  >
                    {cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </SmartCTA>
                </div>
              </ScrubItem>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground">
          {t("landing.pricing.footNote")}
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// Builders strip — the one contained band for secondary audiences
// ============================================================================

export function BuildersStripV2() {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrubProgress(ref);
  const mounted = useMounted();

  // Heading: letter-spacing contracts as it scrolls in (typographic "focus").
  const tracking = useTransform(progress, [0, 1], ["0.6em", "0.18em"]);
  const headingOpacity = useTransform(progress, [0, 0.6], [0.15, 1]);
  // The two cards slide in from opposite edges, scrubbed.
  const xLeft = useTransform(progress, [0.1, 1], ["-30vw", "0vw"]);
  const xRight = useTransform(progress, [0.1, 1], ["30vw", "0vw"]);
  const cardOpacity = useTransform(progress, [0.1, 0.7], [0, 1]);

  return (
    <section className="relative overflow-hidden border-y border-border/60 bg-background py-16 md:py-20">
      <div ref={ref} className="mx-auto max-w-6xl px-4 md:px-8">
        {mounted ? (
          <motion.p
            className="mb-8 text-center font-mono text-sm font-semibold uppercase text-muted-foreground"
            style={{ letterSpacing: tracking, opacity: headingOpacity }}
          >
            {t("landing.buildersStrip.heading")}
          </motion.p>
        ) : (
          <p className="mb-8 text-center font-mono text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {t("landing.buildersStrip.heading")}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {BUILDER_LINKS.map(({ Icon, key, href }, i) => {
            const card = (
              <a
                href={href}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card px-6 py-5 transition-colors hover:border-primary/40 glow-card"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-base font-medium text-foreground">
                    {t(`landing.buildersStrip.links.${key}.title`)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t(`landing.buildersStrip.links.${key}.desc`)}
                  </span>
                </span>
              </a>
            );
            if (!mounted) return <div key={key}>{card}</div>;
            return (
              <motion.div
                key={key}
                style={{
                  x: i === 0 ? xLeft : xRight,
                  opacity: cardOpacity,
                  willChange: "transform, opacity",
                }}
              >
                {card}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Talk to us — slide-in contacts + the existing ContactForm (unchanged)
// ============================================================================

export function TalkToUsV2() {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const progress = useScrubProgress(listRef);

  return (
    <section id="talk-to-us" className="relative overflow-hidden bg-background py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(236,27,105,0.10) 0%, transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <ScrubBlock className="mb-12 flex max-w-2xl flex-col gap-3 md:mb-16" travel={80}>
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
            {t("landing.talkToUs.heading")}
          </h2>
          <p className="text-base text-muted-foreground">
            {t("landing.talkToUs.subheading")}
          </p>
        </ScrubBlock>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div ref={listRef} className="flex flex-col gap-4">
            {CONTACTS.map(({ Icon, key, value, href }, i) => (
              <ScrubItem key={key} progress={progress} index={i} cols={1} travel={140}>
                <a
                  href={href}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 glow-card"
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
              </ScrubItem>
            ))}
            <ScrubItem progress={progress} index={3} cols={1} travel={140}>
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("landing.talkToUs.followAlong")}
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
                    href="https://www.linkedin.com/company/perkos/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40"
                  >
                    LinkedIn ↗
                  </Link>
                </div>
              </div>
            </ScrubItem>
          </div>

          <ScrubBlock travel={100}>
            <ContactForm />
          </ScrubBlock>
        </div>
      </div>
    </section>
  );
}
