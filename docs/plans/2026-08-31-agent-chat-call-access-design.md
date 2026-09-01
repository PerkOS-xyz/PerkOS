# Agent chat and call access

## Problem

The agent detail conversation currently grows with the complete message history.
For Athena this produced a 5,041 px conversation panel: the composer began at
5,116 px and the collapsed voice section at 5,281 px. Voice itself was healthy,
but users reasonably interpreted the control as missing.

## Decision

Treat conversation as a bounded communication workspace. Its message history is
the scroll region, while the composer remains visible at the bottom. On desktop,
the workspace uses a viewport-aware height with practical minimum and maximum
bounds. Phone and tablet retain their existing single-viewport tab behavior.

Voice becomes a primary action in the agent header. The same action is repeated
at the top of the mobile Conversation panel because the full agent header lives
inside the mobile Settings tab. Activating it opens one responsive dialog: a
bottom sheet on small screens and a centered modal on desktop. The existing
Working Call, Private Call, health, permission and reconnect behavior remains
inside `AgentVoiceCallController`; only its presentation changes.

## Accessibility and failure behavior

- The launcher is a real button with the localized `Call {{name}}` label.
- The dialog supplies a title and description and restores focus on close.
- Voice availability and errors remain owned by the existing controller.
- The chat retains keyboard submission and its labelled, independently
  scrollable history.
- No floating action overlaps the composer or bottom navigation.

## Verification

- Component/layout tests assert the desktop bound, persistent composer and
  header/mobile launchers.
- Voice card/controller tests continue to cover call modes and state changes.
- TypeScript, the focused Vitest suite and production build must pass.
