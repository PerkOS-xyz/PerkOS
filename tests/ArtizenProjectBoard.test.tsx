import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ArtizenProjectBoard } from "../app/components/ArtizenProjectBoard";
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: "es" } }) }));
afterEach(cleanup);
it("shows canonical tasks, human review and read-only task links", () => {
  render(<ArtizenProjectBoard projectId="template-fixture" tasks={[{ id: "artizen-run", name: "Prepare supporter update", status: "Review", priority: "Medium", agent: "Hermes", result: "Draft", executionMode: "artizen-on-demand" }]} />);
  expect(screen.getByText("Revisión humana · 1")).toBeInTheDocument();
  expect(screen.getByText("Preparar actualización").closest("a")).toHaveAttribute("href", "/projects/template-fixture/tasks/artizen-run");
  expect(screen.getByRole("link", { name: "Trabajar con Hermes" })).toHaveAttribute("href", "/projects/template-fixture#artizen-workflow");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getAllByText("No hay tareas en esta fase.")).toHaveLength(3);
});
