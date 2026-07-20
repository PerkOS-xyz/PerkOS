import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("wagmi", () => ({ useChainId: () => 8453 }));

import { StepMethod } from "@/app/(app)/agents/new/wizard/steps/StepMethod";
import { INITIAL_WIZARD_STATE } from "@/app/(app)/agents/new/wizard/types";

describe("StepMethod", () => {
  it("offers an allowlisted user the self-hosted VPS path", () => {
    const onChange = vi.fn();
    render(
      <StepMethod
        state={INITIAL_WIZARD_STATE}
        onChange={onChange}
        ecsAllowed
        ecsAccessLoading={false}
        vpsAllowed
        vpsAccessLoading={false}
      />,
    );

    fireEvent.click(screen.getByText("Your VPS (self-hosted)"));
    expect(onChange).toHaveBeenCalledWith({
      method: "vps",
      deployMode: "self-hosted",
    });
  });

  it("keeps the VPS path visible but disabled before allowlist approval", () => {
    const onChange = vi.fn();
    render(
      <StepMethod
        state={INITIAL_WIZARD_STATE}
        onChange={onChange}
        ecsAllowed
        ecsAccessLoading={false}
        vpsAllowed={false}
        vpsAccessLoading={false}
      />,
    );

    fireEvent.click(screen.getByText("Your VPS (self-hosted)"));
    expect(screen.getAllByText("Coming soon").length).toBeGreaterThan(0);
    expect(onChange).not.toHaveBeenCalled();
  });
});
