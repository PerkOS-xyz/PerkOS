"use client";

// ============================================================================
// LandingContentV2 — Palmer-style scroll experience (branch dex/landing).
//
// Structure = the cover trick: HeroV2 is sticky top-0 z-0 (pinned); everything
// after lives in a relative z-10 opaque block that scrolls up and COVERS it.
// Lenis provides momentum. The nav is fixed and hides on scroll-down /
// returns on scroll-up. All copy via existing landing.* i18n keys.
// ============================================================================

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import { ReactLenis } from "lenis/react";
import { motion, useScroll, useMotionValueEvent } from "motion/react";

import { SmartCTA } from "../../SmartCTA";
import { LanguageSelector } from "../../LanguageSelector";
import { HeroV2 } from "./HeroV2";
import { TornadoRing } from "./TornadoRing";
import { TemplatesDeck } from "./TemplatesDeck";
import { TeamShowcase } from "./TeamShowcase";
import {
  FearKillersV2,
  HowItWorksV2,
  ExpertiseV2,
  ComparisonV2,
  BeyondTeamsV2,
  PricingV2,
  BuildersStripV2,
  TalkToUsV2,
} from "./SectionsV2";
import { ParallaxLayer } from "./ParallaxLayer";
import { Particles } from "./Particles";
import { ScrubBlock } from "./Scrub";

const EASE = [0.16, 1, 0.3, 1] as const;

export function LandingContentV2() {
  return (
    <ReactLenis
      root
      // anchors: Lenis handles in-page #hash clicks with its own scrollTo —
      // without it, the native hash jump desyncs Lenis' internal position and
      // the next wheel tick snaps the user back (nav links "didn't work").
      // offset clears the fixed 80px nav.
      options={{ lerp: 0.08, smoothWheel: true, anchors: { offset: -88 } }}
    >
      <TopNavV2 />
      <main>
        {/* Pinned hero (z-0) … */}
        <HeroV2 />
        {/* … covered by everything below (z-10, opaque). Section order mirrors
            the original landing so nothing is skipped. */}
        <div className="relative z-10 bg-background">
          <TornadoRing />
          <FearKillersV2 />
          <TemplatesDeck />
          <TeamShowcase />
          <HowItWorksV2 />
          <ExpertiseV2 />
          <ComparisonV2 />
          <BeyondTeamsV2 />
          <PricingV2 />
          <BuildersStripV2 />
          <TalkToUsV2 />
          <FinalCTAV2 />
          <FooterV2 />
        </div>
      </main>
    </ReactLenis>
  );
}

// ============================================================================
// Nav — fixed, hides on scroll-down, returns on scroll-up (Palmer behaviour).
// ============================================================================

function TopNavV2() {
  const { t } = useTranslation();
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    if (y > prev + 4 && y > 140) setHidden(true);
    else if (y < prev - 4) setHidden(false);
  });

  return (
    <motion.header
      animate={{ y: hidden ? -96 : 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-md"
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/perkos-header.png"
            alt="PerkOS AI"
            width={150}
            height={52}
            priority
          />
        </Link>
        {/* Hash links are plain <a> (not next/link): the router's own hash
            scroll bypasses Lenis; plain anchors let Lenis' `anchors` handler
            drive the smooth scroll. */}
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="#templates" className="transition-colors hover:text-foreground">
            {t("landing.nav.forYourBusiness")}
          </a>
          <a href="#how-it-works" className="transition-colors hover:text-foreground">
            {t("landing.nav.howItWorks")}
          </a>
          <a href="#expertise" className="transition-colors hover:text-foreground">
            {t("landing.nav.whyPerkos")}
          </a>
          <a href="#pricing" className="transition-colors hover:text-foreground">
            {t("landing.nav.pricing")}
          </a>
          <a href="#talk-to-us" className="transition-colors hover:text-foreground">
            {t("landing.nav.talkToUs")}
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <SmartCTA
            href="/sign-in"
            analyticsId="nav_primary"
            className="brand-gradient inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03] sm:px-4"
          >
            <span className="hidden sm:inline">{t("landing.nav.meetYourTeam")}</span>
            <span className="sm:hidden">{t("landing.nav.start")}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </SmartCTA>
        </div>
      </div>
    </motion.header>
  );
}

// ============================================================================
// Final CTA — nebula-cta art zooming behind, particles, scrubbed content.
// ============================================================================

function FinalCTAV2() {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden bg-background py-28 md:py-40">
      <ParallaxLayer
        speed={-140}
        className="pointer-events-none absolute -inset-y-[25%] inset-x-0"
      >
        <div className="relative h-full w-full scale-[1.25]">
          <Image
            src="/hero/nebula-cta.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-70"
          />
        </div>
      </ParallaxLayer>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, #0e0716 0%, rgba(14,7,22,0.2) 35%, rgba(14,7,22,0.2) 65%, #0e0716 100%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <Particles density={45} />
      </div>

      <ScrubBlock
        travel={120}
        className="relative mx-auto flex max-w-3xl flex-col items-center gap-7 px-4 text-center"
      >
        <h2
          className="font-semibold leading-tight tracking-tight [text-shadow:0_2px_40px_rgba(0,0,0,0.6)]"
          style={{ fontSize: "clamp(2.25rem, 5.5vw, 4.5rem)" }}
        >
          {t("landing.finalCTA.heading")}
        </h2>
        <p className="max-w-xl text-base text-foreground/75">
          {t("landing.finalCTA.subheading")}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <SmartCTA
            href="/sign-in"
            analyticsId="final_primary"
            className="brand-gradient inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-[0_0_44px_rgba(236,27,105,0.5)] transition-transform hover:scale-[1.03]"
          >
            {t("landing.finalCTA.ctaPrimary")}
            <ArrowRight className="h-4 w-4" />
          </SmartCTA>
          <a
            href="#talk-to-us"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card/60 px-7 py-3.5 text-[15px] text-foreground backdrop-blur-sm transition-colors hover:border-primary/40"
          >
            {t("landing.finalCTA.ctaSecondary")}
          </a>
        </div>
      </ScrubBlock>
    </section>
  );
}

function FooterV2() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border bg-background py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="flex flex-col gap-3">
            <Link href="/" className="inline-flex items-center gap-2">
              <Image src="/perkos-header.png" alt="PerkOS AI" width={130} height={28} />
            </Link>
            <p className="max-w-xs text-sm text-muted-foreground">
              {t("landing.footer.tagline")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/about" className="transition-colors hover:text-foreground">
              About
            </Link>
            <Link href="/ai-teams-for-small-business" className="transition-colors hover:text-foreground">
              AI teams
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/solutions/restaurants" className="transition-colors hover:text-foreground">
              Restaurants
            </Link>
            <Link href="/solutions/real-estate" className="transition-colors hover:text-foreground">
              Real estate
            </Link>
            <Link href="/solutions/ecommerce" className="transition-colors hover:text-foreground">
              Ecommerce
            </Link>
            <Link href="/solutions/agencies" className="transition-colors hover:text-foreground">
              Agencies
            </Link>
            <a href="#templates" className="transition-colors hover:text-foreground">
              {t("landing.footer.links.forYourBusiness")}
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              {t("landing.footer.links.howItWorks")}
            </a>
            <a href="#expertise" className="transition-colors hover:text-foreground">
              {t("landing.footer.links.whyPerkos")}
            </a>
            <a href="#talk-to-us" className="transition-colors hover:text-foreground">
              {t("landing.footer.links.contact")}
            </a>
          </div>
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          {t("landing.footer.copyright", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
