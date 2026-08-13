"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const STORAGE_PREFIX = "perkos.ui.advanced.v1";
const CHANGE_EVENT = "perkos:advanced-features-change";

export function advancedFeaturesStorageKey(accountId: string): string {
  return `${STORAGE_PREFIX}:${accountId.trim().toLowerCase()}`;
}

export function readAdvancedFeatures(
  accountId: string | undefined,
  storage: Pick<Storage, "getItem"> | undefined =
    typeof window === "undefined" ? undefined : window.localStorage,
): boolean {
  if (!accountId || !storage) return false;
  try {
    return storage.getItem(advancedFeaturesStorageKey(accountId)) === "on";
  } catch {
    return false;
  }
}

export function useAdvancedFeatures(accountId?: string) {
  const storageKey = useMemo(
    () => (accountId ? advancedFeaturesStorageKey(accountId) : null),
    [accountId],
  );
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (!storageKey) return () => {};
    const sync = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== storageKey) return;
      if (event instanceof CustomEvent && event.detail?.key !== storageKey) return;
      onStoreChange();
    };
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, [storageKey]);

  const getSnapshot = useCallback(
    () => readAdvancedFeatures(accountId),
    [accountId],
  );
  const enabled = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const clientReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const setEnabled = useCallback(
    (next: boolean) => {
      if (!storageKey) return;
      try {
        if (next) window.localStorage.setItem(storageKey, "on");
        else window.localStorage.removeItem(storageKey);
        window.dispatchEvent(
          new CustomEvent(CHANGE_EVENT, { detail: { key: storageKey } }),
        );
      } catch {
        // Storage may be unavailable in hardened browser contexts. The mode
        // intentionally remains off instead of falling back to an unsafe
        // in-memory preference.
      }
    },
    [storageKey],
  );

  return { enabled, ready: clientReady && Boolean(accountId), setEnabled };
}
