# PerkOS Voice MVP Web design

## Scope and trust boundary

The agent details surface gets a clearly labelled voice-call card. Voice readiness is independent from text chat, bridge heartbeats, runtime health, and generic plugin names. The card consumes only a future, allow-listed voice capability response; until that control-plane handshake exists, the response is absent and the card remains unavailable with a truthful explanation. Bragi therefore does not appear callable merely because its text bridge is online.

The Web client includes the exact authenticated PerkOS-API gateway-grant request contract so it can be used once a verified gateway activation flow exists. The browser must never log or render the returned token, forward it over A2A or Chat, or use the agent identity to join LiveKit itself. Existing human Meetings behavior remains the only active LiveKit join path in this phase.

## State and interaction model

The UI model supports `unavailable`, `checking`, `connecting`, `ready`, `in-call`, `reconnecting`, `failed`, and `ended`. A pure resolver accepts a narrowly typed capability response and maps absent, pending, unavailable, or ready evidence into the appropriate display state. Only explicit `available: true` plus `status: ready` can enable a future call action. Errors are reduced to non-sensitive user messages.

The initial agent-details integration passes no capability response because no established endpoint exists. It consequently shows “Voice unavailable” and explains that the agent gateway and speech provider must report verified availability. The disabled control cannot be unlocked by agent provisioning state, text chat presence, or a bridge heartbeat.

## API and LiveKit flow

The prepared API helper posts to `/api/projects/:projectId/meetings/:meetingId/voice-gateway-grant` through the existing authenticated same-origin platform proxy. It sends the route-identical `projectId` and `meetingId`, canonical `agentId`, explicit `voiceProcessingConsent: true`, and optional project `owner`. It validates the success envelope and expiry without exposing credential values in errors.

Once the platform supplies a verified capability/activation handshake, the future enabled flow is: establish a live meeting, activate the agent gateway through that approved control-plane mechanism, request/consume the gateway grant inside the trusted gateway flow, and join the human through the existing Meetings token path. The current phase intentionally does not invent the missing activation endpoint or duplicate a room join.

## Verification

Unit tests cover the full state vocabulary, the strict readiness gate, unavailable defaults, endpoint construction, request body, response parsing, and non-sensitive failures. Repository lint, typecheck, tests, and production build must pass. Documentation records the intentionally unavailable pilot state and the remaining gateway/provider dependency.
