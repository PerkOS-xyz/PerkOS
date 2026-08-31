# Runtime update i18n and UX

## Decision

Present the infrastructure operation as an agent update. The card labels the
installed version, explains the expected 60–90 second interruption, and makes
the preservation of encrypted state, memory, and conversation history explicit.

All visible copy, asynchronous feedback, errors, and confirmation text use the
`agentDetail.upgrade` translation namespace with English and Spanish parity.
Published dates use the selected PerkOS locale.

“Check for updates” remains available even when the agent is already current.
This allows a user who leaves the page open to discover a newly published
runtime without reloading. Query errors also provide an explicit retry action.

## Safety

The backend upgrade workflow is unchanged. The UI continues to require a
target version and explicit confirmation before invoking the mutation. Buttons
remain disabled while requests are pending.

## Verification

Static regression coverage checks translation parity, locale-aware date
formatting, the persistent update check, and removal of the previously exposed
English-only copy. TypeScript and the production build validate integration.
