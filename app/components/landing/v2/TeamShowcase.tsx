"use client";

// ============================================================================
// TeamShowcase — pinned two-row stage with the long editorial cards the user
// liked: row 1 sits center-to-LEFT and slides in left→right; row 2 sits
// center-to-RIGHT and slides in right→left. Scrolling swaps each row's card
// (fade out → next role fades in with the same directional slide), so all 4
// roles fit in a short pinned scene. Emblems are fal.ai renders restricted to
// the brand palette (magenta / coral / violet). Aurora parallax behind.
// ============================================================================

import Image from "next/image";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, useScroll } from "motion/react";

import { KineticHeading } from "./KineticHeading";
import { ParallaxLayer } from "./ParallaxLayer";
import { useActiveSlot } from "./useActiveSlot";
import { useMounted } from "./useMounted";
import { TEAM_ROLES, type TeamRole } from "./landingData";

const EASE = [0.16, 1, 0.3, 1] as const;

// Brand-palette emblems (regenerated: all magenta/coral/violet family).
const ROLE_ART: Record<string, string> = {
  pm: "/hero/role-pm-star.png",
  marketing: "/hero/role-marketing.png",
  researcher: "/hero/role-researcher.png",
  analyst: "/hero/role-analyst.png",
};

// Two slots; each slot shows one role per row.
// Row 1 (left-aligned): pm → researcher. Row 2 (right-aligned): marketing → analyst.
const ROW1: TeamRole[] = [TEAM_ROLES[0], TEAM_ROLES[2]];
const ROW2: TeamRole[] = [TEAM_ROLES[1], TEAM_ROLES[3]];

export function TeamShowcase() {
  const { t } = useTranslation();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const active = useActiveSlot(scrollYProgress, 2);
  const mounted = useMounted();

  return (
    <section ref={ref} className="relative bg-background" style={{ height: "220vh" }}>
      <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
        {/* Aurora backdrop — fast opposite parallax */}
        <ParallaxLayer
          speed={-220}
          className="pointer-events-none absolute -inset-y-[30%] inset-x-0"
        >
          <div className="relative h-full w-full scale-[1.35]">
            <Image
              src="/hero/aurora.png"
              alt=""
              fill
              sizes="100vw"
              className="object-cover opacity-60"
            />
          </div>
        </ParallaxLayer>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(180deg, #0e0716 0%, rgba(14,7,22,0.4) 30%, rgba(14,7,22,0.4) 70%, #0e0716 100%)",
          }}
        />

        <div className="relative">
          <KineticHeading className="pt-24" from="-14%" to="8%">
            {t("landing.meetYourTeam.heading")}
          </KineticHeading>
          <p className="mx-auto mt-3 max-w-2xl px-4 text-center text-base text-muted-foreground">
            {t("landing.meetYourTeam.subheading")}
          </p>
        </div>

        {/* Stage — two rows, each swapping its card on scroll */}
        <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-4 md:px-8">
          {/* Row 1 — center → left, slides in from the LEFT */}
          <div className="relative md:mr-24">
            {ROW1.map((role, i) => (
              <RowCard
                key={role.key}
                role={role}
                number={i === 0 ? 1 : 3}
                activeNow={mounted && active === i}
                fromLeft
                absolute={i > 0}
              />
            ))}
          </div>
          {/* Row 2 — center → right, slides in from the RIGHT */}
          <div className="relative md:ml-24">
            {ROW2.map((role, i) => (
              <RowCard
                key={role.key}
                role={role}
                number={i === 0 ? 2 : 4}
                activeNow={mounted && active === i}
                fromLeft={false}
                absolute={i > 0}
              />
            ))}
          </div>
        </div>

        {/* Slot indicator + foot note */}
        <div className="relative flex flex-col items-center gap-4 pb-10">
          <div className="flex gap-2">
            {[0, 1].map((i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  active === i ? "brand-gradient w-8" : "w-3 bg-border"
                }`}
              />
            ))}
          </div>
          <p className="px-4 text-center text-sm text-muted-foreground">
            {t("landing.meetYourTeam.footNote")}
          </p>
        </div>
      </div>
    </section>
  );
}

function RowCard({
  role,
  number,
  activeNow,
  fromLeft,
  absolute,
}: {
  role: TeamRole;
  number: number;
  activeNow: boolean;
  fromLeft: boolean;
  absolute: boolean;
}) {
  const { t } = useTranslation();
  const name = t(`landing.meetYourTeam.roles.${role.key}.name`);

  return (
    <motion.div
      className={absolute ? "absolute inset-0" : "relative"}
      initial={false}
      animate={{
        opacity: activeNow ? 1 : 0,
        x: activeNow ? "0vw" : fromLeft ? "-22vw" : "22vw",
      }}
      transition={{ duration: 0.55, ease: EASE }}
      style={{ pointerEvents: activeNow ? "auto" : "none", willChange: "transform, opacity" }}
    >
      <div
        className={`flex items-center gap-5 rounded-2xl border border-border bg-card/90 p-5 backdrop-blur-sm glow-card md:gap-8 md:p-6 ${
          fromLeft ? "" : "md:flex-row-reverse"
        }`}
      >
        <span className="relative block h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-[0_12px_48px_rgba(0,0,0,0.5)] md:h-28 md:w-28">
          <Image
            src={ROLE_ART[role.presetId] ?? ROLE_ART.pm}
            alt=""
            fill
            sizes="112px"
            className="object-cover"
          />
        </span>
        <div className={`flex flex-1 flex-col gap-1.5 ${fromLeft ? "text-left" : "md:text-right"}`}>
          <span className="font-mono text-[11px] text-foreground/40">
            ({String(number).padStart(2, "0")})
          </span>
          <span className="text-xl font-semibold leading-tight text-foreground md:text-2xl">
            {name}
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
            {t(`landing.meetYourTeam.roles.${role.key}.blurb`)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
