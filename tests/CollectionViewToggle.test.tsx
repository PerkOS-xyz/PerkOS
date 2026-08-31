import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionViewToggle } from "../app/components/CollectionViewToggle";

describe("CollectionViewToggle", () => {
  it("exposes the selected view and changes modes", () => {
    const onChange = vi.fn();
    render(
      <CollectionViewToggle
        mode="cards"
        onChange={onChange}
        cardsLabel="Cards view"
        listLabel="List view"
      />,
    );
    expect(screen.getByRole("button", { name: "Cards view" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(onChange).toHaveBeenCalledWith("list");
  });
});
