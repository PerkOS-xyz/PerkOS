"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatbot } from "./ChatbotProvider";

/**
 * The assistant's permanent home: a header control, present on every page.
 *
 * The assistant used to be reachable only through a floating disc, which had
 * to be hidden wherever it covered content — by the end that was almost the
 * whole product, so the feature was effectively unreachable. A header slot
 * cannot overlap anything, needs no per-route rules and no breakpoint
 * offsets, and sits where the other global controls already are.
 *
 * Keeps the brand mark rather than a bot glyph: user testing showed robot
 * imagery scared non-technical users.
 */
export function AssistantButton({ className }: { className?: string }) {
  const { open, toggle } = useChatbot();
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={t("chat.assistant.toggle")}
      aria-pressed={open}
      title={t("chat.assistant.toggle")}
      className={cn(
        "relative rounded-full",
        open && "bg-primary/15 text-primary",
        className,
      )}
    >
      <span className="relative block h-5 w-5 overflow-hidden rounded-full">
        <Image src="/logo.png" alt="" fill sizes="20px" className="object-cover" />
      </span>
    </Button>
  );
}
