"use client";

// ============================================================================
// Marquee — infinite horizontal ticker (Die Antwoord / Palmer separator band).
// Pure CSS keyframes (translateX -50% loop over a duplicated track), so it
// runs forever with zero JS per frame. Decorative: pass existing copy only,
// aria-hidden — screen readers get the real headings elsewhere.
// ============================================================================

import type { ReactNode } from "react";

export function Marquee({
  children,
  className,
  /** Seconds per loop — lower = faster. */
  duration = 26,
  /** Reverse direction. */
  reverse = false,
}: {
  children: ReactNode;
  className?: string;
  duration?: number;
  reverse?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none overflow-hidden whitespace-nowrap ${className ?? ""}`}
    >
      <div
        className="inline-flex w-max items-center"
        style={{
          animation: `marquee-x ${duration}s linear infinite${reverse ? " reverse" : ""}`,
          willChange: "transform",
        }}
      >
        {/* Track duplicated so -50% translateX loops seamlessly */}
        <span className="inline-flex items-center">{children}</span>
        <span className="inline-flex items-center">{children}</span>
      </div>
    </div>
  );
}
