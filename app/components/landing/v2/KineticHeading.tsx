"use client";

// ============================================================================
// KineticHeading — giant section heading that slides horizontally as you
// scroll (Palmer's "Featured Works" move). Still a semantic <h2>, same i18n
// text, just oversized, nowrap and bleeding past the edges. The x position is
// scroll-linked (scrubbed), so any wheel movement translates it.
// ============================================================================

import { motion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

import { useMounted } from "./useMounted";

const HEADING_STYLE: React.CSSProperties = {
  fontSize: "clamp(3.25rem, 10vw, 8rem)",
  lineHeight: 1,
  letterSpacing: "-0.04em",
};

export function KineticHeading({
  children,
  className,
  from = "10%",
  to = "-16%",
}: {
  children: ReactNode;
  className?: string;
  /** Horizontal travel across the section's viewport transit. */
  from?: string;
  to?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const x = useTransform(scrollYProgress, [0, 1], [from, to]);
  const mounted = useMounted();

  return (
    <div ref={ref} className={`overflow-hidden ${className ?? ""}`}>
      {mounted ? (
        <motion.h2
          className="whitespace-nowrap font-semibold text-foreground"
          style={{ ...HEADING_STYLE, x, willChange: "transform" }}
        >
          {children}
        </motion.h2>
      ) : (
        <h2
          className="whitespace-nowrap font-semibold text-foreground"
          style={HEADING_STYLE}
        >
          {children}
        </h2>
      )}
    </div>
  );
}
