# Language selector — UX spec

Status: design only, no app code changed. Grounded in `app/components/NetworkPill.tsx`,
`app/components/UserMenu.tsx`, `app/(app)/layout.tsx`, `app/lib/useIsInMiniApp.ts`,
`components/ui/dropdown-menu.tsx` (Base UI `@base-ui/react/menu`), `app/page.tsx` (landing
`TopNav`), `app/(auth)/sign-in/page.tsx`.

Scope note: `package.json` has no i18n library (no `next-intl`/`i18next`) and there's no
`[locale]` route segment anywhere in this app (flat `app/` tree). This spec covers the
**selector control + persisted preference** only. Actual message-catalog wiring is separate
follow-up work; the `useLocale()` context below is the seam future translation work plugs into.

## 1. Data model

```ts
// app/lib/locales.ts
export type LocaleCode = "en" | "es" | "fr" | "it" | "zh-Hans" | "ja" | "ko";

export interface LocaleOption {
  code: LocaleCode;
  englishName: string;
  nativeName: string;
  displayCode: string;     // shown in the collapsed trigger — always 2 chars
  matchTags: string[];     // navigator.language primary subtags mapped to this option
}

export const LOCALES: LocaleOption[] = [
  { code: "en",      englishName: "English",             nativeName: "English",       displayCode: "EN", matchTags: ["en"] },
  { code: "es",      englishName: "Spanish",              nativeName: "Español",       displayCode: "ES", matchTags: ["es"] },
  { code: "fr",      englishName: "French",               nativeName: "Français",      displayCode: "FR", matchTags: ["fr"] },
  { code: "it",      englishName: "Italian",              nativeName: "Italiano",      displayCode: "IT", matchTags: ["it"] },
  { code: "zh-Hans", englishName: "Chinese (Simplified)", nativeName: "中文（简体）",    displayCode: "ZH", matchTags: ["zh"] },
  { code: "ja",      englishName: "Japanese",             nativeName: "日本語",         displayCode: "JA", matchTags: ["ja"] },
  { code: "ko",      englishName: "Korean",               nativeName: "한국어",         displayCode: "KO", matchTags: ["ko"] },
];

export const DEFAULT_LOCALE: LocaleCode = "en";
export const LOCALE_STORAGE_KEY = "perkos-locale";
```

**Order rationale**: English pinned first (fallback + current audience default). The
three Latin-script languages follow, alphabetical by native endonym (Español, Français,
Italiano — this happens to also be alphabetical). CJK cluster last (not yet the primary
go-to-market audience per the landing page's SMB-US-first positioning), ordered
alphabetically by English name (Chinese, Japanese, Korean) since collating raw CJK
codepoints together is meaningless to a maintainer. This is an editorial call, not a
technical constraint — reordering `LOCALES` is a one-line change.

**Known v1 simplification**: only one Chinese variant exists, so `matchTags: ["zh"]`
maps *any* `zh-*` (including `zh-Hant`/`zh-TW`/`zh-HK`) to Simplified. Flag for revisit
if/when Traditional Chinese is added.

## 2. Trigger

**Desktop (32px, `h-8`)** and **mobile pill variant (44px, `h-11`)** — content is
identical at both sizes, only height changes (exactly like `NetworkPill`):

```
[Globe icon]  EN  [chevron]
```

- Icon + 2-letter code, **not** the native name and **not** icon-only.
  - Native name would make the pill's width jump per-language (2 chars "EN" vs.
    up to "中文（简体）"/"Français") — fights the compact, low-noise pill aesthetic.
  - Icon-only sacrifices "state at a glance" — the whole point of NetworkPill's chain
    logo is that a glance tells you the active state without opening the menu.
  - Every `displayCode` is exactly 2 characters, so — unlike `NetworkPill`, whose width
    varies with balance digits — this pill has **constant width** across all 7 languages.
- No flags. See §3.
- Chevron included and rotates on open, matching `NetworkPill`/`UserMenu` convention so
  the header cluster reads as one visual family.

```tsx
<DropdownMenuTrigger
  aria-haspopup="listbox"
  aria-label={`Language: ${active.englishName}. Change language`}
  className={cn(
    "group inline-flex items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium transition-colors",
    "h-11 md:h-8",
    "border-border text-muted-foreground",
    "hover:border-primary/40 hover:text-foreground",
    "data-[popup-open]:border-primary/40 data-[popup-open]:text-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
  )}
>
  <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden />
  <span className="whitespace-nowrap">{active.displayCode}</span>
  <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform motion-safe:duration-150 group-data-[popup-open]:rotate-180" />
</DropdownMenuTrigger>
```

