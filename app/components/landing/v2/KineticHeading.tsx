"use client";

// ============================================================================
// KineticHeading — shared section heading for the landing's pinned scenes.
//
// The original wide-desktop treatment forced translated headings onto one
// moving line. At 2xl sizes that still clipped Spanish and other long copy at
// both viewport edges. Keep the component API used by the scenes, but render
// every locale in a stationary, wrapped and consistently padded container.
// ============================================================================

import type { ReactNode } from "react";

const READABLE_STYLE: React.CSSProperties = {
  fontSize: "clamp(1.75rem, 5vw, 5rem)",
  lineHeight: 1.08,
  letterSpacing: "-0.035em",
  paddingBottom: "0.14em",
};

const COMPACT_STYLE: React.CSSProperties = {
  ...READABLE_STYLE,
  fontSize: "clamp(1.75rem, 4.5vw, 4.5rem)",
};

const HEADING_CLASS_NAME =
  "mx-auto w-full max-w-[96rem] whitespace-normal break-words px-6 text-center font-semibold text-foreground md:px-10 xl:px-16";

type KineticHeadingProps = {
  children: ReactNode;
  className?: string;
  /** Retained for call-site compatibility; horizontal travel is disabled. */
  from?: string;
  /** Retained for call-site compatibility; horizontal travel is disabled. */
  to?: string;
  /** Retained for call-site compatibility with pinned scenes. */
  pinned?: boolean;
  /** Slightly smaller maximum for especially long headings. */
  compact?: boolean;
};

export function KineticHeading({
  children,
  className,
  compact = false,
}: KineticHeadingProps) {
  return (
    <div className={`w-full overflow-hidden ${className ?? ""}`}>
      <h2
        className={HEADING_CLASS_NAME}
        style={compact ? COMPACT_STYLE : READABLE_STYLE}
      >
        {children}
      </h2>
    </div>
  );
}
