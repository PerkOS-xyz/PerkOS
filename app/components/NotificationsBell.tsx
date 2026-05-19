"use client";

import Link from "next/link";
import { Bell, BellDot, CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useNotifications, type Notification } from "../lib/notifications";

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function NotificationsBell() {
  const { items, unread, markRead, markAllRead } = useNotifications();
  const Icon = unread > 0 ? BellDot : Bell;
  const recent = items.slice(0, 5);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              unread > 0
                ? `Notifications (${unread} unread)`
                : "Notifications"
            }
            className="relative h-9 w-9 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          />
        }
      >
        <Icon className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 border-border bg-card p-0"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-medium text-foreground">Notifications</p>
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          ) : null}
        </div>

        {recent.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-foreground">No notifications yet</p>
            <p className="max-w-[220px] text-xs text-muted-foreground">
              Task completions, agent status changes, and project mentions will
              land here.
            </p>
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {recent.map((n) => (
              <BellRow key={n.id} n={n} onMarkRead={markRead} />
            ))}
          </ul>
        )}

        <div className="border-t border-border px-4 py-2 text-center">
          <Link
            href="/notifications"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BellRow({
  n,
  onMarkRead,
}: {
  n: Notification;
  onMarkRead: (id: string) => void;
}) {
  const content = (
    <div
      className={cn(
        "flex flex-col gap-0.5 px-4 py-2.5 transition-colors hover:bg-muted/30",
        !n.read && "bg-primary/5"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-sm text-foreground">{n.title}</span>
        {!n.read ? (
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
        ) : null}
      </div>
      <span className="text-[10px] text-muted-foreground">
        {timeAgo(n.createdAt)}
      </span>
    </div>
  );

  if (n.href) {
    return (
      <li>
        <Link href={n.href} onClick={() => onMarkRead(n.id)}>
          {content}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => onMarkRead(n.id)}
        className="block w-full text-left"
      >
        {content}
      </button>
    </li>
  );
}
