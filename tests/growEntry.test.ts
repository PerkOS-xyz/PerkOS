import { afterEach, describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect }));

import GrowEntryPage from "../app/grow/page";

describe("Grow entry route", () => {
  afterEach(() => {
    redirect.mockReset();
    delete process.env.NEXT_PUBLIC_GROW_URL;
  });

  it("opens the production diagnostic by default", () => {
    GrowEntryPage();

    expect(redirect).toHaveBeenCalledWith(
      "https://grow.perkos.xyz/diagnostic",
    );
  });

  it("supports a configured Grow entry URL", () => {
    process.env.NEXT_PUBLIC_GROW_URL = "https://grow.example/entry";

    GrowEntryPage();

    expect(redirect).toHaveBeenCalledWith("https://grow.example/entry");
  });
});
