"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Folder, ListTodo, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Home", Icon: Home },
  { href: "/projects", label: "Projects", Icon: Folder },
  { href: "/tasks", label: "Tasks", Icon: ListTodo },
  { href: "/agents", label: "Agents", Icon: Bot },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-stretch border-t border-border bg-card/95 backdrop-blur md:hidden"
    >
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
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
                "grid h-9 w-9 place-items-center rounded-lg transition-colors",
                active && "bg-primary/15"
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
