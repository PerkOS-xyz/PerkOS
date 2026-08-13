"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Globe2, MonitorPlay, Play, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "@/app/lib/i18n";
import { useDeckCopy } from "./copy";
import { DECK_SLIDES, H, W } from "./slides";

function indexFromHash() {
  if (typeof window === "undefined") return 0;
  const hash = window.location.hash.replace(/^#/, "");
  const found = DECK_SLIDES.findIndex((slide) => slide.hash === hash);
  return found >= 0 ? found : 0;
}

export default function DeckPage() {
  const { copy } = useDeckCopy();
  const [presenting, setPresenting] = useState(false);
  const [current, setCurrent] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!presenting) return;
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [presenting]);

  useEffect(() => {
    const hash = DECK_SLIDES[current]?.hash;
    if (!hash || typeof window === "undefined") return;
    window.history.replaceState(null, "", `#${hash}`);
  }, [current]);

  const enterPresent = useCallback((at = 0) => {
    setCurrent(at);
    setPresenting(true);
  }, []);

  const exitPresent = useCallback(() => {
    setPresenting(false);
  }, []);

  const next = useCallback(() => {
    setCurrent((value) => Math.min(value + 1, DECK_SLIDES.length - 1));
  }, []);

  const previous = useCallback(() => {
    setCurrent((value) => Math.max(value - 1, 0));
  }, []);

  useEffect(() => {
    if (!presenting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return exitPresent();
      if (["ArrowRight", " ", "PageDown", "Enter"].includes(event.key)) {
        event.preventDefault();
        next();
      } else if (["ArrowLeft", "PageUp", "Backspace"].includes(event.key)) {
        event.preventDefault();
        previous();
      } else if (event.key === "Home") setCurrent(0);
      else if (event.key === "End") setCurrent(DECK_SLIDES.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, exitPresent, next, previous]);

  if (presenting) {
    const Slide = DECK_SLIDES[current].Component;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black" onClick={next}>
        <div className="absolute inset-x-0 top-0 z-20 h-1 bg-white/10">
          <div className="h-full bg-[#ec1b69] transition-[width] duration-300" style={{ width: `${((current + 1) / DECK_SLIDES.length) * 100}%` }} />
        </div>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
          <Slide />
        </div>
        <button type="button" onClick={(event) => { event.stopPropagation(); exitPresent(); }} aria-label={copy.nav.exit} className="absolute right-5 top-5 z-30 grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur hover:bg-white/15 hover:text-white">
          <X className="h-5 w-5" />
        </button>
        <button type="button" onClick={(event) => { event.stopPropagation(); previous(); }} disabled={current === 0} aria-label={copy.nav.previous} className="absolute left-5 top-1/2 z-30 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur disabled:opacity-20">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button type="button" onClick={(event) => { event.stopPropagation(); next(); }} disabled={current === DECK_SLIDES.length - 1} aria-label={copy.nav.next} className="absolute right-5 top-1/2 z-30 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur disabled:opacity-20">
          <ChevronRight className="h-6 w-6" />
        </button>
        <span className="absolute bottom-5 right-6 z-20 font-mono text-sm text-white/50">{current + 1} / {DECK_SLIDES.length}</span>
        <span className="absolute bottom-5 left-6 z-20 text-xs text-white/35">← → · Esc</span>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#08030d] pb-24 text-[#f7f3fb]">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#2a2038] bg-[#08030d]/92 px-5 py-4 backdrop-blur-xl sm:px-7">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image src="/perkos-header.png" alt="PerkOS" width={120} height={40} />
          <span className="hidden rounded-full border border-[#2a2038] px-3 py-1 text-[11px] font-medium uppercase tracking-[.14em] text-[#8e849f] sm:inline-flex">{copy.nav.deck}</span>
        </Link>
        <div className="flex items-center gap-2">
          <DeckLanguageSelector />
          <button type="button" onClick={() => enterPresent(indexFromHash())} className="inline-flex items-center gap-2 rounded-full bg-[#ec1b69] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_30px_-8px_rgba(236,27,105,.9)] hover:bg-[#f12875] sm:px-5">
            <MonitorPlay className="h-4 w-4" />
            <span className="hidden sm:inline">{copy.nav.present}</span>
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1240px] flex-col gap-9 px-4 pt-8 sm:px-6 sm:pt-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#8e849f]">{DECK_SLIDES.length} {copy.nav.slides}</p>
          <p className="text-xs text-[#655c71]">{copy.nav.hint}</p>
        </div>
        {DECK_SLIDES.map(({ Component, hash }, index) => (
          <ScaledSlide key={hash} index={index} title={localizedSlideTitle(copy, index)} onPresent={() => enterPresent(index)}>
            <Component />
          </ScaledSlide>
        ))}
      </div>
    </main>
  );
}

function localizedSlideTitle(copy: ReturnType<typeof useDeckCopy>["copy"], index: number) {
  return [
    `${copy.hero.title} ${copy.hero.accent}`,
    `${copy.problem.title} ${copy.problem.accent}`,
    copy.thesis.title,
    copy.loop.title,
    `${copy.surfaces.title} ${copy.surfaces.accent}`,
    `${copy.live.title} ${copy.live.accent}`,
    `${copy.proof.title} ${copy.proof.accent}`,
    `${copy.business.title} ${copy.business.accent}`,
    `${copy.gtm.title} ${copy.gtm.accent}`,
    `${copy.moat.title} ${copy.moat.accent}`,
    `${copy.roadmap.title} ${copy.roadmap.accent}`,
    `${copy.close.title} ${copy.close.accent}`,
  ][index];
}

function DeckLanguageSelector() {
  const { i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0] as LanguageCode;

  const changeLanguage = (language: LanguageCode) => {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", language);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    void i18n.changeLanguage(language);
  };

  return (
    <label className="relative inline-flex h-10 items-center gap-2 rounded-full border border-[#2a2038] bg-[#11091a] pl-3 pr-2 text-[#b9b1ca] sm:h-11">
      <Globe2 className="h-4 w-4" />
      <select aria-label="Language" value={current} onChange={(event) => changeLanguage(event.target.value as LanguageCode)} className="cursor-pointer appearance-none bg-transparent pr-5 text-xs font-semibold uppercase text-[#d9d2e2] outline-none">
        {SUPPORTED_LANGUAGES.map((language) => <option key={language.code} value={language.code} className="bg-[#11091a] text-white">{language.label}</option>)}
      </select>
      <ChevronRight className="pointer-events-none absolute right-2 h-3 w-3 rotate-90 text-[#7d7391]" />
    </label>
  );
}

function ScaledSlide({ children, index, title, onPresent }: { children: ReactNode; index: number; title: string; onPresent: () => void }) {
  const { copy } = useDeckCopy();
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = () => setScale(element.clientWidth / W);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <article className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1 font-mono text-xs text-[#7d7391]">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <span className="max-w-[80%] truncate font-sans">{title}</span>
      </div>
      <div ref={ref} role="button" tabIndex={0} aria-label={`${copy.nav.present} ${index + 1}: ${title}`} onClick={onPresent} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onPresent(); }} className="group relative cursor-pointer overflow-hidden rounded-xl border border-[#2a2038] bg-black shadow-[0_18px_70px_-30px_rgba(0,0,0,.9)] transition hover:border-[#ec1b69]/60 sm:rounded-2xl" style={{ height: scale > 0 ? H * scale : undefined, aspectRatio: scale > 0 ? undefined : "16/9" }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: W, height: H }}>{children}</div>
        <span className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/55 text-white opacity-100 backdrop-blur sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
          <Play className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}
