"use client";

// ============================================================================
// ParallaxLayer — moves its children on the Y axis as the section scrolls past,
// at a fraction of the scroll speed. Stack two layers with different `speed`
// values to get the two-speed parallax from the reference (slow backdrop +
// faster foreground).
//
//   <div className="relative">
//     <ParallaxLayer speed={-60}>…backdrop…</ParallaxLayer>
//     <ParallaxLayer speed={40}>…foreground…</ParallaxLayer>
//   </div>
//
// `speed` = total px of travel across the element's scroll pass (sign = dir).
// Respects prefers-reduced-motion: renders a static <div>.
// ============================================================================

import { motion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

import { useMounted } from "./useMounted";

type ParallaxLayerProps = {
  children: ReactNode;
  className?: string;
  /** Px of vertical travel over the scroll pass. Negative = moves up. */
  speed?: number;
};

export function ParallaxLayer({
  children,
  className,
  speed = 40,
}: ParallaxLayerProps) {
  const mounted = useMounted();
  const ref = useRef<HTMLDivElement>(null);

  // Progress from when the element enters (bottom) to when it leaves (top).
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [-speed, speed]);

  // SSR / first paint → plain static wrapper (hydration-safe).
  if (!mounted) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div ref={ref} className={className} style={{ y, willChange: "transform" }}>
      {children}
    </motion.div>
  );
}
