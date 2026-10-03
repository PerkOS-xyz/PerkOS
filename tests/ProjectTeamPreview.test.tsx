import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectTeamPreview } from "../app/components/ProjectTeamPreview";
import type { TemplateTeamRole } from "../app/lib/projectTemplateTypes";

const policy = {
  readScopes: ["project", "task"],
  readNodeTypes: ["project-brief", "task"],
  actions: ["read", "create-artifact"],
  escalation: ["external-write", "human-decision"],
} satisfies TemplateTeamRole["policy"];

const team: TemplateTeamRole[] = [
  {
    roleId: "reviewer",
    name: { en: "Reviewer", es: "Revisor" },
    responsibility: { en: "Reviews the work", es: "Revisa el trabajo" },
    isLead: false,
    order: 1,
    policy,
    avatarSeed: "demo:reviewer",
  },
  {
    roleId: "lead",
    name: { en: "Lead", es: "Líder" },
    responsibility: { en: "Coordinates the team", es: "Coordina el equipo" },
    isLead: true,
    order: 0,
    policy,
    avatarSeed: "demo:lead",
  },
];

describe("ProjectTeamPreview", () => {
  it("renders roles in stable order with readable Spanish access boundaries", () => {
    const { container } = render(
      <ProjectTeamPreview team={team} language="es" title="Equipo propuesto" />,
    );
    expect(screen.getByRole("region", { name: "Equipo propuesto" })).toBeInTheDocument();
    const names = [...container.querySelectorAll("h3")].map((node) => node.textContent);
    expect(names).toEqual(["Líder", "Revisor"]);
    expect(screen.getAllByText("Acceso al conocimiento")).toHaveLength(2);
    expect(screen.getAllByText(/este proyecto/)).toHaveLength(2);
    expect(screen.getAllByText(/publicar o hacer cambios externos/)).toHaveLength(2);
  });
});
