"use client";

// ============================================================================
// HeroV2 — PINNED cinematic hero (Palmer move). The section is sticky at
// top: 0 / z-0; everything after lives in a z-10 block that scrolls up and
// COVERS it. While being covered the hero reacts scroll-linked: the nebula
// zooms in, the headline scales down / drifts up / fades — every frame tied
// to scrollY. Ember particles float above the art. Same landing.hero.* keys.
// ============================================================================

import Image from "next/image";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";

import { SmartCTA } from "../../SmartCTA";
import { Reveal, RevealItem } from "./Reveal";
import { Particles } from "./Particles";
import { useMounted } from "./useMounted";

export function HeroV2() {
  const { t } = useTranslation();
  const mounted = useMounted();

  // Scroll-linked (global scrollY): reacts while the cover block slides over.
  const { scrollY } = useScroll();
  const nebScale = useTransform(scrollY, [0, 900], [1, 1.22]);
  const nebY = useTransform(scrollY, [0, 900], [0, 140]);
  const titleScale = useTransform(scrollY, [0, 700], [1, 0.82]);
  const titleY = useTransform(scrollY, [0, 700], [0, -160]);
  const titleOpacity = useTransform(scrollY, [0, 550], [1, 0]);

  return (
    <section className="sticky top-0 z-0 flex h-screen flex-col overflow-hidden">
      {/* Base art layer — nebula, zooming as the page scrolls over it. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {mounted ? (
          <motion.div
            className="absolute -inset-[6%]"
            style={{ scale: nebScale, y: nebY, willChange: "transform" }}
          >
            <Image
              src="/hero/nebula.png"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-right"
            />
          </motion.div>
        ) : (
          <div className="absolute -inset-[6%]">
            <Image
              src="/hero/nebula.png"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-right"
            />
          </div>
        )}
        {/* left→right scrim so copy stays legible over the art */}
        <div
          className="absolute inset-0"
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
            </RevealItem>

            <RevealItem index={1}>
              <p className="max-w-lg text-base leading-relaxed text-foreground/70 md:text-lg">
                {t("landing.hero.subtitle")}
              </p>
            </RevealItem>

            <RevealItem index={2}>
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <SmartCTA
                  href="/sign-in"
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
            </RevealItem>

            <RevealItem index={3}>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-3 text-xs text-foreground/60">
                <TrustChip label={t("landing.hero.trust.approve")} />
                <TrustChip label={t("landing.hero.trust.ready")} />
                <TrustChip label={t("landing.hero.trust.noTech")} />
                <TrustChip label={t("landing.hero.trust.cancel")} />
              </div>
            </RevealItem>
          </Reveal>
        </motion.div>
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
