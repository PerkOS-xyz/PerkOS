import { fireEvent, render, screen } from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";
import { describe, expect, it, vi } from "vitest";

const engine = vi.hoisted(() => ({ reheat: vi.fn(), strength: vi.fn(), distance: vi.fn() }));

vi.mock("react-force-graph-3d", () => ({
  default: forwardRef(function MockForceGraph(
    props: { graphData: { nodes: Array<{ id: string; label: string }> }; onNodeClick?: (node: unknown) => void },
    ref,
  ) {
    useImperativeHandle(ref, () => ({
      zoomToFit: vi.fn(),
      cameraPosition: vi.fn(),
      controls: () => ({}),
      d3Force: () => ({ strength: engine.strength, distance: engine.distance }),
      d3ReheatSimulation: engine.reheat,
    }));
    return (
      <div data-testid="force-graph">
        {props.graphData.nodes.map((node) => (
          <button key={node.id} type="button" onClick={() => props.onNodeClick?.(node)}>
            Select {node.label}
          </button>
        ))}
      </div>
    );
  }),
}));

import { InteractiveGraph3D } from "../app/components/InteractiveGraph3D";

class MockResizeObserver {
  observe() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", MockResizeObserver);

describe("InteractiveGraph3D", () => {
  it("exposes semantic navigation and connected context", () => {
    render(
      <InteractiveGraph3D
        ariaLabel="Project knowledge map"
        expanded={false}
        nodes={[
          { key: "project", kind: "project", label: "Coffee launch", status: "Active", x: 0, y: 0 },
          { key: "agent", kind: "agent", label: "Maya", status: "Working", x: 1, y: 1 },
          { key: "task", kind: "task", label: "Draft campaign", status: "In progress", x: 2, y: 2 },
        ]}
        edges={[
          { from: "project", to: "agent", color: "#ffffff" },
          { from: "agent", to: "task", color: "#ffffff", active: true },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Reset view" })).toBeInTheDocument();
    expect(screen.getByText("project")).toBeInTheDocument();
    expect(screen.getByText("agent")).toBeInTheDocument();
    expect(screen.getByText("task")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select Maya" }));

    expect(screen.getByRole("heading", { name: "Maya" })).toBeInTheDocument();
    expect(screen.getByText("Connected to")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coffee launch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Draft campaign" })).toBeInTheDocument();
  });

  it("configures the forces without starting the engine before the library has a layout", () => {
    engine.reheat.mockClear();
    engine.strength.mockClear();
    render(
      <InteractiveGraph3D
        ariaLabel="Workflow"
        expanded={false}
        nodes={[{ key: "project", kind: "project", label: "Tea launch", status: "Active", x: 0, y: 0 }]}
        edges={[]}
      />,
    );
    expect(engine.strength).toHaveBeenCalledWith(-260);
    expect(engine.reheat).not.toHaveBeenCalled();
  });
});
