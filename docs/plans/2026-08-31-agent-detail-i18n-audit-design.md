# Agent detail i18n audit

## Scope

Audit the normal owner-facing experience under `/agents/[agentId]`: responsive
view tabs, header and runtime state, wake banner, direct chat, voice health,
inbound webhook, team management, and hibernation/backups.

## Decision

All interface copy, accessibility labels, transient states, toasts, and
confirmation dialogs in this scope use `react-i18next` keys under
`agentDetail`. English remains the source locale and Spanish receives complete
equivalent copy. Runtime identifiers, agent names, provider names, capability
names, and API error payloads remain data and are not translated.

Dates in the audited panels use the selected i18n locale instead of the host
browser default. This prevents an otherwise Spanish screen from rendering
English month names.

## Verification

Regression checks assert that the audited components use their namespaces and
that both English and Spanish catalogs contain every audited section. The final
Dev check switches languages on the same agent detail URL and verifies that the
visible chrome changes without mixed-language UI copy.
