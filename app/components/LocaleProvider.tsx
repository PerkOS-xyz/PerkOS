"use client";

import { useEffect, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { detectInitialLanguage, LANGUAGE_STORAGE_KEY } from "../lib/i18n";

/**
 * Mounts the (client-side) i18n instance. i18next starts at English so SSR and the
 * first client render match; here — post-mount — we switch to the saved/browser
 * language, keep `<html lang>` in sync, and persist the choice to localStorage.
 * Wraps the whole app so `useTranslation()` works everywhere.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const initial = detectInitialLanguage();
    if (initial !== i18n.resolvedLanguage) {
      void i18n.changeLanguage(initial);
    }

    const onLanguageChanged = (lng: string) => {
      const base = (lng || "en").split("-")[0];
      if (typeof document !== "undefined") {
        document.documentElement.lang = base;
      }
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, base);
      } catch {
        // localStorage blocked — selection just won't persist across reloads
      }
    };
    onLanguageChanged(i18n.resolvedLanguage || i18n.language);
    i18n.on("languageChanged", onLanguageChanged);
    return () => {
      i18n.off("languageChanged", onLanguageChanged);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
