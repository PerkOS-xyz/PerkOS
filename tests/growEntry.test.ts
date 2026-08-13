import { afterEach, describe, expect, it, vi } from "vitest";

const { redirect, getCookie } = vi.hoisted(() => ({ redirect: vi.fn(), getCookie: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: getCookie })) }));

import GrowEntryPage, { growDiagnosticUrl } from "../app/grow/page";

describe("Grow entry route", () => {
  afterEach(() => {
    redirect.mockReset();
    getCookie.mockReset();
    delete process.env.NEXT_PUBLIC_GROW_URL;
  });

  it("opens the production diagnostic in English by default", async () => {
    await GrowEntryPage({ searchParams: Promise.resolve({}) });

    expect(redirect).toHaveBeenCalledWith(
      "https://grow.perkos.xyz/diagnostic?lang=en",
    );
  });

  it("passes the explicit PerkOS language to Grow", async () => {
    await GrowEntryPage({ searchParams: Promise.resolve({ lang: "es" }) });

    expect(redirect).toHaveBeenCalledWith(
      "https://grow.perkos.xyz/diagnostic?lang=es",
    );
  });

  it("uses the shared cross-subdomain preference when the URL has no language", async () => {
    getCookie.mockReturnValue({ value: "ja" });
    await GrowEntryPage({ searchParams: Promise.resolve({}) });

    expect(redirect).toHaveBeenCalledWith(
      "https://grow.perkos.xyz/diagnostic?lang=ja",
    );
  });

  it("supports a configured Grow entry URL without dropping its query", async () => {
    process.env.NEXT_PUBLIC_GROW_URL = "https://grow.example/entry";

    await GrowEntryPage({ searchParams: Promise.resolve({ lang: "pt" }) });

    expect(redirect).toHaveBeenCalledWith("https://grow.example/entry?lang=pt");
  });

  it("falls back safely for unsupported language values", () => {
    expect(growDiagnosticUrl("https://grow.example/entry?ref=abc", "xx")).toBe(
      "https://grow.example/entry?ref=abc&lang=en",
    );
  });
});
