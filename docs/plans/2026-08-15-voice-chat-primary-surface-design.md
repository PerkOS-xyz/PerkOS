# Voice and Chat primary surface

## Decision

The agent detail page presents Voice before Chat. Voice becomes the primary live-action surface while the existing canonical direct Chat remains the durable readable history beneath it. Project and direct conversation contracts are unchanged; this Web change does not create a second history writer.

## Call hierarchy

The call card uses a prominent live state with agent identity, elapsed duration, microphone mute/unmute, and a destructive End action. Before the call, the existing default-on final-pair consent is expressed as two clear modes: Normal saves completed final user and agent turns to the canonical Chat; Private saves neither side. Mode changes lock during the active lifecycle. Raw audio and interim speech remain outside persistence in both modes.

Secondary facts—browser audio processing, barge-in behavior, privacy guarantees, and safe connection status—live in a native collapsible settings region. This keeps technical controls available without competing with the call lifecycle.

## Operating model policy

The agent header always labels the truthful operating boundary as `External agent` or `PerkOS infrastructure`. External agents show a concise declared-availability sentence only when existing runtime evidence resolves to a known state; unknown or unverified availability produces no empty claim. The copy explicitly keeps runtime, skills, and provider configuration owner-operated. Managed agents may show the existing capability inventory and operational controls. External agents do not receive the managed capabilities card, avoiding any implication that PerkOS installed or controls their skills. Universal conversation, privacy, and call controls remain available in both models.

`Refresh status` is universal and read-only. The existing generic Edit dialog can change profile/runtime configuration, so it is exposed only for an authenticated managed-agent owner and relabeled `Manage agent`. It is hidden for external agents rather than implying that PerkOS can modify their identity, soul, skills, runtime, or provider. The current data model has no separately scoped owner-authorized external connection-settings editor, so no speculative replacement action is shown.

## Chat hierarchy and provenance

Direct Chat retains its existing canonical conversation lookup, WebSocket delivery, history request, hibernation policy, and composer. The history viewport is taller and message typography is larger. Messages carrying allow-listed Voice provenance (`voice` or `voice_session` domain) receive a small Saved voice turn badge. Live response status remains visually and semantically separate and never becomes history by itself. The client forwards only safe event domain/type metadata and does not inspect or display session, turn, provider, or host identifiers.

## Responsive and accessible behavior

Controls stack at narrow widths and form a two-column layout when space permits. Primary touch actions are at least 48px high. Privacy mode, mute state, call duration, errors, connection state, and history have explicit accessible names. Empty, loading, unavailable, reconnecting, failed, offline, and active states retain truthful copy. Native details/summary supplies keyboard-accessible disclosure without adding a new dependency.

## Verification

Focused tests cover call hierarchy, duration, mute/unmute, default Normal and explicit Private payloads, direct/project bindings, fail-closed missing context, safe remote audio status, and persisted Voice provenance. Full tests, typecheck, changed-file lint, production build, secret scan, and responsive browser inspection are required before merge.
