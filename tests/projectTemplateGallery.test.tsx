import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ address: "" }));

vi.mock("../app/lib/useAppAccount", () => ({ useAppAccount: () => ({ address: account.address }) }));
vi.mock("../app/lib/useActiveOrg", () => ({ useActiveOrg: () => ({ activeOrg: null }) }));
vi.mock("../app/lib/apiClient", () => ({
  authedFetch: vi.fn(async () => ({
    ok: true,
    json: async () => ({
      templates: [
        { id: "artizen-update", name: { en: "Artizen Creator Update" }, description: { en: "One project, one Hermes agent." }, kind: "artizen" },
        { id: "floor-desk", name: { en: "PerkOS Floor Desk" }, description: { en: "Scout, Risk, Trader and Auditor on Base." }, kind: "fleet" },
      ],
    }),
  })),
}));

import { ProjectTemplateGallery } from "../app/components/ProjectTemplateWizard";

describe("ProjectTemplateGallery", () => {
  beforeEach(() => {
    account.address = "";
  });

  it("hides desk templates from a Solana account", async () => {
    account.address = "EsXvSde4oFup8d2QdbEMrA2YWjCod52SbECQ9dgJ6SLA";
    render(<ProjectTemplateGallery />);
    await waitFor(() => expect(screen.getByText("Artizen Creator Update")).toBeInTheDocument());
    expect(screen.queryByText("PerkOS Floor Desk")).not.toBeInTheDocument();
  });

  it("keeps desk templates for an EVM account", async () => {
    account.address = "0x3f0d000000000000000000000000000000000001";
    render(<ProjectTemplateGallery />);
    await waitFor(() => expect(screen.getByText("PerkOS Floor Desk")).toBeInTheDocument());
  });
});
