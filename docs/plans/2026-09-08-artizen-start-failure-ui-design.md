# Artizen unsuccessful attempts

Approved scope: explain failed startup and budget recovery, never retry generation automatically. API owns evidence, revocation and reconciliation; App presents only safe codes.

Use one EN/ES component in the workflow, task board and task detail. Separate unsuccessful attempts from Human review in the Artizen board without expanding the shared task status schema. Preserve draft-bearing tasks, historical results and approval controls. A settled run is accounting completion, not editorial success.

Only the API failureCode runtime-start-failed allows the claim that the model was not called. Generic failed, timeout or no-result terminal attempts use neutral copy. Pending settlement says the hold remains; settled says reconciled, never free or exact invoice. Keep existing explicit budget confirmation for a new request; no automatic retry, new polling or external actions.

Tests cover EN/ES, held/settled states, no fabricated no-model claim for legacy failures, board grouping, preserved drafts and no POST on viewing/reloading. Feature branch from development; merge/deploy separately from code verification.
