# PerkOS Mini-App i18n Delivery Plan

Client-side internationalization for the Next.js 16 mini-app. No URL/`[locale]`
routing, no middleware, no Docker/build-arg changes. Ships as one foundation PR
plus two phased follow-ups.

Stack: `react-i18next` + `i18next` + `i18next-browser-languagedetector`.
Languages: `en` (default/fallback), `es`, `it`, `fr`, `ko`, `zh`, `ja`.
Detection order: `localStorage` then `navigator`, fallback `en`. Persist to `localStorage`.
Selector visible only in a regular browser (`useIsInMiniApp() === false`).

Grounding facts from the audit:
- Next 16.2.6 / React 19.2.4. No existing i18n framework (the `locale` hits in
  the tree are date/number formatting, not a library).
- Root layout `app/layout.tsx` is a Server Component: `<html lang="en" ...
  suppressHydrationWarning>` with `<body suppressHydrationWarning>`. Metadata/OG
  are declared here and are server-rendered.
- Providers compose in `app/providers.tsx` and have TWO return branches
  (Dynamic-browser vs plain wagmi). The i18n provider must wrap BOTH.
- App shell + header + `NAV_ITEMS` live in `app/(app)/layout.tsx` (client).
- `@/*` in tsconfig maps to the repo root, so `@/components/ui/*` and
  `@/lib/utils` are the shadcn primitives. App code uses RELATIVE imports
  (`../lib/...`, `../components/...`). New i18n code follows the app-local
  convention under `app/i18n/`.
- Fonts: Poppins loaded with `subsets: ["latin"]` only (no CJK glyphs).

---

## 1. Scope of the first PR (the foundation)

Goal: land the full i18n plumbing plus a small, high-traffic pilot so switching
languages is real and demonstrable, without touching the 40+ heavy screens.

### New files (created)

Config + runtime
- `app/i18n/config.ts` — `SUPPORTED_LOCALES` (the 7 codes + English display
  labels/native names), `DEFAULT_LOCALE = "en"`, `FALLBACK_LOCALE = "en"`,
  `NAMESPACES` list, `STORAGE_KEY = "perkos.lang"`. Pure constants, no React.
- `app/i18n/i18n.ts` — creates and configures the i18next instance:
  `.use(LanguageDetector).use(initReactI18next).init({ resources, fallbackLng:
  "en", supportedLngs, defaultNS: "common", ns: NAMESPACES, interpolation:
  { escapeValue: false }, detection: { order: ["localStorage","navigator"],
  caches: ["localStorage"], lookupLocalStorage: STORAGE_KEY }, react:
  { useSuspense: false } })`. `resources` is the statically imported catalog map
  (all 7 langs bundled; no async chunking in v1). Export the instance.
  IMPORTANT for hydration: init with `lng: "en"` (do NOT let the detector pick
  the language at module-init time). Detection is applied post-mount in the
  provider effect. See Risks section.
