"use client";

/**
 * /arbitrum — Singapore / Arbitrum pre-seed deck.
 * Same presentation engine as /pitch: overview + Present + presenter notes.
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

import { ARBITRUM_SLIDES, W, H } from "./slides";

const CHANNEL = "perkos-arbitrum-sync";

function slideIndexFromHash(): number {
  if (typeof window === "undefined") return 0;
  const slug = window.location.hash.replace(/^#/, "");
  const i = ARBITRUM_SLIDES.findIndex((s) => s.hash === slug);
  return i >= 0 ? i : 0;
}

export default function ArbitrumPitchPage() {
  const [presenting, setPresenting] = useState(false);
  const [current, setCurrent] = useState(() => slideIndexFromHash());
  const [blanked, setBlanked] = useState(false);
  const [scale, setScale] = useState(1);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(CHANNEL);
    channelRef.current = ch;
    ch.onmessage = (e) => {
      const i = e.data?.slideIndex;
      if (typeof i === "number" && i >= 0 && i < ARBITRUM_SLIDES.length) {
        setCurrent(i);
      }
    };
    return () => ch.close();
  }, []);

  const goTo = useCallback((i: number) => {
    const next = Math.max(0, Math.min(i, ARBITRUM_SLIDES.length - 1));
    setCurrent(next);
    window.history.replaceState(null, "", `#${ARBITRUM_SLIDES[next].hash}`);
    channelRef.current?.postMessage({ slideIndex: next });
  }, []);

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
      else if (e.key === "End") goTo(ARBITRUM_SLIDES.length - 1);
      else if (/^[0-9]$/.test(e.key)) {
        const n = e.key === "0" ? 10 : Number(e.key);
        goTo(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, current, goTo, exitPresent]);

  useEffect(() => {
    if (!presenting) return;
    const onFs = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [presenting]);

  if (presenting) {
    const Slide = ARBITRUM_SLIDES[current].Component;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070A08]">
        <div className="absolute inset-x-0 top-0 z-20 h-1 bg-[#0E1511]">
          <div
            className="h-full bg-[#7CF0A2] transition-[width] duration-300"
            style={{ width: `${((current + 1) / ARBITRUM_SLIDES.length) * 100}%` }}
          />
        </div>

        {blanked ? (
          <button
            type="button"
            aria-label="Resume presentation"
            className="absolute inset-0 z-30 bg-[#070A08]"
            onClick={() => setBlanked(false)}
          />
        ) : null}

        <div style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
          <Slide />
        </div>

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
          {String(current + 1).padStart(2, "0")} / {ARBITRUM_SLIDES.length}
        </span>
        <span className="absolute bottom-5 left-6 z-20 text-xs text-white/30">
          ← → navigate · B blank · F fullscreen · Esc exit
        </span>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#070A08] pb-24 text-[#F5F4F8]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#1E2B23] bg-[#070A08]/90 px-6 py-4 backdrop-blur">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/perkos-header.png" alt="PerkOS" width={120} height={40} />
          <span className="rounded-full border border-[#1E2B23] px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-[#8E9A92]">
            Arbitrum · Pre-seed
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/arbitrum/presenter"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-full border border-[#1E2B23] px-5 py-2.5 text-sm font-semibold text-[#8E9A92] transition-colors hover:border-[#7CF0A2]/50 hover:text-white"
          >
            <NotebookPen className="h-4 w-4" />
            Presenter notes
          </Link>
          <button
            type="button"
            onClick={() => enterPresent(0)}
            className="inline-flex items-center gap-2 rounded-full bg-[#7CF0A2] px-6 py-2.5 text-sm font-semibold text-[#070A08] shadow-[0_0_30px_-8px_rgba(124,240,162,0.55)] transition-opacity hover:opacity-90"
          >
            <MonitorPlay className="h-4 w-4" />
            Present
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1160px] flex-col gap-10 px-6 pt-10">
        {ARBITRUM_SLIDES.map((s, i) => (
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
      <span className="font-mono text-xs text-[#8E9A92]">
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
        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[#1E2B23] transition-colors hover:border-[#7CF0A2]/50"
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
