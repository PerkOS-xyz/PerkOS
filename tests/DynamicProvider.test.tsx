import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DynamicOuter } from "../app/components/DynamicProvider";
import { PERKOS_WALLET_STYLES } from "../app/lib/dynamicBranding";

vi.mock("@dynamic-labs/sdk-react-core", () => ({
  DynamicContextProvider: ({ children, settings, theme, locale }: {
    children: ReactNode; settings: Record<string, unknown>; theme: string; locale: unknown;
  }) => <div data-testid="dynamic-provider" data-settings={JSON.stringify(settings)} data-theme={theme} data-locale={JSON.stringify(locale)}>{children}</div>,
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
    expect(settings.shadowDOMEnabled).not.toBe(false);
    expect(settings.cssOverrides).toBe(PERKOS_WALLET_STYLES);
    expect(settings.overrides.evmNetworks.map((network: { chainId: number }) => network.chainId)).toEqual([8453, 42220, 4663, 84532]);
    expect(JSON.parse(provider.getAttribute("data-locale")!)).toEqual({
      en: { dyn_login: { title: { all: "Sign in to PerkOS", wallet_only: "Connect to PerkOS" } } },
    });
    expect(provider).toHaveAttribute("data-theme", "dark");
    expect(screen.getByText("PerkOS content")).toBeInTheDocument();
  });

  it("limits the decorative logo to login entry screens without hiding controls", () => {
    expect(PERKOS_WALLET_STYLES).toContain('[data-dynamic-view="login-with-email-or-wallet"]');
    expect(PERKOS_WALLET_STYLES).toContain('[data-dynamic-view="login-with-wallet-only"]');
    expect(PERKOS_WALLET_STYLES).toContain('.layout-header__typography::before');
    expect(PERKOS_WALLET_STYLES).toContain('content: ""');
    expect(PERKOS_WALLET_STYLES).toContain('pointer-events: none');
    expect(PERKOS_WALLET_STYLES).toContain('calc(100vw - 2rem)');
    expect(PERKOS_WALLET_STYLES).toContain('.accordion-item--full-height');
    expect(PERKOS_WALLET_STYLES).toContain('overflow-y: auto');
    expect(PERKOS_WALLET_STYLES).toContain('@media (max-height: 650px)');
    expect(PERKOS_WALLET_STYLES).not.toMatch(/display:\s*none|visibility:\s*hidden|position:\s*(fixed|absolute)|MutationObserver/);
  });
});
