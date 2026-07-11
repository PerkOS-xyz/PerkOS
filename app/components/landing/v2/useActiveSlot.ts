"use client";

import { useState } from "react";
import { useMotionValueEvent, type MotionValue } from "motion/react";

// Maps a scroll progress MotionValue (0→1) to a discrete active slot index.
// State-driven (not per-frame opacity math), so exactly ONE slot is active at
// any time — no ghosting/overlap between outgoing and incoming content, and
// no stale initial values when the section hasn't been measured yet.
export function useActiveSlot(progress: MotionValue<number>, count: number) {
  const [active, setActive] = useState(0);
  useMotionValueEvent(progress, "change", (v) => {
    const idx = Math.min(count - 1, Math.max(0, Math.floor(v * count)));
    setActive((prev) => (prev === idx ? prev : idx));
  });
  return active;
}
