"use client";

// ============================================================================
// HeroV2 — PINNED cinematic hero (Palmer move). The section is sticky at
// top: 0 / z-0; everything after lives in a z-10 block that scrolls up and
// COVERS it. While being covered the hero reacts scroll-linked: the nebula
// zooms in, the headline scales down / drifts up / fades — every frame tied
// to scrollY. Ember particles float above the art. Same landing.hero.* keys.
// ============================================================================

import type { ReactNode } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check } from "lucide-react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";

import { SmartCTA } from "../../SmartCTA";
import { Reveal, RevealItem } from "./Reveal";
import { Particles } from "./Particles";
import { SparkyVideo } from "./SparkyVideo";
import { useMdUp, useMounted } from "./useMounted";

export function HeroV2() {
  const { t } = useTranslation();
  const mounted = useMounted();

  // Scroll-linked (global scrollY): reacts while the cover block slides over.
  //
  // Desktop shows copy and Sparky together, so everything fades on one short
  // curve. Phones can't fit both, so the pinned hero plays two beats instead:
  //   beat 1  the copy alone over a dark veil, then it lifts away
  //   beat 2  the veil clears and Sparky is alone, turning as you scroll
  // Ranges are viewport-relative there, which is why these are functions.
  const mdUp = useMdUp();
  const { scrollY } = useScroll();
  const vh = () => (typeof window === "undefined" ? 800 : window.innerHeight);
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

  // The art layer drifts down as the cover block rises — a parallax that only
  // makes sense while the hero is being swallowed. On phones the hero stays
  // pinned for an extra screen, so that drift runs to its limit and pushes the
  // video past the wrapper's 6% margin, leaving a gap above Sparky. There the
  // layer holds its place and only breathes a little wider.
  const nebScale = useTransform(scrollY, (y) =>
    mdUp ? 1 + 0.22 * clamp01(y / 900) : 1 + 0.1 * clamp01(y / (vh() * 1.6)),
  );
  const nebY = useTransform(scrollY, (y) => (mdUp ? 140 * clamp01(y / 900) : 0));

  // Desktop keeps the whole copy block on one curve — that reads fine there,
  // where Sparky is beside it. On phones the block IS the show, so each line
  // leaves on its own timing instead (see HeroExit); the shared transform goes
  // neutral to avoid stacking the two.
  const copyProgress = (y: number) => (mdUp ? clamp01(y / 700) : 0);
  const titleScale = useTransform(scrollY, (y) => 1 - 0.18 * copyProgress(y));
  const titleY = useTransform(scrollY, (y) => -160 * copyProgress(y));
  const titleOpacity = useTransform(scrollY, (y) =>
    mdUp ? clamp01(1 - y / 550) : 1,
  );

  // Phones only: the veil that hides the scene during beat 1 and lifts to hand
  // the stage over to Sparky.
  const veilOpacity = useTransform(scrollY, (y) => {
    const h = vh();
    return 1 - clamp01((y - h * 0.2) / (h * 0.38));
  });

  // Reduced motion gets the still frame — same composition, no movement.
  const reduced = useReducedMotion();
  const heroArt = reduced ? (
    <Image
      src="/hero/sparky-hero-poster.jpg"
      alt=""
      fill
      priority
      sizes="100vw"
      className="object-cover object-right"
    />
  ) : (
    <SparkyVideo
      desktop={{ src: "/hero/sparky-hero.mp4", poster: "/hero/sparky-hero-poster.jpg" }}
      mobile={{
        src: "/hero/sparky-hero-mobile.mp4",
        poster: "/hero/sparky-hero-mobile-poster.jpg",
      }}
    />
  );

  return (
    <section className="sticky top-0 z-0 flex h-screen flex-col overflow-hidden">
      {/* Base art layer — the nebula with Sparky baked in. The clip is not on a
          clock: it idles in a loop at rest and is scrubbed by scrollY once you
          start moving, so he turns to face you as you scroll. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {mounted ? (
          <motion.div
            className="absolute -inset-[6%]"
            style={{ scale: nebScale, y: nebY, willChange: "transform" }}
          >
            {heroArt}
          </motion.div>
        ) : (
          <div className="absolute -inset-[6%]">{heroArt}</div>
        )}
        {/* Scrim keeping the copy legible over the art. It has to follow the
            layout: on phones Sparky sits above the copy, so the veil runs
            top→bottom instead of left→right. */}
        {/* Phones, beat 1: a near-solid veil so the copy reads on its own.
            It lifts as you scroll, revealing Sparky for beat 2. */}
        {mounted ? (
          <motion.div
            className="absolute inset-0 bg-[#0e0716] md:hidden"
            style={{ opacity: veilOpacity }}
          />
        ) : (
          <div className="absolute inset-0 bg-[#0e0716] md:hidden" />
        )}
        <div
          className="absolute inset-0 hidden md:block"
          style={{
            backgroundImage:
              "linear-gradient(90deg, #0e0716 2%, rgba(14,7,22,0.62) 34%, rgba(14,7,22,0.08) 66%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-28"
          style={{ backgroundImage: "linear-gradient(180deg, #0e0716, transparent)" }}
        />
      </div>

      {/* Ember particles above the art */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[5]">
        <Particles density={70} />
      </div>

      {/* Editorial chrome bar */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-4 pt-28 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70 md:px-8">
        <span className="inline-flex items-center gap-2">
          <span className="text-primary">✦</span>
          {t("landing.hero.badge")}
        </span>
        <span className="hidden text-foreground/60 md:inline">PerkOS®</span>
      </div>

      {/* Content — scales away as the cover block rises */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-4 md:px-8">
        <motion.div
          style={
            mounted
              ? {
                  scale: titleScale,
                  y: titleY,
                  opacity: titleOpacity,
                  transformOrigin: "left center",
                  willChange: "transform, opacity",
                }
              : undefined
          }
          className="w-full"
        >
          <Reveal stagger className="flex max-w-3xl flex-col items-start gap-7 pb-24 text-left">
            <RevealItem index={0}>
              <HeroExit index={0} mdUp={mdUp} scrollY={scrollY}>
              <h1
                className="font-semibold text-foreground [text-shadow:0_2px_40px_rgba(0,0,0,0.5)]"
                style={{
                  fontSize: "clamp(3rem, 8vw, 6.5rem)",
                  lineHeight: 0.96,
                  letterSpacing: "-0.04em",
                }}
              >
                {t("landing.hero.titleBefore")}{" "}
                <span className="brand-gradient-text">
                  {t("landing.hero.titleHighlight")}
                </span>
                {t("landing.hero.titleAfter")}
              </h1>
              </HeroExit>
            </RevealItem>

            <RevealItem index={1}>
              <HeroExit index={1} mdUp={mdUp} scrollY={scrollY}>
                <p className="max-w-lg text-base leading-relaxed text-foreground/70 md:text-lg">
                  {t("landing.hero.subtitle")}
                </p>
              </HeroExit>
            </RevealItem>

            <RevealItem index={2}>
              <HeroExit index={2} mdUp={mdUp} scrollY={scrollY}>
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <SmartCTA
                  href="/sign-in"
                  analyticsId="hero_primary"
                  className="brand-gradient group inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-[0_0_44px_rgba(236,27,105,0.5)] transition-transform hover:scale-[1.03]"
                >
                  {t("landing.hero.ctaPrimary")}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </SmartCTA>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center gap-1 rounded-full px-5 py-3.5 text-[15px] text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {t("landing.hero.ctaSecondary")}
                </a>
              </div>
              </HeroExit>
            </RevealItem>

            <RevealItem index={3}>
              <HeroExit index={3} mdUp={mdUp} scrollY={scrollY}>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-3 text-xs text-foreground/60">
                  <TrustChip label={t("landing.hero.trust.approve")} />
                  <TrustChip label={t("landing.hero.trust.ready")} />
                  <TrustChip label={t("landing.hero.trust.noTech")} />
                  <TrustChip label={t("landing.hero.trust.cancel")} />
                </div>
              </HeroExit>
            </RevealItem>
          </Reveal>
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// HeroExit — phones only. Each line of copy leaves on its own timing and its
// own distance, peeling off one after another instead of the whole block
// dissolving at once. Later lines start later, travel further and accelerate
// harder, so the copy reads as being pulled away rather than switched off.
// On md+ it renders nothing of its own: the shared transform still owns it.
// ---------------------------------------------------------------------------
function HeroExit({
  index,
  mdUp,
  scrollY,
  children,
}: {
  index: number;
  mdUp: boolean;
  scrollY: MotionValue<number>;
  children: ReactNode;
}) {
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  // Exit eases IN: slow to let go, then away quickly.
  const progress = (y: number) => {
    if (mdUp) return 0;
    const h = typeof window === "undefined" ? 800 : window.innerHeight;
    const start = h * (0.05 + index * 0.045);
    const span = h * 0.24;
    return clamp01((y - start) / span) ** 1.7;
  };

  const y = useTransform(scrollY, (v) => -(80 + index * 38) * progress(v));
  const opacity = useTransform(scrollY, (v) => 1 - progress(v));
  const scale = useTransform(scrollY, (v) => 1 - (index === 0 ? 0.06 : 0.02) * progress(v));

  return (
    <motion.div style={{ y, opacity, scale, transformOrigin: "left center" }}>
      {children}
    </motion.div>
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
