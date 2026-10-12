import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const mock = vi.hoisted(() => ({ redirect: vi.fn(() => { throw Error("NEXT_REDIRECT"); }) }));
vi.mock("next/navigation", () => ({ redirect: mock.redirect }));
import CreatorsPage, { metadata } from "../app/creators/page";
import LegacyCreatorsPage from "../app/artizen/page";
afterEach(cleanup);
it("publishes a neutral Creators page with clear approval and spending limits", () => {
  const { container } = render(<CreatorsPage />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Real progress");
  expect(screen.getByRole("link", { name: "Open PerkOS" })).toHaveAttribute("href", "/sign-in");
  expect(container.textContent).not.toMatch(/Artizen/i);
  expect(container.textContent).toContain("does not start compute or authorize spending");
  expect(metadata.alternates).toMatchObject({ canonical: "/creators" });
});
it("redirects the old public route instead of breaking inbound links", () => {
  expect(() => LegacyCreatorsPage()).toThrow("NEXT_REDIRECT");
  expect(mock.redirect).toHaveBeenCalledWith("/creators");
});
