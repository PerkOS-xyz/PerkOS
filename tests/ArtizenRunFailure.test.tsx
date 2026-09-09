import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ArtizenRunFailure, isArtizenUnsuccessful } from "../app/components/ArtizenRunFailure";
const mock = vi.hoisted(() => ({ language: "en" }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: mock.language } }) }));
afterEach(cleanup);
it.each(["en", "es"])("distinguishes held and reconciled startup failures in %s", language => {
  mock.language = language;
  const run = { phase: "awaiting_stop", result: null, failureCode: "runtime-start-failed" };
  const view = render(<ArtizenRunFailure run={run} />);
  expect(screen.getByRole("alert")).toHaveTextContent(language === "es" ? "No se llamó al modelo" : "The model was not called");
  expect(screen.getByRole("alert")).toHaveTextContent(language === "es" ? "sigue retenida" : "remains held");
  view.rerender(<ArtizenRunFailure run={{ ...run, phase: "settled" }} />);
  expect(screen.getByRole("alert")).toHaveTextContent(language === "es" ? "se ha conciliado" : "has been reconciled");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("does not claim no model call for generic failure or hide an existing draft", () => {
  mock.language = "en";
  render(<ArtizenRunFailure run={{ phase: "settled", stopReason: "failed", result: null }} />);
  expect(screen.getByRole("alert")).not.toHaveTextContent("model was not called");
  expect(isArtizenUnsuccessful({ phase: "settled", result: { draft: "Preserve" }, stopReason: "failed" })).toBe(false);
  expect(isArtizenUnsuccessful({ phase: "executing", result: null })).toBe(false);
});
