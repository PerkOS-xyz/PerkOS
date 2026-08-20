"use client";

import Image from "next/image";

import { useChatbot } from "./ChatbotProvider";
import { cn } from "@/lib/utils";

/**
 * Floating assistant button. Shows the PerkOS logo (the brand mark reads as
 * "us", not a robot — user testing showed robot avatars scared non-technical
 * users) inside a circle, with a soft pulsing ring around it so people notice
 * the live chat is there.
 */
export function ChatbotTrigger() {
  const { open, toggle, spotlight } = useChatbot();

  // Only on empty screens. The assistant is always reachable from the header
  // button; this bubble is the invitation shown where there is no content to
  // sit on top of. Replaces a route blocklist that had grown to cover
  // /agents, /chat, /projects, /tasks, /wallet, /dashboard and /settings —
  // nearly the whole product — because a fixed disc intercepts whatever
  // scrolls under it no matter how the page is padded.
  if (!spotlight) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? "Close your PerkOS assistant" : "Open your PerkOS assistant"}
      title="Your PerkOS assistant"
      className={cn(
        // Mobile: sit just above the 64px bottom nav so the disc cannot reach
        // first-screen tiles. md+: stay in the content gutter, not the 280px
        // right rail that holds Billing. lg+ further inset from that rail.
        // One position everywhere. The old lg:right-[322px] dodged a 280px right
        // rail that only some pages have, so on the rest the disc floated in the
        // middle of nowhere. Bottom offset still clears the 64px mobile nav.
        "fixed bottom-[72px] right-4 z-30 h-14 w-14 rounded-full transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6 md:h-16 md:w-16",
        open && "opacity-0 pointer-events-none"
      )}
    >
      {/* Active pulse — radar ring radiating out (not clipped). */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-primary/30 animate-ping"
        style={{ animationDuration: "2.2s" }}
      />
      {/* Logo disc. */}
      <span className="absolute inset-0 overflow-hidden rounded-full border border-primary/50 ring-2 ring-primary/40 shadow-[0_0_24px_rgba(236,27,105,0.5)]">
        <Image
          src="/logo.png"
          alt="PerkOS"
          fill
          sizes="64px"
          className="object-cover"
          priority
        />
      </span>
    </button>
  );
}
