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
import pt from "../i18n/locales/pt.json";

export type LanguageCode = "en" | "es" | "it" | "fr" | "pt" | "ko" | "zh" | "ja";

// Ordered for the selector (per UX spec): English pinned first, then the Latin-script
// languages alphabetical by endonym (Español, Français, Português),
// then Japanese and Korean. Chinese remains translated in resources but is
// temporarily hidden from the public selector. Italian remains available as a
// legacy App resource but is hidden until Grow has complete diagnostic/report
// parity. `label` is the native endonym.
export const SUPPORTED_LANGUAGES: { code: LanguageCode; label: string; english: string }[] = [
  { code: "en", label: "English", english: "English" },
  { code: "es", label: "Español", english: "Spanish" },
  { code: "fr", label: "Français", english: "French" },
  // { code: "it", label: "Italiano", english: "Italian" },
  { code: "pt", label: "Português", english: "Portuguese" },
  // { code: "zh", label: "中文", english: "Chinese" },
  { code: "ja", label: "日本語", english: "Japanese" },
  { code: "ko", label: "한국어", english: "Korean" },
];

export const LANGUAGE_STORAGE_KEY = "perkos-lang";
export const SHARED_LANGUAGE_COOKIE = "perkos-language";

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

export function isSupportedLanguage(code: string): code is LanguageCode {
  return (SUPPORTED_CODES as string[]).includes(code);
}

export function resolveInitialLanguage({
  query,
  sharedCookie,
  saved,
  browserLanguages,
}: {
  query?: string | null;
  sharedCookie?: string | null;
  saved?: string | null;
  browserLanguages?: readonly string[];
}): LanguageCode {
  for (const candidate of [query, sharedCookie, saved, ...(browserLanguages ?? [])]) {
    const base = (candidate ?? "").split("-")[0].toLowerCase();
    if (isSupportedLanguage(base)) return base;
  }
  return "en";
}

function readSharedLanguageCookie(): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${SHARED_LANGUAGE_COOKIE}=`;
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

export function persistLanguagePreference(language: LanguageCode) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // localStorage can be blocked; the shared first-party cookie still carries
    // the preference between perkos.xyz and grow.perkos.xyz.
  }

  const onPerkosDomain =
    window.location.hostname === "perkos.xyz" ||
    window.location.hostname.endsWith(".perkos.xyz");
  const domain = onPerkosDomain ? "; Domain=.perkos.xyz" : "";
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${SHARED_LANGUAGE_COOKIE}=${encodeURIComponent(language)}; Path=/; Max-Age=31536000; SameSite=Lax${domain}${secure}`;
}

/**
 * Resolve the initial language on the CLIENT (call post-mount only):
 * saved choice → browser languages → English. Region is stripped (fr-CA → fr).
 */
export function detectInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const query = new URLSearchParams(window.location.search).get("lang");
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return resolveInitialLanguage({
      query,
      sharedCookie: readSharedLanguageCookie(),
      saved,
      browserLanguages:
        navigator.languages && navigator.languages.length
          ? navigator.languages
          : [navigator.language],
    });
  } catch {
    return resolveInitialLanguage({
      query,
      sharedCookie: readSharedLanguageCookie(),
      browserLanguages:
        navigator.languages && navigator.languages.length
          ? navigator.languages
          : [navigator.language],
    });
  }
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
      pt: { translation: pt },
    },
    lng: "en",
    fallbackLng: "en",
    supportedLngs: ["en", "es", "it", "fr", "pt", "ko", "zh", "ja"],
    load: "languageOnly", // fr-CA → fr, zh-CN → zh, ja-JP → ja
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false }, // React already escapes
    react: { useSuspense: false },
  });
}

export default i18n;
