import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Initialize i18next (lng:"en", resources bundled → synchronous init) so that
// components using useTranslation() render the English source text in jsdom.
// Without this the default i18next singleton is uninitialized and t() returns
// raw keys, breaking assertions on rendered copy.
import "@/app/lib/i18n";

afterEach(() => {
  cleanup();
});
