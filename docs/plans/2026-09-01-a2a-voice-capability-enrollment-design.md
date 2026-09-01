# A2A-authenticated optional Voice enrollment

## Decision

Voice is an optional capability parallel to A2A, not a required part of external-agent onboarding. A2A remains responsible for identity, transport, prompts and authentication. Voice owns runtime/model compatibility, installation, local credential storage, gateway lifecycle and diagnostics.

An agent advertises Voice independently with one of six states: `unknown`, `available`, `unsupported`, `enrolling`, `ready` or `degraded`. PerkOS must not infer support merely from a Hermes, OpenClaw or ZeroClaw runtime label. `Call agent` is exposed only in `ready`.

## Flow

For `unknown`, the owner can request a non-destructive support check. PerkOS sends the fixed marker `PERKOS_VOICE_PROBE` through the existing A2A channel. The agent reports `available` only when its runtime/model and native Voice integration are compatible; otherwise it reports `unsupported` with an allow-listed reason code.

For `available`, `Enable calls` creates an environment-, organization- and agent-bound pending enrollment. The owner sends only `PERKOS_VOICE_ENROLL`. The A2A integration authenticates the claim with the agent's existing `relayApiKey`. No enrollment URL, code, JSON or durable secret enters the prompt.

The API issues the Voice credential only to the exact authenticated agent and only once. The native Voice integration stores it locally with mode `0600`, applies the runtime profile, starts or updates the service, runs `perkos-voice-doctor --report`, and returns only a safe terminal marker: `PERKOS_VOICE_READY`, `PERKOS_VOICE_ACTION_REQUIRED:<code>` or `PERKOS_VOICE_FAILED:<code>`.

## Boundaries and recovery

The API uses transactional claim state to reject replay, cross-agent claims, cross-environment claims and expired enrollment. Rotating Voice never rotates or invalidates A2A identity. A failed install rolls back Voice configuration and reports `degraded` or an allow-listed action-required code. Agents that only support A2A continue operating unchanged.

The existing secret JSON remains an advanced direct-host fallback, clearly separated from the standard prompt flow. It is never copied into chat, logs, URLs, command arguments, analytics or Obsidian.

## Acceptance

Tests cover all state transitions, unsupported models, absent Voice integrations, double claim, replay, expiry, environment and identity isolation, install rollback, safe error reporting, absence of secrets from prompts and logs, and preservation of A2A-only agents. UI tests prove that support check appears only for `unknown`, enablement only for `available`, and calling only for `ready`.

