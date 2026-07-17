"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

import { useChatbot } from "./ChatbotProvider";
import { cn } from "@/lib/utils";

/**
 * Floating assistant button. Shows the PerkOS logo (the brand mark reads as
 * "us", not a robot — user testing showed robot avatars scared non-technical
 * users) inside a circle, with a soft pulsing ring around it so people notice
 * the live chat is there.
 */
export function ChatbotTrigger() {
  const pathname = usePathname();
  const { open, toggle } = useChatbot();

  // These screens already own the bottom-right composer/action area. Hiding
  // the floating assistant keeps wizard and chat Send controls directly
  // clickable instead of letting the fixed trigger intercept them.
  if (pathname?.startsWith("/agents/new") || pathname?.startsWith("/chat")) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? "Close your PerkOS assistant" : "Open your PerkOS assistant"}
      title="Your PerkOS assistant"
      className={cn(
        "fixed bottom-32 right-[30px] z-30 h-14 w-14 rounded-full transition-transform hover:scale-105 active:scale-95 md:bottom-[62px] md:right-[42px] md:h-16 md:w-16",
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
