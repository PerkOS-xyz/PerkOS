"use client";

// ============================================================================
// SparkyVideo — the hero art layer. The clip never plays on its own: the whole
// timeline is SCRUBBED by scrollY, so Sparky turns to face the viewer exactly
// as fast as you scroll, and turns back if you scroll up.
//
// At rest he simply holds on frame 0, at a three-quarter angle.
//
// The clip is encoded all-intra (every frame a keyframe) precisely so seeking
// to an arbitrary time is cheap; a normally-encoded mp4 stutters when scrubbed.
//
// Append ?sparkydebug=1 to the URL for an on-screen readout of the mapping.
// ============================================================================

import { useEffect, useRef } from "react";

import { useMdUp, useMounted } from "./useMounted";

/**
 * Where the turn lives, in scroll pixels.
 *
 * Desktop: short and immediate — the cover block starts swallowing the hero
 * right away, so a long travel would spend the turn off-screen.
 *
 * Phones: the hero is pinned for an extra screen and plays two beats, so the
 * turn starts only once the copy has cleared and the veil has lifted.
 */
function range(mdUp: boolean) {
  if (mdUp) return { start: 0, travel: 320 };
  const h = window.innerHeight;
  return { start: h * 0.34, travel: h * 0.72 };
}

/** Lenis drives the window scroller, but read defensively anyway. */
function scrollTop() {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

type Take = { src: string; poster: string };

export function SparkyVideo({ desktop, mobile }: { desktop: Take; mobile: Take }) {
  const ref = useRef<HTMLVideoElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);

  // Two separate takes: 16:9 with Sparky on the right, and 9:16 with him
  // centred in the upper half. A single clip cannot serve both — the nebula is
  // baked in, so the framing has to be composed per orientation.
  // Waiting for mount avoids downloading the phone clip and then the desktop
  // one on the same visit.
  const mounted = useMounted();
  const mdUp = useMdUp();
  const take = mdUp ? desktop : mobile;

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const debug = new URLSearchParams(window.location.search).has("sparkydebug");
    let raf = 0;
    let shown = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;

      const duration = video.duration;
      const y = scrollTop();
      const { start, travel } = range(mdUp);
      const p = Math.min(Math.max((y - start) / travel, 0), 1);

      if (debug && hudRef.current) {
        hudRef.current.textContent =
          `scrollY=${Math.round(y)} p=${p.toFixed(2)} t=${video.currentTime.toFixed(2)}` +
          `/${Number.isFinite(duration) ? duration.toFixed(2) : "?"} ` +
          `paused=${video.paused} seeking=${video.seeking} rs=${video.readyState}`;
      }

      if (!duration || !Number.isFinite(duration)) return;
      if (!video.paused) video.pause();

      // Ease the playhead so a flicked scroll doesn't snap through the turn.
      const target = p * (duration - 0.05);
      shown += (target - shown) * 0.22;
      // Don't stack seeks — the decoder drops them and the scrub feels stuck.
      if (!video.seeking && Math.abs(shown - video.currentTime) > 0.01) {
        video.currentTime = shown;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `mounted` matters: before it flips there is no <video> to drive, so the
    // effect must run again once the element actually exists.
  }, [take.src, mounted, mdUp]);

  if (!mounted) {
    // Server and first client render, before JS can pick a breakpoint. It has
    // to be <picture>: handing the portrait poster to a wide viewport makes
    // object-cover blow it up, and Sparky flashes in enormous on every reload.
    // <picture> lets the browser choose by media query and fetch only one.
    return (
      <picture>
        <source media="(min-width: 768px)" srcSet={desktop.poster} />
        <img
          src={mobile.poster}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center md:object-right"
        />
      </picture>
    );
  }

  return (
    <>
      <video
        ref={ref}
        key={take.src}
        className={
          mdUp
            ? "absolute inset-0 h-full w-full object-cover object-right"
            : // Beat 2 has the stage to himself, so the portrait take's own
              // centring is exactly right — no nudging needed.
              "absolute inset-0 h-full w-full object-cover object-center"
        }
        src={take.src}
        poster={take.poster}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
      />
      <div
        ref={hudRef}
        className="pointer-events-none absolute left-2 top-2 z-50 font-mono text-[11px] text-emerald-400"
      />
    </>
  );
}
