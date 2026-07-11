"use client";

// ============================================================================
// TemplatesDeck — our "Featured Works": a sticky deck scrubbed by the wheel.
// Cards advance in PAIRS (5 slots for 10 templates) so the scroll stays
// tight. Each pair slides up from below on its slice of the section progress,
// holds the stage, then stacks back (scale down, dim) as the next pair
// arrives. Fully reversible. Poster bg = shared fal.ai texture + per-industry
// accent veil. Cards remain SmartCTA → /sign-in.
// ============================================================================

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";

import { SmartCTA } from "../../SmartCTA";
import { KineticHeading } from "./KineticHeading";
import { useMounted } from "./useMounted";
import { TEMPLATE_PITCHES, type TemplatePitch } from "./landingData";

const EASE = [0.16, 1, 0.3, 1] as const;

// 9 templates (consulting dropped per design review) grouped in trios → 3 slots.
const DECK_PITCHES = TEMPLATE_PITCHES.filter((t) => t.key !== "consulting");
const TRIOS: TemplatePitch[][] = [];
for (let i = 0; i < DECK_PITCHES.length; i += 3) {
  TRIOS.push(DECK_PITCHES.slice(i, i + 3));
}
const N = TRIOS.length;

// Asymmetric slot boundaries: the FIRST trio yields the stage early (16% of
// the runway instead of a uniform 33%) so motion starts almost immediately —
// the user felt a long dead scroll before anything moved. Slot i is active
// between BOUNDS[i] and BOUNDS[i+1].
const BOUNDS = [0, 0.16, 0.58, 1];

export function TemplatesDeck() {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  // State-driven visibility with asymmetric boundaries: exactly one trio
  // visible at a time (the scrub math alone let outgoing cards linger on
  // mobile), and the first swap fires early per BOUNDS.
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const idx = v < BOUNDS[1] ? 0 : v < BOUNDS[2] ? 1 : 2;
    setActive((prev) => (prev === idx ? prev : idx));
  });
  const mounted = useMounted();

  return (
    <section
      id="templates"
      ref={ref}
      className="relative bg-background"
      style={{ height: `${N * 60 + 100}vh` }}
    >
      {/* Pinned stage */}
      <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
        <KineticHeading className="pt-24" from="8%" to="-18%" pinned>
          {t("landing.templates.heading")}
        </KineticHeading>
        <p className="mx-auto mt-3 max-w-2xl px-4 text-center text-base text-muted-foreground">
          {t("landing.templates.subheading")}
        </p>

        <div className="relative flex-1">
          {mounted
            ? TRIOS.map((trio, i) => (
                <DeckTrio
                  key={trio[0].key}
                  trio={trio}
                  index={i}
                  progress={scrollYProgress}
                  activeNow={active === i}
                />
              ))
            : null}
        </div>

        <p className="pb-6 text-center text-xs text-muted-foreground">
          {t("landing.templates.footNoteBefore")}{" "}
          <Link
            href="#talk-to-us"
            className="pointer-events-auto text-primary underline-offset-2 hover:underline"
          >
            {t("landing.templates.footNoteLink")}
          </Link>
          {t("landing.templates.footNoteAfter")}
        </p>
      </div>
    </section>
  );
}

function DeckTrio({
  trio,
  index,
  progress,
  activeNow,
}: {
  trio: TemplatePitch[];
  index: number;
  progress: MotionValue<number>;
  activeNow: boolean;
}) {
  // Boundaries come from the asymmetric BOUNDS map (first slot is short).
  const start = BOUNDS[index];
  const settle = start + (BOUNDS[index + 1] - start) * 0.55;

  // Entrance stays scrubbed (rides the wheel); visibility is STATE-driven —
  // when a trio stops being active it animates to opacity 0 in 350ms,
  // guaranteed, on every device.
  const isFirst = index === 0;
  const y = useTransform(
    progress,
    isFirst ? [0, settle] : [start, settle],
    isFirst ? ["0vh", "0vh"] : ["95vh", "0vh"],
  );
  const rotate = useTransform(progress, [start, settle], isFirst ? [0, 0] : [3, 0]);

  return (
    // Outer motion wrapper owns the scroll transforms (vh units); the inner div
    // owns the static -50% centering so the trio sits vertically centered
    // between the subheading and the foot note.
    <motion.div
      className="absolute inset-x-3 top-1/2 md:inset-x-14 xl:inset-x-20"
      initial={false}
      animate={{ opacity: activeNow ? 1 : 0, scale: activeNow ? 1 : 0.9 }}
      transition={{ duration: 0.35, ease: EASE }}
      style={{
        y,
        rotate,
        zIndex: index + 1,
        pointerEvents: activeNow ? "auto" : "none",
        willChange: "transform, opacity",
      }}
    >
      <div className="grid -translate-y-1/2 grid-cols-1 gap-3 md:grid-cols-3 md:gap-5">
        {trio.map((tp, j) => (
          <DeckCard key={tp.key} tp={tp} number={index * 3 + j + 1} />
        ))}
      </div>
    </motion.div>
  );
}

function DeckCard({ tp, number }: { tp: TemplatePitch; number: number }) {
  const { t } = useTranslation();
  const { key, Icon, accent } = tp;

  return (
    <SmartCTA
      href="/sign-in"
      className="group relative block overflow-hidden rounded-3xl border border-white/10 shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
    >
      {/* Poster background: shared texture + industry accent veil */}
      <div className="absolute inset-0">
        <Image
          src="/hero/deck-texture.png"
          alt=""
          fill
          sizes="512px"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${accent}33 0%, rgba(14,7,22,0.88) 55%, rgba(14,7,22,0.96) 100%)`,
          }}
        />
      </div>

      {/* Compact on mobile (3 stacked cards must fit the pinned stage);
          full poster height on md+. */}
      <div className="relative flex min-h-[148px] flex-col justify-between gap-3 p-4 md:min-h-[360px] md:gap-5 md:p-9">
        <div className="flex items-start justify-between">
          <span
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 md:h-12 md:w-12 md:rounded-xl"
            style={{ background: `${accent}26`, color: accent }}
          >
            <Icon className="h-4 w-4 md:h-6 md:w-6" />
          </span>
          <span className="font-mono text-xs text-foreground/50 md:text-sm">
            ({String(number).padStart(2, "0")})
          </span>
        </div>

        <div className="flex flex-col gap-1.5 md:gap-2.5">
          <span
            className="font-semibold text-foreground"
            style={{ fontSize: "clamp(1.05rem, 2vw, 1.6rem)", lineHeight: 1.1 }}
          >
            {t(`landing.templates.items.${key}.name`)}
          </span>
          <span className="line-clamp-2 text-xs leading-relaxed text-foreground/70 md:line-clamp-none md:text-sm">
            {t(`landing.templates.items.${key}.pitch`)}
          </span>
          <span
            className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium opacity-80 transition-opacity group-hover:opacity-100 md:mt-1 md:text-sm"
            style={{ color: accent }}
          >
            {t("landing.templates.cardCta")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </SmartCTA>
  );
}
