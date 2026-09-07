import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ProjectTemplateWizard } from "../app/components/ProjectTemplateWizard";
import { ProjectTemplateConfiguration } from "../app/components/ProjectTemplateConfiguration";
const mock = vi.hoisted(() => ({
  wallet: "creator-one",
  fetch: vi.fn(),
  push: vi.fn(),
}));
vi.mock("../app/lib/useAppAccount", () => ({
  useAppAccount: () => ({ address: mock.wallet }),
}));
vi.mock("../app/lib/useActiveOrg", () => ({
  useActiveOrg: () => ({ activeOrgId: "my-org" }),
}));
vi.mock("../app/lib/apiClient", () => ({ authedFetch: mock.fetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mock.push }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "es" } }),
}));
const published = {
  revision: 3,
  activation: "configuration-only",
  template: {
    id: "artizen",
    name: { es: "Actualizaciones Artizen", en: "Artizen updates" },
    description: { es: "Borradores", en: "Drafts" },
    steps: [
      {
        id: "project",
        title: { es: "Tu proyecto", en: "Your project" },
        questions: [
          {
            id: "project-name",
            label: { es: "Nombre", en: "Name" },
            required: true,
            type: "text",
            maxLength: 80,
            options: [],
          },
          {
            id: "artizen-url",
            label: { es: "URL Artizen", en: "Artizen URL" },
            required: true,
            type: "url",
            maxLength: 500,
            options: [],
          },
          {
            id: "content-language",
            label: { es: "Idioma del contenido", en: "Content language" },
            required: true,
            type: "select",
            maxLength: 10,
            options: [
              { value: "en", label: { es: "Inglés", en: "English" } },
              { value: "es", label: { es: "Español", en: "Spanish" } },
            ],
          },
        ],
      },
    ],
  },
};
beforeEach(() => {
  cleanup();
  mock.wallet = "creator-one";
  mock.push.mockReset();
  mock.fetch
    .mockReset()
    .mockImplementation(
      async (_path, init) =>
        new Response(
          JSON.stringify(
            init?.method === "POST"
              ? { projectId: "template-result" }
              : published,
          ),
          { status: 200 },
        ),
    );
});
async function review() {
  fireEvent.change(await screen.findByLabelText("Nombre"), {
    target: { value: "My project" },
  });
  fireEvent.change(screen.getByLabelText("URL Artizen"), {
    target: { value: "https://artizen.fund/index/p/example" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  await screen.findByText("Revisar configuración");
}
describe("project template wizard", () => {
  it("localizes reviewed options while preserving canonical answers across form languages", async () => {
    render(<ProjectTemplateWizard templateId="artizen" />);
    await screen.findByLabelText("Nombre");
    fireEvent.change(screen.getByLabelText("Idioma del contenido"), {
      target: { value: "en" },
    });
    await review();
    expect(screen.getByText("Inglés")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Idioma del formulario"), {
      target: { value: "en" },
    });
    expect(screen.getByText("English", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("My project")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create configured project" }));
    await waitFor(() => expect(mock.fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(mock.fetch.mock.calls[1][1].body).answers["content-language"]).toBe("en");
  });

  it("uses snapshot option labels for the persisted project configuration", async () => {
    mock.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      template: published.template,
      revision: 3,
      answers: { "project-name": "Saved project", "content-language": "en" },
    })));
    render(<ProjectTemplateConfiguration projectId="template-saved" />);
    expect(await screen.findByText("Inglés")).toBeInTheDocument();
    expect(screen.getByText("Saved project")).toBeInTheDocument();
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  });

  it("requires review and creates only a versioned configured project", async () => {
    render(<ProjectTemplateWizard templateId="artizen" />);
    await review();
    expect(mock.fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Crear proyecto configurado" }),
    );
    await screen.findByText("Configuración guardada");
    const [path, init] = mock.fetch.mock.calls[1];
    expect(path).toBe("/project-templates/artizen/projects");
    expect(JSON.parse(init.body)).toMatchObject({
      revision: 3,
      orgId: "my-org",
      answers: { "project-name": "My project", "content-language": "es" },
    });
    expect(mock.push).not.toHaveBeenCalled();
    expect(screen.getByText(/no se creará ni activará/)).toBeInTheDocument();
  });
  it("keeps answers and the idempotency key when the create response is lost", async () => {
    render(<ProjectTemplateWizard templateId="artizen" />);
    await review();
    mock.fetch.mockRejectedValueOnce(Error("network"));
    fireEvent.click(
      screen.getByRole("button", { name: "Crear proyecto configurado" }),
    );
    await screen.findByRole("alert");
    expect(screen.getByText("My project")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Crear proyecto configurado" }),
    );
    await screen.findByText("Configuración guardada");
    expect(mock.fetch.mock.calls[1][1].body).toBe(
      mock.fetch.mock.calls[2][1].body,
    );
  });
  it("isolates unsaved answers when the account changes", async () => {
    const view = render(<ProjectTemplateWizard templateId="artizen" />);
    fireEvent.change(await screen.findByLabelText("Nombre"), {
      target: { value: "Private draft" },
    });
    mock.wallet = "creator-two";
    view.rerender(<ProjectTemplateWizard templateId="artizen" />);
    await waitFor(() =>
      expect(screen.getByLabelText("Nombre")).toHaveValue(""),
    );
  });
  it("does not render a form or create anything when the template cannot load", async () => {
    mock.fetch.mockResolvedValue(new Response("", { status: 404 }));
    render(<ProjectTemplateWizard templateId="unknown" />);
    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: "Crear proyecto configurado" }),
    ).not.toBeInTheDocument();
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
});
