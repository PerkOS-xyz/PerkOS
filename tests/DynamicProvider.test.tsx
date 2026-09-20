import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DynamicOuter } from "../app/components/DynamicProvider";

vi.mock("@dynamic-labs/sdk-react-core", () => ({
  DynamicContextProvider: ({ children, settings, theme }: {
    children: ReactNode; settings: Record<string, unknown>; theme: string;
  }) => <div data-testid="dynamic-provider" data-settings={JSON.stringify(settings)} data-theme={theme}>{children}</div>,
}));
vi.mock("@dynamic-labs/ethereum", () => ({ EthereumWalletConnectors: [] }));
vi.mock("../app/lib/dynamicBrowser", () => ({ DYNAMIC_ENVIRONMENT_ID: "test-environment" }));

describe("PerkOS Dynamic branding", () => {
  it("uses public HTTPS branding and privacy URLs without changing authentication", () => {
    render(<DynamicOuter><span>PerkOS content</span></DynamicOuter>);
    const provider = screen.getByTestId("dynamic-provider");
    const settings = JSON.parse(provider.getAttribute("data-settings")!);
    expect(settings).toMatchObject({
      appName: "PerkOS",
      appLogoUrl: "https://perkos.xyz/perkos-landing-logo.png",
      privacyPolicyUrl: "https://perkos.xyz/privacy",
      initialAuthenticationMode: "connect-only",
      environmentId: "test-environment",
    });
    expect(settings.termsOfServiceUrl).toBeUndefined();
    expect(provider).toHaveAttribute("data-theme", "dark");
    expect(screen.getByText("PerkOS content")).toBeInTheDocument();
  });
});
