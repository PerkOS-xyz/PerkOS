import { fireEvent, render, screen } from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-force-graph-3d", () => ({
  default: forwardRef(function MockForceGraph(
    props: { graphData: { nodes: Array<{ id: string; label: string }> }; onNodeClick?: (node: unknown) => void },
    ref,
  ) {
    useImperativeHandle(ref, () => ({
      zoomToFit: vi.fn(),
      cameraPosition: vi.fn(),
      controls: () => ({}),
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
});
