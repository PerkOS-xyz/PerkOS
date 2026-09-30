import { beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OnboardingProvider, useOnboarding } from "../app/lib/onboardingState";
import { usernameCopy } from "../app/lib/usernameCopy";
const account = vi.hoisted(() => ({ address: "0xABABABABABABABABABABABABABABABABABABABAB" }));
vi.mock("../app/lib/useAppAccount", () => ({ useAppAccount: () => account }));
function Consumer() {
  const state = useOnboarding();
  return (
    <>
      <p data-testid="workspace">{state.workspaceName}</p>
      <button onClick={() => state.setWorkspaceName("Private")}>
        Save hint
      </button>
    </>
  );
}
beforeEach(() => {
  cleanup();
  localStorage.clear();
  account.address = "0xABABABABABABABABABABABABABABABABABABABAB";
});
it("scopes optional workspace hints to the connected account and never adopts the legacy key", () => {
  localStorage.setItem(
    "perkos.onboarding",
    JSON.stringify({ workspaceName: "Legacy" }),
  );
  const view = render(
    <OnboardingProvider>
      <Consumer />
    </OnboardingProvider>,
  );
  expect(screen.getByTestId("workspace")).toHaveTextContent("");
  fireEvent.click(screen.getByText("Save hint"));
  expect(screen.getByTestId("workspace")).toHaveTextContent("Private");
  account.address = "0xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd";
  view.rerender(
    <OnboardingProvider>
      <Consumer />
    </OnboardingProvider>,
  );
  expect(screen.getByTestId("workspace")).toHaveTextContent("");
  account.address = "0xabababababababababababababababababababab";
  view.rerender(
    <OnboardingProvider>
      <Consumer />
    </OnboardingProvider>,
  );
  expect(screen.getByTestId("workspace")).toHaveTextContent("Private");
});
it("does not share workspace hints between Solana case variants, including reload", () => {
  const wallet = "So11111111111111111111111111111111111111112";
  account.address = wallet;
  const view = render(<OnboardingProvider><Consumer /></OnboardingProvider>);
  fireEvent.click(screen.getByText("Save hint"));
  account.address = wallet.toLowerCase();
  view.rerender(<OnboardingProvider><Consumer /></OnboardingProvider>);
  expect(screen.getByTestId("workspace").textContent).toBe("");
  view.unmount();
  account.address = wallet;
  render(<OnboardingProvider><Consumer /></OnboardingProvider>);
  expect(screen.getByTestId("workspace")).toHaveTextContent("Private");
});

it("provides username messages for every supported account language", () => {
  for (const lang of ["en", "es", "fr", "pt", "it", "ja", "ko", "zh"])
    expect(
      Object.values(usernameCopy(lang)).every(
        (value) => typeof value === "string" && value.length > 0,
      ),
    ).toBe(true);
  expect(usernameCopy("es-MX").claim).toBe("Reservar");
});
