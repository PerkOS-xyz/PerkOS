# Voice release gate

Owner requests urgent removal of agent calls from QA and production until tested in Dev.

- Default off. App build requires PERKOS_ENVIRONMENT=development and PERKOS_VOICE_ENABLED=true. Docker build argument defaults false. Next config derives the public flag; runtime environment changes alone do not enable a previously built browser bundle.
- Hide call actions, enrollment, credential delivery, health, speech selection and Meetings; do not mount disabled Voice components or run their polling queries.
- Preserve A2A text chat and maintenance. Dev's combined enrollment panel keeps the independent update action when Voice is disabled.
- API middleware rejects Voice and meeting routes before authentication/database access unless explicitly enabled in Dev. QA/production reject even accidental true flags. No removal of stored data, credentials or plugins, and no external host/gateway changes.
- Alternatives rejected: CSS-only hiding leaves requests and direct calls active; shipping all Dev features would expand the hotfix unnecessarily.
- Hotfix uses each environment's existing branch with only this gate backported. Verify source parity, retain rollback images, build and smoke QA before production. UI/API tests cover disabled defaults and unaffected text paths.
