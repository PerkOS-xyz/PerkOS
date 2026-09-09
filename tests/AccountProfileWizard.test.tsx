import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { AccountProfileWizard } from "../app/components/AccountProfileWizard";
import { emptyAccountProfile } from "../app/lib/accountOnboarding";
import { accountCopy } from "../app/lib/accountOnboardingCopy";
const mock = vi.hoisted(() => ({
  wallet: "first",
  read: vi.fn(),
  save: vi.fn(),
  push: vi.fn(),
}));
vi.mock("../app/lib/useAppAccount", () => ({
  useAppAccount: () => ({ address: mock.wallet }),
}));
vi.mock("../app/lib/accountOnboarding", async (original) => ({
  ...(await original<object>()),
  readAccountProfile: mock.read,
  saveAccountProfile: mock.save,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mock.push }) }));
vi.mock("../app/components/UsernameCard", () => ({
  UsernameCard: () => <span>Username control</span>,
}));
vi.mock("../app/lib/i18n", () => ({
  SUPPORTED_LANGUAGES: [
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
  ],
  persistLanguagePreference: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "es", changeLanguage: async () => {} },
  }),
}));
beforeEach(() => {
  cleanup();
  mock.wallet = "first";
  mock.read
    .mockReset()
    .mockResolvedValue({ account: null, suggestedDisplayName: "" });
  mock.save
    .mockReset()
    .mockImplementation(async (p) => ({ ...p, revision: p.revision + 1 }));
  mock.push.mockReset();
});
describe("account setup", () => {
  it("walks through a profile without project or agent creation", async () => {
    render(<AccountProfileWizard />);
    fireEvent.change(await screen.findByLabelText("Nombre visible"), {
      target: { value: "Creator" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByLabelText("Zona horaria");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText(/Solo enlaces/);
    fireEvent.click(
      screen.getByRole("button", { name: "Finalizar configuración" }),
    );
    await waitFor(() => expect(mock.push).toHaveBeenCalledWith("/dashboard"));
    expect(mock.save).toHaveBeenCalledTimes(3);
    expect(mock.save.mock.calls[2][0]).toMatchObject({
      completed: true,
      displayName: "Creator",
    });
  });
  it("does not overwrite a failed profile load or navigate after failed save", async () => {
    mock.read.mockRejectedValue(Error());
    render(<AccountProfileWizard />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo cargar",
    );
    expect(mock.save).not.toHaveBeenCalled();
    expect(mock.push).not.toHaveBeenCalled();
  });
  it("resumes the saved step", async () => {
    mock.read.mockResolvedValue({
      account: {
        ...emptyAccountProfile("es", "UTC"),
        displayName: "Creator",
        step: 2,
      },
    });
    render(<AccountProfileWizard />);
    await screen.findByText(/Solo enlaces/);
    expect(screen.queryByLabelText("Nombre visible")).toBeNull();
  });
  it("discards another wallet's unsaved profile", async () => {
    const view = render(<AccountProfileWizard />);
    fireEvent.change(await screen.findByLabelText("Nombre visible"), {
      target: { value: "Private name" },
    });
    mock.wallet = "second";
    view.rerender(<AccountProfileWizard />);
    await waitFor(() =>
      expect(screen.getByLabelText("Nombre visible")).toHaveValue(""),
    );
  });
  it("has complete copy in every supported resource language", () => {
    const base = Object.keys(accountCopy("en"));
    for (const lang of ["es", "fr", "pt", "ja", "ko", "it", "zh"]) {
      expect(Object.keys(accountCopy(lang))).toEqual(base);
      expect(Object.values(accountCopy(lang)).every(Boolean)).toBe(true);
    }
  });
});
