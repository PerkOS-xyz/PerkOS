# Task execution error copy

## Decision

Task execution failures must use short, actionable product language. The UI must never render the raw dispatcher error because it can contain internal URLs, provider payloads, transport codes, or implementation details. The API and Firestore record retain the original error for operational diagnosis.

The presentation layer classifies only two common conditions: timeouts and temporary agent unavailability. Everything else uses a safe generic delivery message. Every retryable failure tells the user that retrying is safe, and the existing Retry control remains the recovery action.

## Verification

Unit tests cover a provider timeout containing an internal URL and JSON, an unavailable-runtime error, and an unknown technical error. Each test verifies that the product message is useful and that the raw detail is absent from rendered output.
