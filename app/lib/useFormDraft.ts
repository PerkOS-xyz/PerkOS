"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const KEY_PREFIX = "swarm.draft.";

function storageKey(name: string): string {
  return `${KEY_PREFIX}${name}`;
}

function readDraft<T>(name: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(name));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeDraft<T>(name: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(name), JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled — drop silently.
  }
}

function clearDraft(name: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(name));
  } catch {
    // ignore
  }
}

/**
 * Persists form state to localStorage so users don't lose unsaved drafts when
 * they refresh or navigate away. Returns the same `[value, setValue]` shape
 * as `useState` plus a `clear` helper to wipe the draft on successful submit.
 */
export function useFormDraft<T>(
  name: string,
  defaults: T
): readonly [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(defaults);
  const hydrated = useRef(false);

  // Hydrate from localStorage after mount to avoid SSR/client mismatches.
  useEffect(() => {
    const stored = readDraft<T>(name);
    if (stored != null) {
      setValue((current) =>
        typeof current === "object" && current !== null && !Array.isArray(current)
          ? ({ ...(current as object), ...(stored as object) } as T)
          : stored
      );
    }
    hydrated.current = true;
  }, [name]);

  // Persist after each change, but only after the initial hydration so we
  // don't immediately overwrite stored drafts with the default values.
  useEffect(() => {
    if (!hydrated.current) return;
    writeDraft(name, value);
  }, [name, value]);

  const clear = useCallback(() => {
    clearDraft(name);
    setValue(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  return [value, setValue, clear] as const;
}
