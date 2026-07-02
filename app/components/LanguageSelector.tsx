"use client";

import { Globe, Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { useIsInMiniApp } from "../lib/useIsInMiniApp";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "../lib/i18n";

/**
 * Header language selector. BROWSER-ONLY: hidden inside Farcaster/Base Mini App
 * hosts (and while host detection is still resolving), matching the app's other
 * browser-only affordances. Style mirrors NetworkPill.
 */
export function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const inMiniApp = useIsInMiniApp();

  // `null` = still resolving → hide (never flash inside a host). `true` = Mini App → hide.
  if (inMiniApp !== false) return null;

  const current = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0] as LanguageCode;
  const active = SUPPORTED_LANGUAGES.find((l) => l.code === current) ?? SUPPORTED_LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${t("common.language")}: ${active.label}`}
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium transition-colors",
          "h-11 md:h-8", // 44px tap target on mobile, 32px on desktop
          "border-border text-muted-foreground",
          "hover:border-primary/40 hover:text-foreground",
          "data-[popup-open]:border-primary/40 data-[popup-open]:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        )}
      >
        <Globe className="h-3.5 w-3.5" />
        <span className="uppercase">{active.code}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform motion-safe:duration-150 group-data-[popup-open]:rotate-180" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-56 rounded-xl border-border bg-card p-1 shadow-lg"
      >
        {SUPPORTED_LANGUAGES.map((lang) => {
          const selected = lang.code === active.code;
          return (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => void i18n.changeLanguage(lang.code)}
              aria-selected={selected}
              className={cn(
                "flex h-10 items-center gap-2 rounded-md px-3 text-sm",
                selected ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/40",
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate">{lang.label}</span>
                {lang.code !== "en" ? (
                  <span className="truncate text-[11px] text-muted-foreground">{lang.english}</span>
                ) : null}
              </span>
              {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
