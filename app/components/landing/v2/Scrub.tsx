"use client";

// ============================================================================
// Scrub — scroll-LINKED (scrubbed) entrances, Palmer-style. Unlike a one-shot
// fade, position/opacity are tied to scroll progress every frame: scroll down
// → cards rise in; scroll up → they sink back. Reversible, impossible to miss.
//
//   const ref = useRef(null);
//   const progress = useScrubProgress(ref);   // 0→1 as the block scrolls in
//   <div ref={ref} className="grid …">
//     {items.map((_, i) => (
//       <ScrubItem key={i} progress={progress} index={i} cols={3}>…</ScrubItem>
//     ))}
//   </div>
//
// SSR/first paint renders a plain visible div (hydration-safe); motion takes
// over after mount (same useMounted pattern as TiltCard/ParallaxLayer).
// ============================================================================

import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useRef, type ReactNode, type RefObject } from "react";

import { useMounted } from "./useMounted";

// Progress 0→1 while the target block travels from 92% viewport to 30%.
export function useScrubProgress(ref: RefObject<HTMLElement | null>) {
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.92", "start 0.3"],
  });
  return scrollYProgress;
}

type ScrubItemProps = {
  progress: MotionValue<number>;
  index: number;
  /** Columns in the grid — staggers by row + column. */
  cols?: number;
  children: ReactNode;
  className?: string;
  /** Px the item travels up while scrubbing in. */
  travel?: number;
};

export function ScrubItem({
  progress,
  index,
  cols = 3,
  children,
  className,
  travel = 170,
}: ScrubItemProps) {
  const mounted = useMounted();

  const row = Math.floor(index / cols);
  const col = index % cols;
  const start = Math.min(row * 0.13 + col * 0.05, 0.55);
  const end = Math.min(start + 0.4, 1);

  const y = useTransform(progress, [start, end], [travel, 0]);
  const opacity = useTransform(progress, [start, Math.min(start + 0.3, 1)], [0, 1]);
  const rotate = useTransform(progress, [start, end], [3.5, 0]);

  if (!mounted) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      style={{ y, opacity, rotate, willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}

// ClipReveal — scrubbed clip-path wipe (viktoriiakoshyl-style): the element
// un-masks from the bottom as it scrolls in. More dramatic than a fade.
export function ClipReveal({
  children,
  className,
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrubProgress(ref);
  const mounted = useMounted();

  const start = Math.min(index * 0.12, 0.5);
  const end = Math.min(start + 0.45, 1);
  const clip = useTransform(
    progress,
    [start, end],
    ["inset(100% 0% 0% 0%)", "inset(0% 0% 0% 0%)"],
  );
  const y = useTransform(progress, [start, end], [60, 0]);

  if (!mounted) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ clipPath: clip, y, willChange: "clip-path, transform" }}
    >
      {children}
    </motion.div>
  );
}

// Block-level scrubbed wrapper for single elements (headings, paragraphs).
export function ScrubBlock({
  children,
  className,
  travel = 110,
}: {
  children: ReactNode;
  className?: string;
  travel?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrubProgress(ref);
  const mounted = useMounted();
  const y = useTransform(progress, [0, 1], [travel, 0]);
  const opacity = useTransform(progress, [0, 0.7], [0, 1]);

  if (!mounted) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ y, opacity, willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}
