import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TaskAgentCard, taskAgentName } from "../app/components/TaskAgentCard";
const mock = vi.hoisted(() => ({ language: "en" }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: mock.language } }) }));
afterEach(cleanup);
it.each([
  ["en", "resting", "Resting"], ["es", "resting", "En reposo"],
  ["en", "executing", "Working"], ["es", "executing", "Trabajando"],
  ["en", "queued", "Preparing"], ["es", "awaiting_stop", "Volviendo a reposo"],
])("uses last-read agent state in %s: %s", (language, executionState, label) => {
  mock.language = language;
  const { container } = render(<TaskAgentCard name="opaque-fixture" onDemand agent={{name:"opaque-fixture",displayName:"Creator Update",executionMode:"artizen-on-demand",executionState}} />);
  expect(screen.getByText("Creator Update")).toBeInTheDocument();
  expect(screen.getByText(`${language === "es" ? "Último estado consultado" : "Last checked state"}: ${label}`)).toBeInTheDocument();
  expect(screen.queryByText(/Online|opaque-fixture/)).not.toBeInTheDocument();
  expect(container.querySelector(".bg-emerald-400")).toBeNull();
});
it.each([undefined, {name:"opaque-fixture",executionState:"resting"}, {name:"opaque-fixture",executionMode:"artizen-on-demand" as const,executionState:"unexpected"}])("never guesses presence from absent/unverified metadata", agent => {
  mock.language = "en";
  render(<TaskAgentCard name="opaque-fixture" onDemand agent={agent} />);
  expect(screen.getByText("Hermes")).toBeInTheDocument();
  expect(screen.getByText("State unverified")).toBeInTheDocument();
  expect(screen.queryByText(/Online|Last checked state/)).not.toBeInTheDocument();
});
it("does not invent Online for ordinary agents either", () => {
  mock.language = "en";
  render(<TaskAgentCard name="Helper" onDemand={false} />);
  expect(screen.getByText("Runtime unverified")).toBeInTheDocument();
  expect(screen.queryByText("Online")).not.toBeInTheDocument();
});
it("a refreshed executing identity changes independently of the historical task", () => {
  mock.language = "en";
  const agent = {name:"fixture",executionMode:"artizen-on-demand" as const,executionState:"resting"};
  const {rerender}=render(<TaskAgentCard name="fixture" onDemand agent={agent} />);
  rerender(<TaskAgentCard name="fixture" onDemand agent={{...agent,executionState:"executing"}} />);
  expect(screen.getByText("Last checked state: Working")).toBeInTheDocument();
  expect(screen.queryByText("Last checked state: Resting")).not.toBeInTheDocument();
  expect(taskAgentName("fixture",true)).toBe("Hermes");
});
