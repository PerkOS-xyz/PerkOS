"use client";

// ============================================================================
// Reveal — entrance-on-scroll using an OWNED IntersectionObserver + CSS
// transition (not framer-motion's whileInView, which proved unreliable under
// React 19 + SSR and could leave content stuck invisible).
//
// Contract: content can NEVER stay permanently hidden.
//   • prefers-reduced-motion  → shown immediately, no animation.
//   • no IntersectionObserver → shown immediately.
//   • otherwise               → fade + lift in when it scrolls into view (once).
//
// Two shapes:
//   <Reveal>…</Reveal>                                  one element
//   <Reveal stagger>…<RevealItem index={i}/>…</Reveal>  staggered group
// ============================================================================

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // --ease-signature

// Owned reveal state: flips `shown` true when the element enters the viewport,
// or immediately when motion is unwanted/unavailable.
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    // No element or no IntersectionObserver support → reveal on the next frame
    // (rAF keeps the setState out of the synchronous effect body). Reduced
    // motion is handled by the global CSS media query, which collapses the
    // transition to ~0ms, so the reveal simply appears instantly.
    if (!el || typeof IntersectionObserver === "undefined") {
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    // Already within the viewport at mount → reveal now. getBoundingClientRect
    // works even in a hidden/background tab (where IntersectionObserver stays
    // silent until the tab is visible), so above-the-fold content can never get
    // stuck invisible. Below-the-fold content still reveals via the observer on
    // scroll.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "-80px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, shown };
}

function revealStyle(shown: boolean, delaySec = 0, y = 24): CSSProperties {
  return {
    opacity: shown ? 1 : 0,
    transform: shown ? "none" : `translateY(${y}px)`,
    transition: `opacity 600ms ${EASE} ${delaySec}s, transform 600ms ${EASE} ${delaySec}s`,
    willChange: "opacity, transform",
  };
}

// Provides the container's `shown` to nested <RevealItem>s so a group reveals
// together (each item adds its own stagger delay via `index`).
const RevealCtx = createContext<boolean | null>(null);

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  stagger?: boolean;
  /** Unused now (kept for call-site compatibility); per-item delay uses index. */
  staggerGap?: number;
  y?: number;
};

export function Reveal({
  children,
  className,
  delay = 0,
  stagger = false,
  y = 24,
}: RevealProps) {
  const { ref, shown } = useReveal();

  if (stagger) {
    // Container stays visible; children animate individually.
    return (
      <div ref={ref} className={className}>
        <RevealCtx.Provider value={shown}>{children}</RevealCtx.Provider>
      </div>
    );
  }

  return (
    <div ref={ref} className={className} style={revealStyle(shown, delay, y)}>
      {children}
    </div>
  );
}

export function RevealItem({
  children,
  className,
  index = 0,
  y = 24,
  staggerGap = 0.07,
}: {
  children: ReactNode;
  className?: string;
  /** Position in the group — drives the stagger delay. */
  index?: number;
  y?: number;
  staggerGap?: number;
}) {
  const ctxShown = useContext(RevealCtx);
  const own = useReveal();
  const inStagger = ctxShown !== null;
  const shown = inStagger ? ctxShown : own.shown;

  return (
    <div
      ref={inStagger ? undefined : own.ref}
      className={className}
      style={revealStyle(shown, index * staggerGap, y)}
    >
      {children}
    </div>
  );
}
