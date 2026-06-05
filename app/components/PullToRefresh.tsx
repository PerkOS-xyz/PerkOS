"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";

const THRESHOLD = 70; // px of pull needed to trigger a refresh
const MAX_PULL = 120; // visual cap on how far the indicator stretches
const RESISTANCE = 0.5; // drag feels heavier than the finger travel

/**
 * Pull-to-refresh for touch devices (Base App / Farcaster webviews, mobile
 * browsers). Wrap the scrollable page content; when the user is scrolled to
 * the very top and drags down past THRESHOLD, every active query is
 * invalidated so the page refetches its live data.
 *
 * Listeners are attached natively (not via React props) so `touchmove` can be
 * non-passive — that lets us preventDefault while pulling and suppress the
 * browser's own rubber-band overscroll. Desktop is unaffected: the indicator
 * is `md:hidden` and a mouse never fires these touch events.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Mirrors of the state for the native listeners (avoid stale closures).
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const atTop = () =>
      (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || !atTop()) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0]?.clientY ?? null;
    };

    const onMove = (e: TouchEvent) => {
      if (startY.current === null || refreshingRef.current) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (dy <= 0) {
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }
      // Genuine downward pull from the top — take over from native scroll.
      if (e.cancelable) e.preventDefault();
      const dist = Math.min(MAX_PULL, dy * RESISTANCE);
      pullRef.current = dist;
      setPull(dist);
    };

    const onEnd = async () => {
      if (startY.current === null) return;
      startY.current = null;
      if (pullRef.current >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        pullRef.current = THRESHOLD;
        setPull(THRESHOLD);
        try {
          await queryClient.invalidateQueries();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          pullRef.current = 0;
          setPull(0);
        }
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [queryClient]);

  const indicatorHeight = refreshing ? THRESHOLD : pull;

  return (
    <div ref={containerRef}>
      <div
        aria-hidden
        className="pointer-events-none flex items-center justify-center overflow-hidden text-primary md:hidden"
        style={{
          height: indicatorHeight,
          transition: pull === 0 || refreshing ? "height 0.2s ease" : "none",
        }}
      >
        <RefreshCw
          className={cn("h-5 w-5", refreshing && "animate-spin")}
          style={{
            opacity: indicatorHeight > 6 ? 1 : 0,
            transform: refreshing ? undefined : `rotate(${pull * 2.6}deg)`,
          }}
        />
      </div>
      {children}
    </div>
  );
}
