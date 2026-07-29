import { describe, expect, it } from "vitest";

import en from "../app/i18n/locales/en.json";
import es from "../app/i18n/locales/es.json";
import pt from "../app/i18n/locales/pt.json";
import {
  isSupportedLanguage,
  SUPPORTED_LANGUAGES,
} from "../app/lib/i18n";

function scalarPaths(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, item]) =>
    scalarPaths(item, prefix ? `${prefix}.${key}` : key),
  );
}

function placeholders(value: unknown): string[] {
  return typeof value === "string"
    ? [...value.matchAll(/\{\{[^}]+\}\}/g)].map((match) => match[0]).sort()
    : [];
}

function valueAtPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (current, key) =>
      current && typeof current === "object"
        ? (current as Record<string, unknown>)[key]
        : undefined,
    value,
  );
}

describe("Portuguese locale", () => {
  it("is available through the language selector and detector", () => {
    expect(isSupportedLanguage("pt")).toBe(true);
    expect(SUPPORTED_LANGUAGES).toContainEqual({
      code: "pt",
      label: "Português",
      english: "Portuguese",
    });
  });

  it("has complete key and interpolation parity with English", () => {
    const englishPaths = scalarPaths(en).sort();
    expect(scalarPaths(pt).sort()).toEqual(englishPaths);

    for (const path of englishPaths) {
      expect(placeholders(valueAtPath(pt, path)), path).toEqual(
        placeholders(valueAtPath(en, path)),
      );
    }
  });
});

describe("international Spanish locale", () => {
  it("does not contain Rioplatense voseo forms", () => {
    const serialized = JSON.stringify(es);
    expect(serialized).not.toMatch(
      /\b(tenés|podés|querés|sabés|sos|subí|vinculá|ingresalo|por vos|acá)\b/i,
    );
  });
});
