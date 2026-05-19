"use client";

import { useCallback, useEffect, useState } from "react";

export type NotificationKind = "task" | "agent" | "project" | "mention" | "system";

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string;
  createdAt: number;
  read: boolean;
};

const STORAGE_KEY = "swarm.notifications.v1";

function isBrowser() {
  return typeof window !== "undefined";
}

function readStore(): Notification[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Notification[]) : [];
  } catch {
    return [];
  }
}

function writeStore(value: Notification[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore quota / disabled storage
  }
}

const STORE_EVENT = "perkos:notifications-changed";

function notifyChange() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(STORE_EVENT));
}

export function useNotifications() {
  const [items, setItems] = useState<Notification[]>(() => readStore());

  useEffect(() => {
    function refresh() {
      setItems(readStore());
    }
    window.addEventListener(STORE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(STORE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const markRead = useCallback((id: string) => {
    const next = readStore().map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    writeStore(next);
    notifyChange();
  }, []);

  const markAllRead = useCallback(() => {
    const next = readStore().map((n) => ({ ...n, read: true }));
    writeStore(next);
    notifyChange();
  }, []);

  const remove = useCallback((id: string) => {
    const next = readStore().filter((n) => n.id !== id);
    writeStore(next);
    notifyChange();
  }, []);

  const clearAll = useCallback(() => {
    writeStore([]);
    notifyChange();
  }, []);

  const add = useCallback(
    (input: Omit<Notification, "id" | "createdAt" | "read"> & { read?: boolean }) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2, 10);
      const next: Notification = {
        id,
        createdAt: Date.now(),
        read: input.read ?? false,
        kind: input.kind,
        title: input.title,
        body: input.body,
        href: input.href,
      };
      writeStore([next, ...readStore()]);
      notifyChange();
      return next;
    },
    []
  );

  const unread = items.filter((n) => !n.read).length;

  return { items, unread, markRead, markAllRead, remove, clearAll, add };
}
