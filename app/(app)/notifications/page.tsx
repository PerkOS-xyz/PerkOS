"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  Bot,
  CheckCheck,
  Folder,
  ListTodo,
  MessageSquare,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  useNotifications,
  type Notification,
  type NotificationKind,
} from "../../lib/notifications";
import { EmptyState } from "../../components/EmptyState";
import { ConfirmDialog } from "../../components/ConfirmDialog";

type Filter = "all" | "unread";

type TFn = ReturnType<typeof useTranslation>["t"];

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  task: ListTodo,
  agent: Bot,
  project: Folder,
  mention: MessageSquare,
  system: Sparkles,
};

function timeAgo(ts: number, t: TFn): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("notifications.time.justNow");
  if (m < 60) return t("notifications.time.minutesAgo", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("notifications.time.hoursAgo", { count: h });
  const d = Math.floor(h / 24);
  return t("notifications.time.daysAgo", { count: d });
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const { items, unread, markRead, markAllRead, remove, clearAll } =
    useNotifications();
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const filtered = filter === "unread" ? items.filter((n) => !n.read) : items;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-medium text-foreground">
            {t("notifications.header.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("notifications.header.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              className="gap-1.5"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {t("notifications.actions.markAllRead")}
            </Button>
          ) : null}
          {items.length > 0 ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmClearOpen(true)}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("notifications.actions.clearAll")}
            </Button>
          ) : null}
        </div>
      </header>

      <div
        role="tablist"
        aria-label={t("notifications.tabs.filterAria")}
        className="flex w-fit gap-1 rounded-md border border-border bg-card p-1"
      >
        <FilterTab
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label={
            items.length > 0
              ? t("notifications.tabs.allWithCount", { count: items.length })
              : t("notifications.tabs.all")
          }
        />
        <FilterTab
          active={filter === "unread"}
          onClick={() => setFilter("unread")}
          label={
            unread > 0
              ? t("notifications.tabs.unreadWithCount", { count: unread })
              : t("notifications.tabs.unread")
          }
        />
      </div>

      {filtered.length === 0 ? (
        items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t("notifications.emptyNone.title")}
            description={t("notifications.emptyNone.description")}
          />
        ) : (
          <EmptyState
            icon={CheckCheck}
            title={t("notifications.emptyCaughtUp.title")}
            description={t("notifications.emptyCaughtUp.description")}
          />
        )
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
          {filtered.map((n) => (
            <NotificationRow
              key={n.id}
              n={n}
              onMarkRead={markRead}
              onRemove={remove}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title={t("notifications.clearDialog.title")}
        description={t("notifications.clearDialog.description")}
        confirmLabel={t("notifications.clearDialog.confirmLabel")}
        destructive
        onConfirm={() => {
          clearAll();
          setConfirmClearOpen(false);
        }}
      />
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function NotificationRow({
  n,
  onMarkRead,
  onRemove,
}: {
  n: Notification;
  onMarkRead: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  const Icon = KIND_ICON[n.kind] ?? Bell;
  const inner = (
    <div
      className={cn(
        "flex flex-1 items-start gap-3 px-4 py-3 transition-colors",
        !n.read && "bg-primary/[0.04]"
      )}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-sm text-foreground">{n.title}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {timeAgo(n.createdAt, t)}
          </span>
        </div>
        {n.body ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
        ) : null}
        {!n.read ? (
          <Badge
            variant="secondary"
            className="mt-1 w-fit border-0 bg-primary/15 text-[10px] text-primary"
          >
            {t("notifications.row.new")}
          </Badge>
        ) : null}
      </div>
    </div>
  );

  return (
    <li className="group relative flex items-stretch">
      {n.href ? (
        <Link
          href={n.href}
          onClick={() => onMarkRead(n.id)}
          className="flex flex-1 hover:bg-muted/20"
        >
          {inner}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => onMarkRead(n.id)}
          className="flex flex-1 text-left hover:bg-muted/20"
        >
          {inner}
        </button>
      )}

      <button
        type="button"
        onClick={() => onRemove(n.id)}
        aria-label={t("notifications.row.dismissAria")}
        title={t("notifications.row.dismiss")}
        className="grid w-10 shrink-0 place-items-center text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}
