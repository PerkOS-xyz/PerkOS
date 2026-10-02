import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  retry: vi.fn(), replace: vi.fn(),
  session: { status: "error", error: "Signature rejected." },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("../app/components/AccessGate", () => ({ AccessGate: () => null }));
vi.mock("../app/lib/useWalletSession", () => ({ useWalletSession: () => ({ ...mocks.session, retry: mocks.retry }) }));
vi.mock("../app/lib/accountOnboarding", () => ({ readAccountProfile: vi.fn() }));
vi.mock("../app/lib/i18n", () => ({ default: {}, isSupportedLanguage: vi.fn(), persistLanguagePreference: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => ({
  "signIn.failed": "Sign-in failed. Retry when you are ready.",
  "signIn.retry": "Retry sign-in",
}[key] ?? key) }) }));
import ContinuePage from "../app/continue/page";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("offers explicit retry without claiming or starting automatic retries", () => {
  const view = render(<ContinuePage />);
  expect(screen.getByText("Sign-in failed. Retry when you are ready.")).toBeTruthy();
  expect(screen.queryByText(/Retrying/)).toBeNull();
  view.rerender(<ContinuePage />);
  expect(mocks.retry).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Retry sign-in" }));
  expect(mocks.retry).toHaveBeenCalledOnce();
  expect(mocks.replace).not.toHaveBeenCalled();
});
