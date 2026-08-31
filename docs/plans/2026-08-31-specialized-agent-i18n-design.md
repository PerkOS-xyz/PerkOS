# Specialized agent-detail i18n

## Scope

Close the remaining language gaps in the agent detail route: expanded voice
calls, voice connection and recovery feedback, invited-agent credentials, and
the encrypted voice-gateway credential delivery flow.

## Decision

All UI-owned copy uses the `agentDetail.voice`, `voiceController`,
`invitedCredential`, or `voiceCredential` namespaces. English and Spanish keys
remain in parity. Agent names, runtime identifiers, algorithms, public-key
fingerprints, and server error payloads remain data and are not translated.

Voice UI status follows the selected language without changing LiveKit or API
state. Security warnings retain the same meaning: secret credentials and
private keys must not be pasted or exposed. Credential expiry dates use the
selected PerkOS locale.

## Verification

Regression coverage checks catalog parity, locale-aware credential dates, and
removal of known English-only strings. Existing voice controller tests,
TypeScript, and a production build protect behavior.
