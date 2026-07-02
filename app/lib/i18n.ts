"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../i18n/locales/en.json";
import es from "../i18n/locales/es.json";
import it from "../i18n/locales/it.json";
import fr from "../i18n/locales/fr.json";
import ko from "../i18n/locales/ko.json";
import zh from "../i18n/locales/zh.json";
import ja from "../i18n/locales/ja.json";

export type LanguageCode = "en" | "es" | "it" | "fr" | "ko" | "zh" | "ja";

// Ordered for the selector (per UX spec): English pinned first, then the Latin-script
// languages alphabetical by endonym (Español, Français, Italiano), then CJK alphabetical
// by English name (Chinese, Japanese, Korean). `label` is the native endonym.
export const SUPPORTED_LANGUAGES: { code: LanguageCode; label: string; english: string }[] = [
  { code: "en", label: "English", english: "English" },
  { code: "es", label: "Español", english: "Spanish" },
  { code: "fr", label: "Français", english: "French" },
  { code: "it", label: "Italiano", english: "Italian" },
  { code: "zh", label: "中文", english: "Chinese" },
  { code: "ja", label: "日本語", english: "Japanese" },
  { code: "ko", label: "한국어", english: "Korean" },
];

export const LANGUAGE_STORAGE_KEY = "perkos-lang";

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

export function isSupportedLanguage(code: string): code is LanguageCode {
  return (SUPPORTED_CODES as string[]).includes(code);
}

/**
 * Resolve the initial language on the CLIENT (call post-mount only):
 * saved choice → browser languages → English. Region is stripped (fr-CA → fr).
 */
export function detectInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && isSupportedLanguage(saved)) return saved;
  } catch {
    // localStorage blocked — fall through to navigator
  }
  const candidates =
    navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
  for (const c of candidates) {
    const base = (c || "").split("-")[0].toLowerCase();
    if (isSupportedLanguage(base)) return base;
  }
  return "en";
}

// Client-side i18n: no URL/locale routing (keeps Mini App embed URLs clean), no
// middleware, no build-arg changes. We init at `lng:"en"` so SSR and the first
// client render agree (no hydration mismatch); LocaleProvider switches to the
// detected/saved language in a post-mount effect. Fallback stays English.
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      it: { translation: it },
      fr: { translation: fr },
      ko: { translation: ko },
      zh: { translation: zh },
      ja: { translation: ja },
    },
    lng: "en",
    fallbackLng: "en",
    supportedLngs: ["en", "es", "it", "fr", "ko", "zh", "ja"],
    load: "languageOnly", // fr-CA → fr, zh-CN → zh, ja-JP → ja
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false }, // React already escapes
    react: { useSuspense: false },
  });
}

export default i18n;
