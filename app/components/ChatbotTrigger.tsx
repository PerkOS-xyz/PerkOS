"use client";

import { Sparkles } from "lucide-react";

import { useChatbot } from "./ChatbotProvider";
import { cn } from "@/lib/utils";

/**
 * Floating assistant button. A sparkle badge — NOT a robot icon: this button
 * is on every page, and user testing showed robot imagery scared
 * non-technical users.
 */
export function ChatbotTrigger() {
  const { open, toggle } = useChatbot();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? "Close your PerkOS assistant" : "Open your PerkOS assistant"}
      title="Your PerkOS assistant"
      className={cn(
        "fixed bottom-32 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-primary/40 backdrop-blur-xs shadow-[0_0_24px_rgba(236,27,105,0.4)] transition-transform hover:scale-105 active:scale-95 md:bottom-8 md:right-8 md:h-16 md:w-16",
        open && "opacity-0 pointer-events-none"
      )}
      style={{
        background:
          "radial-gradient(circle at 30% 30%, hsla(280, 70%, 60%, 0.55), hsla(280, 70%, 35%, 0.3))",
      }}
    >
      <Sparkles className="h-6 w-6 md:h-7 md:w-7" style={{ color: "hsla(280, 90%, 88%, 0.95)" }} />
    </button>
  );
}
