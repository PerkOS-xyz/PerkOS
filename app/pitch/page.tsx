"use client";

/**
 * /pitch — the 15-slide PerkOS deck, presentable live from the browser.
 *
 * Modes:
 *  - Overview: slides stacked vertically, scaled to the viewport width.
 *    Click any slide (or "Present") to enter present mode from there.
 *  - Present: fullscreen fixed 1920×1080 canvas scaled to fit.
 *    ←/→/Space/PgUp/PgDn navigate · 1-9,0 jump · Home/End · F fullscreen ·
 *    B or . blanks the stage for Q&A · Esc exits.
 *
 * The slide position lives in the URL hash (named slugs), so a refresh
 * mid-call resumes on the same slide and a specific slide can be linked.
 * A BroadcastChannel keeps /pitch/presenter (speaker notes window) in sync.
 */

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MonitorPlay, NotebookPen, Play, X } from "lucide-react";

import { PITCH_SLIDES, W, H } from "./slides";

const CHANNEL = "perkos-pitch-sync";

function slideIndexFromHash(): number {
  if (typeof window === "undefined") return 0;
  const slug = window.location.hash.replace(/^#/, "");
  const i = PITCH_SLIDES.findIndex((s) => s.hash === slug);
  return i >= 0 ? i : 0;
}

export default function PitchPage() {
  const [presenting, setPresenting] = useState(false);
  // Lazy init restores the slide position from the URL hash (0 during SSR;
  // the overview markup does not depend on it, so hydration stays stable).
  const [current, setCurrent] = useState(() => slideIndexFromHash());
  const [blanked, setBlanked] = useState(false);
  const [scale, setScale] = useState(1);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Cross-window sync with /pitch/presenter.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(CHANNEL);
    channelRef.current = ch;
    ch.onmessage = (e) => {
      const i = e.data?.slideIndex;
      if (typeof i === "number" && i >= 0 && i < PITCH_SLIDES.length) {
        setCurrent(i);
      }
    };
    return () => ch.close();
  }, []);

  const goTo = useCallback((i: number) => {
    const next = Math.max(0, Math.min(i, PITCH_SLIDES.length - 1));
    setCurrent(next);
    window.history.replaceState(null, "", `#${PITCH_SLIDES[next].hash}`);
    channelRef.current?.postMessage({ slideIndex: next });
  }, []);

  // Present-mode scale: fit the canvas into the viewport.
  useEffect(() => {
    if (!presenting) return;
    const fit = () =>
      setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [presenting]);

  const enterPresent = useCallback(
    (at?: number) => {
      if (typeof at === "number") goTo(at);
      setPresenting(true);
      document.documentElement.requestFullscreen?.().catch(() => {});
    },
    [goTo],
  );

  const exitPresent = useCallback(() => {
    setPresenting(false);
    setBlanked(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return exitPresent();
      if (e.key === "b" || e.key === "B" || e.key === ".") {
        e.preventDefault();
        setBlanked((v) => !v);
        return;
      }
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
        else document.documentElement.requestFullscreen?.().catch(() => {});
        return;
      }
      if (["ArrowRight", "ArrowDown", " ", "PageDown", "Enter"].includes(e.key)) {
        e.preventDefault();
        setBlanked(false);
        goTo(current + 1);
      } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        setBlanked(false);
        goTo(current - 1);
      } else if (e.key === "Home") goTo(0);
      else if (e.key === "End") goTo(PITCH_SLIDES.length - 1);
      else if (/^[0-9]$/.test(e.key)) {
        const n = e.key === "0" ? 10 : Number(e.key);
        goTo(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, current, goTo, exitPresent]);

  // Leaving browser fullscreen exits present mode too.
  useEffect(() => {
    if (!presenting) return;
    const onFs = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [presenting]);

  if (presenting) {
    const Slide = PITCH_SLIDES[current].Component;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0D14]">
        {/* progress */}
        <div className="absolute inset-x-0 top-0 z-20 h-1 bg-[#17161F]">
          <div
            className="h-full bg-[#EC1B69] transition-[width] duration-300"
            style={{ width: `${((current + 1) / PITCH_SLIDES.length) * 100}%` }}
          />
        </div>

        {blanked ? (
          <button
            type="button"
            aria-label="Resume presentation"
            className="absolute inset-0 z-30 bg-[#0D0D14]"
            onClick={() => setBlanked(false)}
          />
        ) : null}

        <div style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
          <Slide />
        </div>

        {/* edge click zones: left 15% back, right 15% forward, middle inert */}
        <button
          type="button"
          aria-label="Previous slide"
          className="absolute inset-y-0 left-0 z-20 w-[15%] cursor-w-resize opacity-0"
          onClick={() => goTo(current - 1)}
        />
        <button
          type="button"
          aria-label="Next slide"
          className="absolute inset-y-0 right-0 z-20 w-[15%] cursor-e-resize opacity-0"
          onClick={() => goTo(current + 1)}
        />

        <button
          type="button"
          onClick={exitPresent}
          aria-label="Exit presentation"
          className="absolute right-5 top-5 z-40 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/70 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="absolute bottom-5 right-6 z-20 font-mono text-sm text-white/50">
          {String(current + 1).padStart(2, "0")} / {PITCH_SLIDES.length}
        </span>
        <span className="absolute bottom-5 left-6 z-20 text-xs text-white/30">
          ← → navigate · B blank · F fullscreen · Esc exit
        </span>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0D0D14] pb-24 text-[#F5F4F8]">
      {/* top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#2A2935] bg-[#0D0D14]/90 px-6 py-4 backdrop-blur">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/perkos-header.png" alt="PerkOS" width={120} height={40} />
          <span className="rounded-full border border-[#2A2935] px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-[#B0ACD9]">
            PerkOS 2026
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/pitch/presenter"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-full border border-[#2A2935] px-5 py-2.5 text-sm font-semibold text-[#B0ACD9] transition-colors hover:border-[#EC1B69]/50 hover:text-white"
          >
            <NotebookPen className="h-4 w-4" />
            Presenter notes
          </Link>
          <button
            type="button"
            onClick={() => enterPresent(0)}
            className="inline-flex items-center gap-2 rounded-full bg-[#EC1B69] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_30px_-8px_rgba(236,27,105,0.9)] transition-opacity hover:opacity-90"
          >
            <MonitorPlay className="h-4 w-4" />
            Present
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1160px] flex-col gap-10 px-6 pt-10">
        {PITCH_SLIDES.map((s, i) => (
          <ScaledSlide
            key={s.hash}
            index={i}
            title={s.title}
            onPresent={() => enterPresent(i)}
          >
            <s.Component />
          </ScaledSlide>
        ))}
      </div>
    </main>
  );
}

/** Overview wrapper: scales the fixed canvas slide to the container width. */
function ScaledSlide({
  children,
  index,
  title,
  onPresent,
}: {
  children: ReactNode;
  index: number;
  title: string;
  onPresent: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-xs text-[#B0ACD9]">
        {String(index + 1).padStart(2, "0")} · {title}
      </span>
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={onPresent}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onPresent();
        }}
        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[#2A2935] transition-colors hover:border-[#EC1B69]/50"
        style={{
          height: scale > 0 ? H * scale : undefined,
          aspectRatio: scale > 0 ? undefined : "16/9",
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: W,
            height: H,
          }}
        >
          {children}
        </div>
        <span className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <Play className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}
