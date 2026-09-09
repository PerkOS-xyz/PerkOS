# Artizen creator draft review

Keep the existing project questionnaire and add one compact workspace beneath
it: current factual notes, explicit prepare/revise, editable draft, review notes,
approved writing example and recent results. A web confirmation explains the
reserved allocation before a managed Hermes run. Approval saves an example only;
it never publishes or enables recurring work.

The backend owns scope, idempotency, budget, runtime stop and receipts. Display
pending/working/stopping/review/attention separately; never imply a response means
the runtime has stopped. Poll only the active run while the tab is visible.
Reload uses persisted runs, not browser-local conversation state. Errors are
localized safe codes. No private credentials, runtime routing or arbitrary HTML.

Use the existing accessible ConfirmDialog rather than native browser popups.
Clear approved context means future prompts stop using that example; previous
drafts remain until the project is removed. Keep production and QA inactive.
