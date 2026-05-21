"use client";

import Image from "next/image";
import { useChatbot } from "./ChatbotProvider";
import { cn } from "@/lib/utils";

export function ChatbotTrigger() {
  const { open, toggle } = useChatbot();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={open ? "Close PerkOS Agent" : "Open PerkOS Agent"}
      title="PerkOS Agent"
      className={cn(
        "fixed bottom-20 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary/85 shadow-[0_0_24px_rgba(236,27,105,0.4)] transition-transform hover:scale-105 active:scale-95 md:bottom-8 md:right-8 md:h-16 md:w-16",
        open && "opacity-0 pointer-events-none"
      )}
    >
      <Image
        src="/avatar.png"
        alt=""
        width={40}
        height={40}
        className="brightness-0 invert"
      />
    </button>
  );
}