## 3. Dropdown content

- **Primitive**: `DropdownMenu` (Base UI `Menu`), same family as `NetworkPill` — this is
  a single-select list of mutually exclusive options, the same shape as the chain
  switcher, not a mixed actions/profile panel (`UserMenu`'s `Popover` use case).
- **Selection semantics**: use `DropdownMenuRadioGroup` / `DropdownMenuRadioItem`
  (already built in `components/ui/dropdown-menu.tsx`, complete with a baked-in
  `CheckIcon` indicator at `right-2`) rather than hand-rolling NetworkPill's plain-`Item`
  + manual highlight. This is genuinely a radio list (`role="menuitemradio"`,
  `aria-checked` for free) where NetworkPill's chain switch is an *action* that triggers
  an async, failable wallet RPC — different semantics, different primitive is correct
  here even though NetworkPill didn't need it.
- **Row content**: native endonym on top, English gloss below in smaller muted text —
  for every language except English (native name == English name there, redundant).
  Always-on gloss (not just for CJK) for consistency and so a future addition (e.g.
  Finnish "Suomi") doesn't need a one-off exception.

  ```
  Español
  Spanish
  ```

- **Flags: no.** Rationale:
  1. Language ≠ country — Spanish/French/English/Chinese are each spoken across many
     flags; there's no correct 1:1 mark the way a chain logo *is* the network's identity.
  2. Avoids representation/politics questions (which flag for Chinese Simplified? for
     English?).
  3. Flag emoji render inconsistently across OS/font stacks and still need alt text —
     no accessibility win over just using the endonym text.
  4. Matches established practice (Apple, Google, GitHub language pickers all use
     script name only, no flags).
  - The `Globe` icon in the trigger already signals "this control is about
    language/locale" generically without endorsing a country.
- **Selected-state indicator**: the `DropdownMenuRadioItem` check icon (built in) *plus*
  a `data-[checked]:bg-primary/10 data-[checked]:text-primary` tint on the row — doubles
  up on affordance and keeps the same visual weight `NetworkPill` uses for its selected
  row, even though the underlying primitive differs.
- **Width**: `w-56` (224px) — wider than `NetworkPill`'s `w-44` because rows are two
  lines (native + gloss) and CJK glyphs need breathing room. Row height `h-10`, same as
  `NetworkPill`'s items, for tap-target consistency across all header dropdowns.

```tsx
<DropdownMenuContent
  align="end"
  sideOffset={6}
  className="w-56 rounded-xl border-border bg-card p-1 shadow-lg"
>
  <DropdownMenuRadioGroup value={locale} onValueChange={setLocale}>
    {LOCALES.map((l) => (
      <DropdownMenuRadioItem
        key={l.code}
        value={l.code}
        className="h-10 rounded-md px-3 text-sm text-foreground hover:bg-muted/40 data-[checked]:bg-primary/10 data-[checked]:text-primary"
      >
        <span className="flex flex-1 flex-col leading-tight py-1">
          <span>{l.nativeName}</span>
          {l.code !== "en" ? (
            <span className="text-[10px] text-muted-foreground">{l.englishName}</span>
          ) : null}
        </span>
      </DropdownMenuRadioItem>
    ))}
  </DropdownMenuRadioGroup>
</DropdownMenuContent>
```

## 4. Placement

| Surface | Recommendation |
|---|---|
| Desktop app header cluster (`app/(app)/layout.tsx:135-141`) | Insert **between `NotificationsBell` and `UserMenu`**: `CommandHint, RefreshButton, NetworkPill, NotificationsBell, LanguageSwitcher, UserMenu`. Language is a personal/account-adjacent preference (like GitHub/Notion/Linear put it near the profile menu), not core product state like network or notifications — keep those two undisturbed. |
| Mobile inline header (`layout.tsx:145-199`, the `flex items-center gap-1` row with `NetworkPill`, `RefreshButton`, Sheet trigger) | **Do not** add inline — that row is already tight at 375px and `NetworkPill` is the widest element in it. |
| Mobile Sheet drawer | **Yes, here.** Render the `variant="row"` form right after `<NavList pathname={pathname} />` and before the `<Separator className="bg-border" />` that precedes `WalletFooter`. This mirrors the existing reuse pattern in the same file — `WalletFooter` is already rendered twice (desktop sidebar + inside `SheetContent`) as a shared component with a drawer-appropriate shape; `LanguageSwitcher` should do the same with a `variant` prop instead of being duplicated. |
| Public landing `TopNav` (`app/page.tsx`, the `<div className="flex items-center gap-2">` around line 154) | **Add it.** Insert as the *first* child, before the "Sign in" `SmartCTA`: `LanguageSwitcher, Sign in, Meet your team/Start`. Same `useIsInMiniApp()` gate applies (TopNav is reachable pre-auth, including from a Mini App webview before `LandingAutoRoute` redirects). Rationale: the landing page explicitly targets non-technical SMB owners first: localized landing copy (when it ships) will matter more for conversion pre-signup than post-signup, and the same component/localStorage key just carries the choice through to `/sign-in` → the app for free. |
| Sign-in page (`app/(auth)/sign-in/page.tsx`) | **Skip for v1.** It's a single centered auth card with hardcoded hex styling (`#0e0716`, `#ec1b69`, …), not built on the shared pill/card tokens, and most visitors bounce off it in one `useEffect` tick (`isInMiniApp === true \|\| isConnected` → immediate `router.replace`). Adding the control means inventing a new floating position rather than reusing an existing cluster, for a screen most people don't linger on. The preference set on the landing page (or on first visit if they land here directly) already persists via `localStorage` and carries through. Revisit if user testing shows people landing here without visiting `/` first and getting stuck in the wrong language. |

## 5. Behavior + a11y

- **`aria-label`** on trigger: `` `Language: ${active.englishName}. Change language` `` —
  dynamic, mirrors `NetworkPill`'s pattern of folding current state into the label.
- **Keyboard** — all free from `@base-ui/react/menu`, no custom handling needed (same as
  `NetworkPill`/`UserMenu` today): Tab focuses trigger → Enter/Space/↓ opens with first
  (or checked) item focused → ↑/↓ moves through the 7 rows, Home/End jump to
  first/last → Enter/Space selects + closes + returns focus to trigger → Escape closes
  without changing selection + returns focus to trigger → click-outside dismisses.
- **On select**: `setLocale(code)` → writes `localStorage["perkos-locale"]` + updates
  React context state synchronously → menu closes (default Base UI behavior on item
  select, same as `NetworkPill`). **No navigation, no reload** — there's no `[locale]`
  route segment in this app, so this is pure client state. The moment real translated
  copy is wired (separate work), consuming components re-render via the context
  subscription — still zero reload.
- **No toast.** The pill's label updating + the menu closing to reveal the new state
  *is* the confirmation. Contrast with `NetworkPill`, which *does* toast — chain
  switching is an async wallet RPC that can genuinely fail and needs explicit
  success/error feedback. A language toggle is synchronous, local, and can't fail, so a
  toast would be pure noise.
- **RTL**: confirmed none of the 7 (en, es, fr, it, zh, ja, ko) are RTL scripts — no
  `dir` handling needed anywhere for this feature. If a RTL language (Arabic, Hebrew) is
  ever added, that's a separate, larger change (root `dir` toggle + logical Tailwind
  utilities `ms-`/`me-` instead of `ml-`/`mr-` app-wide) — out of scope, flagged only.
