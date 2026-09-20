# PerkOS branding inside the Dynamic login modal

The user approved implementing the documented custom-CSS approach after research
with Dynamic's public MCP. This follows the production login migration in PR367.

Use `settings.cssOverrides` with the existing Shadow DOM, existing HTTPS logo and
brand colors. Display a decorative logo only on email/wallet and wallet-only entry
views. Add PerkOS to the real heading through the SDK's supported `locale` override
so the name remains accessible without images. Preserve the current SDK language;
this is a brand-copy change, not a full translation of Dynamic's security flows.

Alternatives considered: metadata alone does not render a logo on this screen;
DOM insertion with MutationObserver is documented but increases lifecycle coupling;
headless SDK migration would require rebuilding auth. Scoped CSS is the smallest
change and is now explicitly authorized, superseding the earlier metadata-only plan.

Do not change authentication mode, environment, connectors, chains, security views,
privacy links, allowlist, delegations, or API behavior. No CSS that hides controls
or security notices. Keep decorative content non-interactive, constrain width for
mobile, and retain the existing SDK layout and focus handling.

Verify provider props, scope of styles, types/lint, and the real SDK modal in a
local browser on desktop and mobile sizes. Check close/reopen and the next wallet
selection screen, without signing messages/transactions or creating delegations.
Recheck the pinned SDK's view selectors on any SDK upgrade. Production rollout
is separate and follows merge; no changes to QA/Dev or Stack.

## Visual acceptance

- Actual Dynamic SDK modal checked locally at 1280×720, 390×844 and 320×568.
- Horizontal PerkOS wordmark, Poppins typography, dark-purple surfaces and restrained
  pink accents. The real heading names PerkOS independently of the image.
- Small-height screens use a smaller logo/header and a scrollable entry accordion;
  verified that Privacy Policy and the provider footer remain reachable at 320×568.
- Close/reopen and full wallet list/back navigation verified. Secondary wallet list
  does not get the decorative entry logo. No authentication/signature was performed.
- TypeScript and changed-file ESLint passed. Existing full suite passed 630 tests
  with 3 skipped using two workers. Local UI was served with default Turbopack;
  webpack dev has an existing Wagmi/tempo export mismatch, outside this CSS change.
- Full SDK localization and authenticated production E2E remain separate follow-ups.

References:
- https://www.dynamic.xyz/docs/react/using-our-ui/design-customizations/css/custom-css
- https://www.dynamic.xyz/docs/react/using-our-ui/design-customizations/css/css-variables
- https://www.dynamic.xyz/docs/react/using-our-ui/design-customizations/customizing-copy-translations
