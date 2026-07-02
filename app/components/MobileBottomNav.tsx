"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Folder, ListTodo, Bot, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", labelKey: "chrome.mobileNav.home", Icon: Home },
  { href: "/projects", labelKey: "nav.projects", Icon: Folder },
  { href: "/tasks", labelKey: "nav.tasks", Icon: ListTodo },
  { href: "/chat", labelKey: "nav.chat", Icon: MessageCircle },
  { href: "/agents", labelKey: "nav.agents", Icon: Bot },
];

export function MobileBottomNav() {
  const { t } = useTranslation();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("chrome.mobileNav.primaryNavigation")}
      className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-stretch border-t border-border bg-card/95 backdrop-blur md:hidden"
    >
      {NAV.map(({ href, labelKey, Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        const label = t(labelKey);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "grid h-9 w-9 place-items-center rounded-lg transition-all duration-200",
                active
                  ? "bg-primary/15 glow-icon-active"
                  : "glow-icon-hover"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
