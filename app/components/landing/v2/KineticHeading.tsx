"use client";

// ============================================================================
// KineticHeading — giant section heading that slides horizontally as you
// scroll (Palmer's "Featured Works" move). Semantic <h2>, same i18n text,
// scrubbed x travel on wide desktops and a readable wrapped layout on
// mobile, tablet, and compact laptop screens.
//
// Non-pinned: percentage travel over the heading's own transit (original).
// pinned: the heading lives in a sticky stage, where its own rect freezes at
// an imprecise point (cutting leading/trailing letters on every viewport).
// Instead we bind to the parent <section>'s progress and use MEASURED pixel
// anchors: sweep in from the travel side → at pin start the sentence's lead
// edge is fully visible → drift slowly across the FULL line while the stage
// is pinned (you read the whole sentence as the cards pass) → accelerate out.
// On narrower screens, translated headings can be substantially wider than
// the viewport. They therefore wrap in place instead of moving horizontally.
// Direction follows the section's travel side on wide desktops.
// ============================================================================

import { motion, useScroll, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { use2xlUp, useMounted } from "./useMounted";

// paddingBottom reserves room for descenders (g/p/y) — with lineHeight ~1 the
// wrapper's overflow-hidden was clipping them.
const DESKTOP_STYLE: React.CSSProperties = {
  fontSize: "clamp(3.25rem, 10vw, 8rem)",
  lineHeight: 1,
  letterSpacing: "-0.04em",
  paddingBottom: "0.14em",
};

// Compact desktop variant: sized so a long sentence fits the viewport whole.
const DESKTOP_COMPACT_STYLE: React.CSSProperties = {
  fontSize: "clamp(2.5rem, 6.5vw, 5.25rem)",
  lineHeight: 1.05,
  letterSpacing: "-0.035em",
  paddingBottom: "0.14em",
};

// Mobile through compact laptop: full-width and allowed to wrap so every
// translation remains legible without oversized tablet typography.
const READABLE_STYLE: React.CSSProperties = {
  fontSize: "clamp(1.75rem, 5vw, 3.5rem)",
  lineHeight: 1.1,
  letterSpacing: "-0.03em",
  paddingBottom: "0.14em",
};

const HEADING_CLASS_NAME =
  "w-full whitespace-normal break-words px-4 text-center font-semibold text-foreground 2xl:whitespace-nowrap 2xl:px-0 2xl:text-left";

export function KineticHeading({
  children,
  className,
  from = "10%",
  to = "-16%",
  pinned = false,
  compact = false,
}: {
  children: ReactNode;
  className?: string;
  /** Horizontal travel across the section's viewport transit. */
  from?: string;
  to?: string;
  /** Set when the heading sits inside a pinned (sticky) stage. */
  pinned?: boolean;
  /** Smaller desktop scale — lets a long sentence fit the viewport whole. */
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const h2Ref = useRef<HTMLHeadingElement>(null);
  const mounted = useMounted();
  const twoXlUp = use2xlUp();

  // Own-transit progress (non-pinned sections).
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const xOwn = useTransform(scrollYProgress, [0, 1], [from, to]);

  // Section-transit progress (pinned): keeps advancing through the pin.
  const sectionRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    sectionRef.current = ref.current?.closest("section") ?? ref.current;
  }, []);
  const { scrollYProgress: sectionProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Measure text width (W) vs container width (V) — re-measures on resize
  // and when the translated text changes (ResizeObserver on the h2).
  const [dims, setDims] = useState({ W: 0, V: 0 });
  useEffect(() => {
    const el = h2Ref.current;
    const wrap = ref.current;
    if (!el || !wrap) return;
    const measure = () =>
      setDims({ W: el.scrollWidth, V: wrap.clientWidth });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [twoXlUp]);

  // Pixel anchors: lead edge visible ↔ tail edge visible.
  const dir = parseFloat(from) >= 0 ? 1 : -1;
  const startAnchor = 8; // sentence start at the container's left edge
  const endAnchor = Math.min(startAnchor, dims.V - dims.W - 8); // tail visible
  const xPinned = useTransform(
    sectionProgress,
    [0, 0.12, 0.88, 1],
    dir > 0
      ? [startAnchor + dims.V * 0.35, startAnchor, endAnchor, endAnchor - dims.V * 0.18]
      : [endAnchor - dims.V * 0.35, endAnchor, startAnchor, startAnchor + dims.V * 0.18],
  );

  const style = twoXlUp
    ? compact
      ? DESKTOP_COMPACT_STYLE
      : DESKTOP_STYLE
    : READABLE_STYLE;
  // Long translated headings must never slide beyond a narrow viewport.
  // Keep the kinetic treatment at 2xl+ and render the complete text in place
  // below that breakpoint, including tablets and compact laptops.
  const x = twoXlUp ? (pinned ? xPinned : xOwn) : 0;

  return (
    <div ref={ref} className={`overflow-hidden ${className ?? ""}`}>
      {mounted ? (
        <motion.h2
          ref={h2Ref}
          className={HEADING_CLASS_NAME}
          style={{ ...style, x, willChange: twoXlUp ? "transform" : "auto" }}
        >
          {children}
        </motion.h2>
      ) : (
        <h2
          ref={h2Ref}
          className={HEADING_CLASS_NAME}
          style={style}
        >
          {children}
        </h2>
      )}
    </div>
  );
}
