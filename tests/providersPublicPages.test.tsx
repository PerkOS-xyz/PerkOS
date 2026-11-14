import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

const dynamicProvidersLoaded = vi.fn();
vi.mock("../app/components/DynamicProviders", () => {
  dynamicProvidersLoaded();
  return { default: () => null };
});

vi.mock("next/dynamic", () => ({
  default: () =>
    function DynamicTree({ children }: { children: ReactNode }) {
      return <div data-testid="dynamic-tree">{children}</div>;
    },
}));

vi.mock("wagmi", () => ({
  WagmiProvider: ({ children }: { children: ReactNode }) => <div data-testid="wagmi-tree">{children}</div>,
}));

vi.mock("../app/lib/wagmi", () => ({ wagmiConfig: {} }));
vi.mock("../app/lib/firebase", () => ({ prepareFirestore: () => undefined }));
vi.mock("../app/lib/useIsInMiniApp", () => ({ useIsInMiniApp: () => false }));
vi.mock("../app/lib/dynamicBrowser", () => ({ dynamicBrowserEnabled: () => true }));
vi.mock("../app/components/AutoConnect", () => ({ AutoConnect: () => null }));
vi.mock("../app/lib/onboardingState", () => ({
  OnboardingProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));

import { Providers } from "../app/providers";

describe("Providers on public pages", () => {
  beforeEach(() => {
    pathname = "/";
  });

  it.each(["/", "/pricing", "/solutions/restaurants"])("renders %s without the wallet SDK", (path) => {
    pathname = path;

    render(<Providers><span>page</span></Providers>);

    expect(screen.queryByTestId("dynamic-tree")).not.toBeInTheDocument();
    expect(screen.getByTestId("wagmi-tree")).toHaveTextContent("page");
  });

  it.each(["/sign-in", "/dashboard", "/continue"])("keeps the wallet SDK on %s", (path) => {
    pathname = path;

    render(<Providers><span>page</span></Providers>);

    expect(screen.getByTestId("dynamic-tree")).toHaveTextContent("page");
  });

  it("starts loading the wallet SDK when a visitor points at a sign-in link", async () => {
    pathname = "/";
    render(
      <Providers>
        <a href="/sign-in">Start free</a>
        <a href="/pricing">Pricing</a>
      </Providers>,
    );

    screen.getByText("Pricing").dispatchEvent(new Event("pointerover", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dynamicProvidersLoaded).not.toHaveBeenCalled();

    screen.getByText("Start free").dispatchEvent(new Event("pointerover", { bubbles: true }));
    await vi.waitFor(() => expect(dynamicProvidersLoaded).toHaveBeenCalled());
  });
});
