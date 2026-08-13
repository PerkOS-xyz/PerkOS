import { redirect } from "next/navigation";
import { cookies } from "next/headers";

const DEFAULT_GROW_DIAGNOSTIC_URL = "https://grow.perkos.xyz/diagnostic";
const SHARED_LANGUAGE_COOKIE = "perkos-language";
const SUPPORTED_LANGUAGES = new Set(["en", "es", "fr", "pt", "ja", "ko"]);

export function growDiagnosticUrl(baseUrl: string, language: string) {
  const url = new URL(baseUrl);
  url.searchParams.set("lang", SUPPORTED_LANGUAGES.has(language) ? language : "en");
  return url.toString();
}

export default async function GrowEntryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const explicit = typeof query.lang === "string" ? query.lang.split("-")[0].toLowerCase() : "";
  const saved = (await cookies()).get(SHARED_LANGUAGE_COOKIE)?.value?.split("-")[0].toLowerCase() ?? "";
  const language = SUPPORTED_LANGUAGES.has(explicit)
    ? explicit
    : SUPPORTED_LANGUAGES.has(saved)
      ? saved
      : "en";
  redirect(growDiagnosticUrl(process.env.NEXT_PUBLIC_GROW_URL ?? DEFAULT_GROW_DIAGNOSTIC_URL, language));
}
