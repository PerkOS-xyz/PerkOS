import { describe, expect, it } from "vitest";

import { isPublicPagePath } from "../app/lib/publicRoutes";

describe("isPublicPagePath", () => {
  it.each(["/", "/about", "/pricing", "/faq", "/tokens", "/ai-agents-for-business", "/solutions", "/solutions/restaurants", "/pricing/", "/Runtime"])(
    "treats %s as a public page",
    (path) => {
      expect(isPublicPagePath(path)).toBe(true);
    },
  );

  it.each(["/sign-in", "/continue", "/dashboard", "/projects/abc", "/onboarding/welcome", "/agents/abc", "/solutionsx", null, undefined, ""])(
    "keeps the wallet on %s",
    (path) => {
      expect(isPublicPagePath(path)).toBe(false);
    },
  );
});
