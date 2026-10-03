# Sparky Voice Dashboard

## Decision

The dashboard has one canonical Sparky conversation. It is embedded in the
main workspace and replaces the dashboard's floating assistant panel. The
global assistant remains available on other routes and uses the same
conversation state.

## Experience

Sparky is the visual center of the first dashboard viewport. The official
Sparky avatar breathes while idle and visibly changes state while listening,
thinking, and speaking. The conversation and composer occupy the same central
surface, so the user never has to choose between two chat entry points.

The composer supports text, attachments, one-shot dictation, and continuous
voice conversation. Continuous mode is off by default, requires an explicit
user action, and remembers the user's preference locally. A visible live
indicator and stop control make microphone use unambiguous. The user can
interrupt synthesized speech at any time.

When a final voice transcript arrives in continuous mode, it is sent as a
single turn. Sparky's next completed response is read aloud and listening
resumes only after speech ends. This prevents Sparky from transcribing its own
voice. Unsupported browsers keep the complete text experience and omit voice
controls.

## Layout

The desktop dashboard uses a Runtime-inspired stage:

- Sparky and the active conversation are centered.
- Project agents form a compact responsive team rail around the stage and
  retain their persistent identities and runtime state.
- Organization Knowledge is secondary and expandable below or beside the
  stage, rather than competing with the conversation.
- Operational metrics, approvals, activity, projects, and tasks remain below.

On mobile the same hierarchy becomes a single column: avatar, conversation,
composer, team rail, then knowledge. No fixed chat overlays the content.

## State and safety

The existing assistant conversation ID, websocket transport, message history,
and provider remain the source of truth. The embedded and floating renderers
must never be visible simultaneously. Closing or navigating away from the
dashboard stops recognition and speech. Permission denial, unsupported voice,
connection loss, and synthesis failure degrade to text without losing the
draft or conversation.

## Verification

Tests cover the dashboard-only suppression of the floating panel, one-shot and
continuous voice controls, persisted opt-in, listen/speak sequencing, avatar
states, text fallback, responsive structure, and the absence of duplicate chat
entry points. Typecheck, focused tests, the full suite, production build, and
an authenticated browser review are required before deployment.
