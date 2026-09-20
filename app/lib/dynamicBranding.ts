import type { LocaleResource } from "@dynamic-labs/sdk-react-core";

export const PERKOS_WALLET_LOGO = "https://perkos.xyz/perkos-landing-logo.png";
export const PERKOS_WALLET_WORDMARK = "https://perkos.xyz/perkos-header.png";

// Dynamic injects this through its supported cssOverrides API, inside Shadow DOM.
// Keep the logo limited to entry views: never decorate OTP, signing, recovery,
// transaction confirmation, or security prompts. Recheck selectors on SDK upgrades.
export const PERKOS_WALLET_STYLES = `
  .dynamic-shadow-dom-content {
    --dynamic-font-family-primary: var(--font-poppins), system-ui, sans-serif;
    --dynamic-base-1: #130c1d;
    --dynamic-base-2: #1b1227;
    --dynamic-text-primary: #faf7fc;
    --dynamic-text-secondary: #bab0c9;
    --dynamic-brand-primary-color: #d91660;
    --dynamic-brand-hover-color: #cc1559;
    --dynamic-brand-secondary-color: rgba(236, 27, 105, 0.14);
    --dynamic-border-radius: 16px;
    --dynamic-modal-border: 1px solid rgba(236, 27, 105, 0.25);
    --dynamic-modal-width: min(25rem, calc(100vw - 2rem));
    --dynamic-modal-padding: 1.25rem;
    --dynamic-wallet-list-tile-background: #1b1227;
    --dynamic-wallet-list-tile-border: 1px solid #33253f;
    --dynamic-wallet-list-tile-background-hover: #241a32;
    --dynamic-wallet-list-tile-border-hover: 1px solid #80536c;
  }

  :is(
    [data-dynamic-view="login-with-email-or-wallet"],
    [data-dynamic-view="login-with-wallet-only"]
  ) .layout-header__typography::before {
    content: "";
    display: block;
    width: min(10rem, 100%);
    height: 3rem;
    margin: 0 auto 1rem;
    background: url("${PERKOS_WALLET_WORDMARK}") center / contain no-repeat;
    pointer-events: none;
  }

  :is(
    [data-dynamic-view="login-with-email-or-wallet"],
    [data-dynamic-view="login-with-wallet-only"]
  ) .layout-header__typography {
    overflow-wrap: anywhere;
  }

  :is(
    [data-dynamic-view="login-with-email-or-wallet"],
    [data-dynamic-view="login-with-wallet-only"]
  ) .accordion-item--full-height {
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  @media (max-height: 650px) {
    :is(
      [data-dynamic-view="login-with-email-or-wallet"],
      [data-dynamic-view="login-with-wallet-only"]
    ) .layout-header__typography::before {
      height: 2rem;
      margin-bottom: 0.5rem;
    }

    :is(
      [data-dynamic-view="login-with-email-or-wallet"],
      [data-dynamic-view="login-with-wallet-only"]
    ) .modal-header {
      padding-top: 1rem;
      padding-bottom: 1rem;
    }
  }

  @media (max-width: 400px) {
    .dynamic-shadow-dom-content {
      --dynamic-modal-padding: 1rem;
    }
  }
`;

// The CSS image is decorative. The real heading retains the accessible brand
// even when images are blocked. Other SDK copy and security messages stay intact.
export const PERKOS_WALLET_LOCALE: LocaleResource = {
  en: {
    dyn_login: {
      title: {
        all: "Sign in to PerkOS",
        wallet_only: "Connect to PerkOS",
      },
    },
  },
};
