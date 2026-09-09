# Artizen task projection parity

Approved follow-up to the Dev verification: initial project reads retain execution metadata, but the live task hook discards it and replaces the initial rows. A failed attempt consequently returns to Human review.

Use one Firestore task converter for both paths. Extract the existing converter without broadening document access or adding fields from private records. Preserve legacy tasks, attachments, logs, timestamps and Artizen execution/approval metadata. The hook keeps its existing scoped query, listener count, unsubscribe and error behavior. No database migration, extra read, polling, generation or lifecycle action.

Alternatives rejected: duplicating the fields repeats the drift risk; patching stored tasks does not repair the lossy reader. No change to accounting or task status enums.

Test real converter plus mocked Firestore delivery into the hook and actual board in EN/ES, including held failure, confirmed reconciled failure, human-review draft, approved example, replay/reload, ordinary tasks, null scope and listener cleanup. Test initial reader with the same converter too. No real model or paid execution.
