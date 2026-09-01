# Chat agent status consistency

## Problem

Direct chat currently presents three unrelated signals as though they mean the
same thing: a green `Working now` chip, a `Live` relay badge, and a cached
`HOST_OFFLINE` history error. Users cannot tell whether the agent can work or
what action to take.

## Design

- Firestore agent lifecycle and bridge presence provide the canonical
  operational state: online, sleeping, waking, unavailable, or checking.
- The header displays that operational state beside the agent identity.
- Relay WebSocket state is explicitly secondary and is labelled `Chat
  connected`, `Chat reconnecting`, or `Chat disconnected`.
- An actionable banner appears only for sleeping, waking, unavailable, or an
  unresolved history-host failure. Managed agents offer `Wake agent`/`Try
  again`; external agents link to connection settings instead.
- A successful realtime transition removes the banner automatically. A stale
  history error cannot override a confirmed-online agent.
- Because the app does not yet expose a reliable current-task signal, the
  global strip says `Available now`, not `Working now`.

## Acceptance criteria

- Green `Online` and an offline banner never coexist.
- Chat transport status never claims the agent itself is live.
- Sleeping managed agents have an accessible wake action; waking disables
  duplicate actions; failures allow retry.
- External agents never receive an infrastructure wake action.
- State changes are announced and update without reload.

