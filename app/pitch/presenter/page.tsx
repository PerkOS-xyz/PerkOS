"use client";

/**
 * /pitch/presenter — the founder's second window during a live call.
 *
 * Open this on your own screen and share ONLY the /pitch window with the
 * audience. Both windows sync over a BroadcastChannel: navigating in either
 * one moves both. Shows current + next slide, speaker notes, an elapsed
 * clock with a pacing indicator, and a click-to-jump slide list.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw } from "lucide-react";

import { PITCH_SLIDES } from "../slides";

const CHANNEL = "perkos-pitch-sync";
const TOTAL_BUDGET = PITCH_SLIDES.reduce((a, s) => a + s.budgetSeconds, 0);

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function PresenterPage() {
  const [current, setCurrent] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

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

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const goTo = useCallback((i: number) => {
    const next = Math.max(0, Math.min(i, PITCH_SLIDES.length - 1));
    setCurrent(next);
    channelRef.current?.postMessage({ slideIndex: next });
  }, []);

  // Keyboard here too, so the presenter can drive from either window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (["ArrowRight", " ", "PageDown"].includes(e.key)) {
        e.preventDefault();
        goTo(current + 1);
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        goTo(current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, goTo]);

  // Pacing: where we should be by now vs where we are.
  const budgetToHere = PITCH_SLIDES.slice(0, current + 1).reduce(
    (a, s) => a + s.budgetSeconds,
    0,
  );
  const pace =
    elapsed <= budgetToHere - PITCH_SLIDES[current].budgetSeconds
      ? "ahead"
      : elapsed <= budgetToHere + 30
        ? "on-time"
        : "behind";
  const paceColor =
    pace === "ahead" ? "#6ee7b7" : pace === "on-time" ? "#fbbf24" : "#f87171";

  const slide = PITCH_SLIDES[current];
  const nextSlide = PITCH_SLIDES[current + 1];

  return (
    <main className="min-h-screen bg-[#0D0D14] text-[#F5F4F8]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-6">
        {/* header: clock + pace + controls */}
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#2A2935] bg-[#17161F] px-6 py-4">
          <div className="flex items-center gap-4">
            <span className="font-mono text-4xl font-bold tabular-nums">
              {fmt(elapsed)}
            </span>
            <span className="font-mono text-sm text-[#B0ACD9]">
              / {fmt(TOTAL_BUDGET)}
            </span>
            <span
              className="ml-2 flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide"
              style={{ color: paceColor, borderColor: paceColor }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: paceColor }}
              />
              {pace}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRunning((r) => !r)}
              className="inline-flex items-center gap-2 rounded-full bg-[#EC1B69] px-5 py-2 text-sm font-semibold text-white"
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? "Pause" : elapsed > 0 ? "Resume" : "Start clock"}
            </button>
            <button
              type="button"
              onClick={() => {
                setElapsed(0);
                setRunning(false);
              }}
              aria-label="Reset clock"
              className="grid h-9 w-9 place-items-center rounded-full border border-[#2A2935] text-[#B0ACD9] hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
          {/* current slide + notes */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold">
                <span className="mr-3 font-mono text-[#FF8AB4]">
                  {String(current + 1).padStart(2, "0")}
                </span>
                {slide.title}
              </h1>
              <span className="font-mono text-sm text-[#B0ACD9]">
                budget {fmt(slide.budgetSeconds)}
              </span>
            </div>
            <div className="flex-1 rounded-2xl border border-[#2A2935] bg-[#17161F] p-6">
              <p className="text-[19px] leading-relaxed text-[#E8E6F2]">
                {slide.notes}
              </p>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-[#2A2935] bg-[#17161F] px-6 py-4">
              <button
                type="button"
                onClick={() => goTo(current - 1)}
                disabled={current === 0}
                className="inline-flex items-center gap-2 rounded-full border border-[#2A2935] px-5 py-2 text-sm font-semibold text-[#B0ACD9] disabled:opacity-30"
              >
                <ArrowLeft className="h-4 w-4" /> Prev
              </button>
              <span className="text-sm text-[#B0ACD9]">
                Next up:{" "}
                <span className="font-semibold text-white">
                  {nextSlide ? nextSlide.title : "Q&A, you are done"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => goTo(current + 1)}
                disabled={current === PITCH_SLIDES.length - 1}
                className="inline-flex items-center gap-2 rounded-full bg-[#EC1B69] px-5 py-2 text-sm font-semibold text-white disabled:opacity-30"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>

          {/* slide list */}
          <aside className="flex flex-col gap-2 overflow-y-auto">
            <p className="text-xs uppercase tracking-wider text-[#B0ACD9]">
              Jump to slide
            </p>
            {PITCH_SLIDES.map((s, i) => (
              <button
                key={s.hash}
                type="button"
                onClick={() => goTo(i)}
                className={
                  "flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-colors " +
                  (i === current
                    ? "border-[#EC1B69] bg-[#EC1B69]/10 text-white"
                    : "border-[#2A2935] text-[#B0ACD9] hover:border-[#EC1B69]/40 hover:text-white")
                }
              >
                <span className="font-mono text-xs">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 truncate">{s.title}</span>
                <span className="ml-auto shrink-0 font-mono text-[10px] opacity-60">
                  {fmt(s.budgetSeconds)}
                </span>
              </button>
            ))}
            <Link
              href="/pitch"
              className="mt-2 rounded-xl border border-[#2A2935] px-4 py-2.5 text-center text-sm text-[#B0ACD9] hover:text-white"
            >
              Open the deck window
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