- `app/i18n/I18nProvider.tsx` — `"use client"`. Wraps children in
  `<I18nextProvider i18n={i18n}>`. On mount (useEffect): read detected language
  (`localStorage[STORAGE_KEY]` then `navigator.language` narrowed to a supported
  code), call `i18n.changeLanguage(detected)`, and set
  `document.documentElement.lang = i18n.language`. Subscribe to i18next
  `languageChanged` to keep `document.documentElement.lang` in sync. This is the
  single mount point that flips SSR-`en` to the user's language and keeps `<html
  lang>` correct for a11y/SEO.
- `app/i18n/useT.ts` (optional thin wrapper) — re-export `useTranslation` typed
  against the namespace union, so screens do `const { t } = useT("dashboard")`.

Message catalogs (all 7 created, structure-complete, partially filled)
- `app/i18n/locales/en/common.json`
- `app/i18n/locales/en/auth.json`
- `app/i18n/locales/en/onboarding.json`
- `app/i18n/locales/en/dashboard.json`
- ...and the same four files under `es/ it/ fr/ ko/ zh/ ja/`.
  Total for PR1: 7 langs x 4 namespaces = 28 JSON files. `en/*` is the source of
  truth and 100% filled; the other 6 langs ship machine-translated for the pilot
  keys and simply OMIT anything not yet translated (omission = automatic English
  fallback, see Section 3).

Header selector
- `app/components/LanguageSelector.tsx` — `"use client"`. Renders a compact
  `Popover` (reuse `@/components/ui/popover`) or `DropdownMenu` listing the 7
  native names; on select calls `i18n.changeLanguage(code)` (the detector's
  `localStorage` cache persists automatically). Browser-gated:
  `const inMiniApp = useIsInMiniApp(); if (inMiniApp !== false) return null;`
  (renders nothing while `null` and inside any Mini App host, exactly like the
  logout affordance). Globe icon from `lucide-react` to match the header style.

### Files edited (integration points, described only, not modified here)

- `app/providers.tsx` — wrap the children of BOTH return branches in
  `<I18nProvider>`. Placing it just inside `QueryClientProvider` (and inside
  `DynamicProviders`) keeps it above every `"use client"` screen. It is
  host-agnostic (i18n runs in Mini App hosts too; only the selector is gated).
- `app/(app)/layout.tsx` — mount `<LanguageSelector />` in the desktop header
  cluster next to `<UserMenu />` (line ~140) and in the mobile menu sheet; drive
  `NAV_ITEMS` labels through `t("common:nav.*")` (dashboard, projects, tasks,
  agents, chat, organization, wallet, settings) plus the visible strings ("Log
  out", "Skip to main content", "Search projects, agents, commands...",
  SessionSplash labels).
- `app/(auth)/sign-in/page.tsx` — the ~10 strings ("Sign in with email", "Sign
  in with wallet", "Continue as ...", "Signing you in...", "Use a different
  account", "Restoring your session...", "Connecting your wallet...", "Retry
  sign-in", "Loading..."). Excellent low-risk pilot.
- `app/onboarding/welcome/page.tsx` + `app/components/OnboardingShell.tsx` —
  welcome title/description, STAT labels/suffixes, the closing paragraph, and the
  shell's "Back" / "Next" / "N of M" chrome (the shell is shared by all four
  onboarding steps, so translating it once immediately benefits Phase 2).
- `app/(app)/dashboard/page.tsx` — the static chrome only for PR1 (page
  title/subtitle, `QUICK_ACTIONS` labels, section headings, empty-state copy).
  Dynamic/data-bound strings on the dashboard can trail into Phase 2 if they get
  heavy; keep PR1 to the visible frame.

### Recommended pilot set (agreed)

App shell / nav labels + sign-in + onboarding welcome (+ shared OnboardingShell
chrome) + dashboard chrome. This is roughly 120-160 strings, hits the surfaces
every user sees first, and proves the switch end to end. `settings` is a strong
optional add if time allows (it is small and is where a power user expects a
language control to also live).

### Dependencies to add (package.json)

`i18next`, `react-i18next`, `i18next-browser-languagedetector` (runtime deps).
No dev-time codegen is required for PR1; a parser/linter is proposed for later
(Section 3). No build-arg, Dockerfile, or compose change (client-only).

---

## 2. Phasing the remaining extraction

English is the source-of-truth surface; every unextracted string keeps rendering
in English until translated, so phases are safe to interleave and ship
incrementally behind the already-live foundation.

### Phase 2 — the product surface users operate in (high priority)

Heavy, data-dense authenticated screens. Add namespaces as needed
(`projects`, `agents`, `tasks`, `chat`, `wizard`, `settings`, `organizations`,
`companies`).

- `app/(app)/projects/[projectId]/page.tsx` (70 KB, the single biggest surface)
  and `projects/`, `projects/new`, `projects/[projectId]/tasks/[taskId]`.
- `app/(app)/agents/[agentId]/page.tsx` (28 KB), `agents/`, `agents/new` and the
  7-step wizard: `app/(app)/agents/new/wizard/steps/*` (StepMethod, StepTemplate,
  StepCapabilities, StepChannels, StepLLM, StepReview, StepExternal) plus
  `wizard/ui/*`.
- `app/(app)/companies/new/page.tsx` (31 KB).
- `app/(app)/dashboard/page.tsx` remaining dynamic strings; `tasks/*`, `chat/*`,
  `settings`, `organizations/*`, `wallet`, `notifications`.
- Shared components with copy: `EmptyState`, `KanbanBoard`, `CommandMenu`,
  `NotificationsBell`, dialogs (`EditAgent/Project/Task`, `ConfirmDialog`),
  `ProvisionPipeline`, `MembersPanel`, `BillingCard`, `DepositDialog`, etc.
- Remaining onboarding steps: `onboarding/{workspace,project,agent}/page.tsx`.

Rough effort: this is the bulk, roughly 2,000 to 3,000 strings across ~45 files.
Estimate 4 to 6 engineer-days of extraction plus a machine-translation pass.
Split into sub-PRs by namespace (one PR per major screen family) so review stays
tractable and nothing blocks on a giant diff.

### Phase 3 — marketing / deck / investors (low priority, English-first audience)

- `app/page.tsx` (38 KB landing), `app/deck/page.tsx`,
  `app/presentation/page.tsx`, `app/investors/page.tsx`, `app/artizen/page.tsx`,
  `sign-up`, `continue`.
- These target an English-speaking / investor audience and the canonical SEO
  domain is English, so they can remain English indefinitely or be translated
  last. If localized later, treat the landing as its own namespace (`landing`).

Rough effort: ~2 to 3 days if pursued; otherwise deferred with no user impact.

Ordering rule: never let Phase 2/3 block the foundation. PR1 ships the machinery;
subsequent PRs only add keys + `t()` calls, which cannot regress untranslated
screens (they stay English).

---

## 3. Translation sourcing and catalog hygiene

### v1 machine translation

- Use DeepL for `es, it, fr, ja, zh, ko` (best quality on the European set and
  strong on JA/ZH/KO). Where a target or phrase is weak, fall back to Google
  Translate. Translate from the `en/*.json` values.
- Keep a tiny repeatable script in `scripts/` (Node, run locally, not in CI) that
  reads `en/<ns>.json`, calls the MT API, and writes `<lang>/<ns>.json` preserving
  key structure. It stays out of the runtime bundle and out of Docker.

### Marking untranslated keys

- Fallback to English is automatic (`fallbackLng: "en"`, and English is the
  source namespace). The convention for "not yet translated" is therefore simply:
  OMIT the key from the target-language file. A missing key resolves up to `en`.
  This keeps target catalogs small and makes "what still needs a human" trivially
  visible as a key-count delta.
- Track human-review status OUT of band in `app/i18n/locales/STATUS.md` (a small
  table: namespace x language = machine | reviewed). Do not add `_meta`/status
  keys inside the JSON, because they would pollute the key space and the parser.

### Keeping 7 catalogs in sync as strings are added

- Key naming: `namespace:section.key`, lowerCamelCase keys, dot nesting for
  grouping. Examples: `common:nav.dashboard`, `common:actions.save`,
  `auth:signIn.emailButton`, `onboarding:welcome.title`,
  `dashboard:quickActions.newProject`. Interpolation uses named vars:
  `"greeting": "Welcome, {{name}}"`. Pluralize with i18next suffixes
  (`_one`/`_other`) rather than string concatenation.
- Namespaces mirror screen families (`common`, `auth`, `onboarding`,
  `dashboard`, then `projects`, `agents`, `wizard`, `tasks`, `chat`, `settings`,
  `organizations`, `companies`, `landing`). One file per `<lang>/<ns>.json`.
- `en/*` is the single source of truth. Add a key to `en` first, then to any
  languages you have a translation for; others fall back automatically.
- Add `i18next-parser` (dev-only, later) with a config that extracts `t()` calls
  into the `en` catalogs and flags orphaned keys, plus a lightweight CI check /
  `npm run i18n:check` that fails if any target file contains a key ABSENT from
  `en` (drift in the wrong direction). Missing target keys are allowed by design
  (fallback), extra target keys are the bug to catch.

---

## 4. Risks and how to handle them

- Hydration mismatch / flash-of-English (FOUE). Root `<html>` is server-rendered
  `en`. If the detector chose the language at i18next `init` time, the first
  CLIENT render could already be `es`/`ja` and mismatch the server's `en` markup,
  producing a hydration error. Mitigation: init i18next with `lng: "en"` (detector
  configured but NOT applied at init) so server and first client render agree,
  then call `i18n.changeLanguage(detected)` in the `I18nProvider` mount effect.
  Non-English users see a brief English flash on first paint before the effect
  runs. This is the accepted tradeoff for client-only i18n with no locale routing.
  `<html>`/`<body>` already carry `suppressHydrationWarning`, which also covers
  the post-mount `document.documentElement.lang` update. If the flash is deemed
  unacceptable for the pilot screens, an optional guard is to render the pilot
  subtree only after `mounted` is true; do NOT blank the whole app.
- SEO / OG metadata stays English. `metadata` in `app/layout.tsx` is
  server-rendered and cannot read client i18next; it stays English in v1. This is
  intentional: the canonical SEO domain (`perkos.xyz`) is English and there is no
  `[locale]` routing to key metadata off. Per-locale metadata would require a
  server-side locale source (cookie/Accept-Language in `generateMetadata`), which
  is explicitly out of scope. Document as a known limitation.
- CJK font rendering. Poppins is `latin`-only, so `ko/zh/ja` fall through the
  `--font-sans` stack to `system-ui, sans-serif`, i.e. the OS default CJK font
  (Apple/Segoe/Noto depending on platform). This renders correctly everywhere and
  adds zero bundle weight. Do NOT pull `Noto Sans CJK` via `next/font` in v1 (it
  is multi-megabyte per weight). If brand consistency for CJK becomes a
  requirement, add a scoped CJK fallback stack later, not in the foundation PR.
- Key drift. Handled by the `en`-is-truth rule plus the proposed
  `npm run i18n:check` (extra/typo keys in target files fail; missing keys are
  allowed and fall back). Until the parser lands, PR review enforces "add to `en`
  first."
- Not breaking Mini App hosts. i18n runs everywhere, but the SELECTOR is gated on
  `useIsInMiniApp() === false` (hidden while `null` and inside Farcaster/Base App),
  mirroring the existing logout-hiding logic. The provider adds no host-specific
  connectors and does not touch wagmi/Dynamic, so the Mini App connect path is
  untouched. Verify the plain-wagmi branch of `app/providers.tsx` still renders
  (the provider must wrap BOTH branches).
- Bundle size. Bundling all 7 langs x N namespaces inflates the client JS. For
  PR1 (4 namespaces) it is negligible. When Phase 2 grows the catalogs, switch
  `resources` to lazy per-language import (`i18next-http-backend` or dynamic
  `import()` in a `changeLanguage` wrapper) so only the active language ships.
  Called out now so the `i18n.ts` `resources` shape is designed to swap later.

---

## 5. PR description outline (drop into `gh pr create`)

Title: `i18n foundation + language selector + pilot screens (client-side, 7 langs)`

Sections:

- Summary
  - Adds client-side internationalization (react-i18next + i18next +
    browser-languagedetector). 7 languages: en/es/it/fr/ko/zh/ja. Default =
    browser language, fallback English, persisted to localStorage.
  - No URL/`[locale]` routing, no middleware, no Docker/build-arg changes. Mini
    App embed URLs stay clean.
- What ships in this PR
  - i18n init/config (`app/i18n/*`), all 7 catalogs for the pilot namespaces
    (`common`, `auth`, `onboarding`, `dashboard`), `I18nProvider` wired into both
    branches of `app/providers.tsx`.
  - Header `LanguageSelector`, shown only in a regular browser
    (`useIsInMiniApp() === false`), hidden in Farcaster/Base App.
  - `document.documentElement.lang` kept in sync with the active language.
  - Pilot translated: app shell/nav, sign-in, onboarding welcome (+ shared
    OnboardingShell chrome), dashboard chrome.
- What is intentionally NOT in this PR
  - Heavy data screens (projects/[projectId], agents/[agentId], companies/new,
    the 7-step wizard) land in Phase 2; marketing/deck/investors in Phase 3.
  - OG/SEO metadata stays English (server-rendered, canonical domain is English).
- Translation status
  - `en` is 100% for the pilot; the other 6 languages are machine-translated
    (DeepL) for pilot keys. Untranslated keys are omitted and fall back to English
    automatically. Human review tracked in `app/i18n/locales/STATUS.md`.
- How it works / conventions
  - Key convention `namespace:section.key`; `en/*` is source of truth; add-to-en
    first. Detection order localStorage then navigator.
- Risks / known limitations
  - Brief flash-of-English for non-English users on first paint (SSR renders en,
    client detects post-mount); SEO metadata English; CJK via system fonts.
- Test plan
  - See acceptance checklist below (switch is instant, persists on reload, hidden
    in Mini App host, English fallback, build/typecheck/lint/test pass).
- Follow-ups
  - Phase 2 sub-PRs by namespace; lazy per-language catalog loading; `i18next-parser`
    + `npm run i18n:check`; optional CJK font stack.

Note on PR mechanics: ship via a feature branch and `gh pr create` (never
direct-push to main); commit author is JulioMCruz only, no `Co-Authored-By`
trailers, no em dashes in any user-facing copy added.

---

## 6. Acceptance criteria / QA checklist (first PR)

Functional
- [ ] Selecting a language in the header updates visible UI (nav, sign-in,
      onboarding welcome, dashboard chrome) instantly, no reload.
- [ ] Choice persists across reload and across route navigations (localStorage).
- [ ] On a fresh browser with no stored choice, the app auto-selects from
      `navigator.language` when supported, else English.
- [ ] Missing/untranslated keys render the English string (no raw keys like
      `common:nav.dashboard` shown, no blanks).
- [ ] `document.documentElement.lang` reflects the active language after switch
      and after reload (inspect `<html lang>`).
- [ ] All 7 languages selectable and each renders its own strings for the pilot
      surfaces; CJK (ko/zh/ja) glyphs render (system font) without tofu boxes.

Host gating
- [ ] Language selector is HIDDEN in a Farcaster Mini App host and in the Base App
      Mini App host, and while `useIsInMiniApp()` is still `null` (no flash).
- [ ] Language selector is VISIBLE in a regular desktop/mobile browser tab.
- [ ] i18n still applies inside Mini App hosts (auto from navigator), just without
      the manual selector; the Mini App connect/auth flow is unaffected.

Stability
- [ ] No React hydration warning in the console on first load for en and for a
      non-en detected language (accepted brief FOUE is not an error).
- [ ] Both `app/providers.tsx` branches (Dynamic-browser and plain-wagmi) render
      with the provider in place.
- [ ] `npm run build` passes (standalone output).
- [ ] `npm run typecheck` passes (namespaces/keys typed or at least `t()` calls
      compile).
- [ ] `npm run lint` passes.
- [ ] `npm run test` passes; add at least one unit test asserting English fallback
      for an absent key and that `changeLanguage` updates `i18n.language`.

Catalog integrity
- [ ] All 4 pilot namespaces exist for all 7 languages (28 files), valid JSON.
- [ ] No target-language file contains a key absent from the matching `en` file
      (drift check, manual for PR1).
