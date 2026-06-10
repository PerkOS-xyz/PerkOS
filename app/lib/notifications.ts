"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection } from "wagmi";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";

import { firebaseDb } from "./firebase";

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

function tsToMs(value: unknown): number {
  if (!value) return Date.now();
  if (typeof value === "number") return value;
  if (typeof (value as Timestamp).toMillis === "function")
    return (value as Timestamp).toMillis();
  return Date.now();
}

function notificationsCol(wallet: string) {
  return collection(
    firebaseDb(),
    "wallets",
    wallet.toLowerCase(),
    "notifications"
  );
}

/**
 * Firestore-backed in-app notifications, scoped to the connected wallet at
 * /wallets/{wallet}/notifications. Real + persistent + cross-device — NOT
 * browser localStorage. The server (PerkOS-API `writeWalletNotification`,
 * e.g. provision outcomes + @-mention pings) writes here via the Admin SDK;
 * this hook live-subscribes. The owner can read/write their own (firestore
 * rules: workspace wildcard isSelf).
 */
export function useNotifications() {
  const { address } = useConnection();
  const wallet = address?.toLowerCase() ?? null;
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    if (!wallet) {
      setItems([]);
      return;
    }
    const q = query(
      notificationsCol(wallet),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    return onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((d) => {
            const v = d.data();
            return {
              id: d.id,
              kind: (v.kind as NotificationKind) ?? "system",
              title: (v.title as string) ?? "",
              body: (v.body as string | undefined) ?? undefined,
              href: (v.href as string | undefined) ?? undefined,
              createdAt: tsToMs(v.createdAt),
              read: v.read === true,
            };
          })
        );
      },
      () => setItems([])
    );
  }, [wallet]);

  const markRead = useCallback(
    (id: string) => {
      if (!wallet) return;
      void updateDoc(doc(notificationsCol(wallet), id), { read: true }).catch(
        () => {}
      );
    },
    [wallet]
  );

  const markAllRead = useCallback(() => {
    if (!wallet) return;
    const batch = writeBatch(firebaseDb());
    for (const n of items) {
      if (!n.read) batch.update(doc(notificationsCol(wallet), n.id), { read: true });
    }
    void batch.commit().catch(() => {});
  }, [wallet, items]);

  const remove = useCallback(
    (id: string) => {
      if (!wallet) return;
      void deleteDoc(doc(notificationsCol(wallet), id)).catch(() => {});
    },
    [wallet]
  );

  const clearAll = useCallback(async () => {
    if (!wallet) return;
    const snap = await getDocs(notificationsCol(wallet));
    const batch = writeBatch(firebaseDb());
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit().catch(() => {});
  }, [wallet]);

  /** Add a notification to MY OWN feed (local-origin signals). */
  const add = useCallback(
    (input: Omit<Notification, "id" | "createdAt" | "read"> & { read?: boolean }) => {
      if (!wallet) return;
      void addDoc(notificationsCol(wallet), {
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        read: input.read ?? false,
        createdAt: serverTimestamp(),
      }).catch(() => {});
    },
    [wallet]
  );

  const unread = items.filter((n) => !n.read).length;

  return { items, unread, markRead, markAllRead, remove, clearAll, add };
}