- **Reduced motion**: chevron rotation uses `motion-safe:duration-150`, matching
  `NetworkPill`'s existing convention.

## 6. Loading / gating state

`useIsInMiniApp()` is `null` while resolving and the component must not flash browser UI
inside a host for a frame. Since this control has no meaningful "neutral" visual (it's
binary: shown or not), the correct guard collapses both the loading and the
inside-a-host cases into one early return:

```tsx
const inMiniApp = useIsInMiniApp();
if (inMiniApp !== false) return null; // hidden while loading AND inside any Mini App host
```

Net effect: in a Mini App host the control never renders, ever. In a browser it appears
once `sdk.isInMiniApp()` resolves to `false` (one effect tick after first paint) — an
imperceptible pop-in, and the same tradeoff every other host-gated piece of this header
already accepts.

## 7. New files (illustrative only, not written)

- `app/lib/locales.ts` — data in §1.
- `app/lib/useLocale.tsx` — `LocaleProvider` (localStorage read/write + `navigator.language`
  default-detection via `matchTags`) + `useLocale()` hook exposing `{ locale, setLocale }`.
  Detection walks `navigator.languages` (falls back to `navigator.language`), matches each
  candidate's primary subtag against `LOCALES[].matchTags`, first hit wins, else `DEFAULT_LOCALE`.
  Resolved value is written back to `localStorage` immediately so it's stable on reload even
  if the browser's language setting later changes.
- `app/components/LanguageSwitcher.tsx` — the component in §2-3, with a
  `variant?: "pill" | "row"` prop for the desktop-pill vs. drawer-row placements in §4
  (same reuse pattern already established by `WalletFooter` in `(app)/layout.tsx`).
