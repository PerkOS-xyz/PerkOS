import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ArtizenFormatReview, type FormatReview } from "../app/components/ArtizenFormatReview";
afterEach(cleanup);
const review: FormatReview = { contract: "artizen-update-v1", status: "needs-review", wordCount: 82, paragraphCount: 1,
  issues: ["paragraph_count", "word_count"] };
it.each([false, true])("shows failed format with truthful counts and no generation action (es=%s)", es => {
  render(<ArtizenFormatReview review={review} es={es} />);
  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent("82"); expect(alert).toHaveTextContent("90–120");
  expect(alert).toHaveTextContent(es ? "no de los hechos" : "not the facts");
  expect(alert).toHaveTextContent(es ? "No se volverá a generar automáticamente" : "No automatic regeneration");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("a passing format is not a factuality verdict and edits never silently inherit a pass", () => {
  render(<ArtizenFormatReview review={{ ...review, status: "passed", issues: [], wordCount: 100, paragraphCount: 2 }} es={false} edited />);
  expect(screen.getByRole("status")).toHaveTextContent("Format: checks passed");
  expect(screen.getByRole("status")).toHaveTextContent("not your changes");
  expect(screen.getByRole("status")).toHaveTextContent("not the facts");
});
it("legacy results have no fabricated assessment", () => {
  const { container } = render(<ArtizenFormatReview es={false} />);
  expect(container).toBeEmptyDOMElement();
});
