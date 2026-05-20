import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Folder } from "lucide-react";

import { EmptyState } from "../app/components/EmptyState";

describe("EmptyState", () => {
  it("renders title only when no actions or description", () => {
    render(<EmptyState title="No projects yet" />);
    expect(
      screen.getByRole("heading", { name: "No projects yet" }),
    ).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <EmptyState
        title="Empty"
        description="Add your first project to get started."
      />,
    );
    expect(
      screen.getByText(/Add your first project/i),
    ).toBeInTheDocument();
  });

  it("renders an icon when provided", () => {
    const { container } = render(<EmptyState icon={Folder} title="Empty" />);
    // lucide icons render as <svg>; assert one is present in the icon slot.
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("calls onClick for action buttons without href", async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="Empty"
        actions={[{ label: "Create one", onClick }]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Create one" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders link actions as anchors when href is supplied", () => {
    render(
      <EmptyState
        title="Empty"
        actions={[{ label: "Go", href: "/projects/new" }]}
      />,
    );
    const link = screen.getByRole("link", { name: "Go" });
    expect(link).toHaveAttribute("href", "/projects/new");
  });
});
