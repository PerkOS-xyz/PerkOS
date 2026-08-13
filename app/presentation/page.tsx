"use client";

/**
 * /presentation — public page hosting the product demo video (Loom embed),
 * paired with the /deck slides. No auth; share as a direct link.
 */

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MonitorPlay } from "lucide-react";

const LOOM_EMBED = "https://www.loom.com/embed/c0111bf45413490dbad25cbe07d3b628";

export default function PresentationPage() {
  return (
    <main className="min-h-screen bg-[#08030d] text-[#ececff]">
      {/* top bar — mirrors /deck */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#1b1833] bg-[#08030d]/90 px-6 py-4 backdrop-blur">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/perkos-header.png" alt="PerkOS" width={120} height={40} />
          <span className="rounded-full border border-[#1b1833] px-2.5 py-0.5 text-[11px] uppercase tracking-wider text-[#7975a8]">
            Product demo
          </span>
        </Link>
        <Link
          href="/deck"
          className="inline-flex items-center gap-2 rounded-full border border-[#ec1b69]/50 bg-[#ec1b69]/10 px-5 py-2 text-sm font-semibold text-[#ec1b69] transition-colors hover:bg-[#ec1b69]/20"
        >
          <MonitorPlay className="h-4 w-4" />
          View the deck
        </Link>
      </header>

      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-12">
        <div className="flex flex-col gap-3 text-center">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            See PerkOS <span className="text-[#ec1b69]">in action.</span>
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-[#b9b4dd]">
            Watch a team of AI agents take a goal, plan it into tasks, and get
            the work done — live, with you in charge.
          </p>
        </div>

        {/* Loom embed — responsive wrapper keeps the recording's aspect ratio. */}
        <div className="overflow-hidden rounded-2xl border border-[#1b1833] bg-black shadow-[0_0_70px_-20px_rgba(236,27,105,0.5)]">
          <div style={{ position: "relative", paddingBottom: "100%", height: 0 }}>
            <iframe
              src={LOOM_EMBED}
              title="PerkOS product demo"
              frameBorder="0"
              allowFullScreen
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 pb-8 pt-2 sm:flex-row sm:justify-center">
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 rounded-full bg-[#ec1b69] px-7 py-3 text-sm font-semibold text-white shadow-[0_0_30px_-8px_rgba(236,27,105,0.9)] transition-opacity hover:opacity-90"
          >
            Launch your team
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/deck"
            className="text-sm text-[#7975a8] underline-offset-4 hover:text-[#ececff] hover:underline"
          >
            Or explore the investor deck →
          </Link>
        </div>
      </div>
    </main>
  );
}
