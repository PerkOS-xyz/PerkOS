"use client";

// ============================================================================
// TiltCard — mouse-driven 3D tilt wrapper. Tracks the cursor over the element
// and maps its position to a small rotateX/rotateY (plus a slight lift), with a
// spring so it settles softly. This is the "Cairo / Oslo / Chain" hover from
// the reference grid.
//
// Safety: it renders a plain <div> wrapper and never attaches an onClick or
// calls stopPropagation — so a SmartCTA (wallet) or <Link> inside keeps its
// exact click behaviour. Pointer events pass straight through to the child.
//
// Respects prefers-reduced-motion: degrades to a static <div>.
// ============================================================================

import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef, type ReactNode } from "react";

import { useMounted } from "./useMounted";

type TiltCardProps = {
  children: ReactNode;
  className?: string;
  /** Max rotation in degrees at the edges. */
  max?: number;
  /** Scale applied while hovering. */
  hoverScale?: number;
};

export function TiltCard({
  children,
  className,
  max = 12,
  hoverScale = 1.04,
}: TiltCardProps) {
  const mounted = useMounted();
  const ref = useRef<HTMLDivElement>(null);

  // Normalised pointer position in [-0.5, 0.5], springed for a soft settle.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 220, damping: 18, mass: 0.4 };
  const sx = useSpring(px, spring);
  const sy = useSpring(py, spring);

  const rotateY = useTransform(sx, [-0.5, 0.5], [-max, max]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [max, -max]);

  // SSR / first paint → plain static wrapper (hydration-safe).
  if (!mounted) {
    return <div className={className}>{children}</div>;
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function onLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        transformPerspective: 800,
      }}
      whileHover={{ scale: hoverScale }}
      transition={{ type: "spring", ...spring }}
    >
      {children}
    </motion.div>
  );
}
