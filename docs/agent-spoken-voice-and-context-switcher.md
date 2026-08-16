# Agent spoken voice and contextual navigation

Agent settings expose `speechVoice` as **Spoken audio voice**, explicitly
separate from textual personality. The selector writes only a provider voice
identifier through the authenticated agent profile API.

Option labels include a **presentation-only** lean
(`feminine-leaning` / `masculine-leaning` / `neutral`) so owners can pick a
voice that matches the agent’s spoken identity (e.g. Athena → `nova`). Provider
voices are not legally gendered; the lean is UX guidance only.

The voice call card surfaces the configured voice as a compact chip
(`nova · feminine`) so the owner can confirm the next call’s TTS selection.

On `/agents` routes, the top-bar context picker switches between owned agents
and includes **All agents**. Project routes retain the project picker. Connected
legacy external clients no longer show an amber warning solely because they do
not publish the optional execution-health extension; verified runtime failure
continues to render a blocking error.
