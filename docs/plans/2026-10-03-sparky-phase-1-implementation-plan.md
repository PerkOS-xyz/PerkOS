# Sparky-first experience: Phase 1 implementation plan

## Goal

Deliver one cohesive project-creation journey:

1. a new or returning user can start with Sparky;
2. Sparky turns the conversation into a reviewable `ProjectIntent`;
3. PerkOS recommends a published template and previews the complete team;
4. every role shows its responsibilities, initial access policy, and persistent visual identity;
5. project creation stores immutable snapshots of the intent, template revision, role policies, and visual identities;
6. no agent runtime, encrypted knowledge access, or autonomous execution is introduced in this phase.

The implementation spans PerkOS App and PerkOS API. API work must begin in a clean worktree based on its current `main`; the existing local API checkout has unrelated uncommitted changes and must not be reused.

## Product decisions

- Use a dedicated Sparky project-intake experience rather than stretching the global assistant drawer into a multi-step workflow.
- Reuse the existing authenticated assistant service and template registry behind purpose-specific project-intent endpoints.
- Keep account-profile onboarding separate. After the required profile is completed, Sparky becomes the first project experience.
- Recommend a template, but always allow the user to browse templates or continue with a simple custom project.
- Adapt Runtime's deterministic identity concept to the current PerkOS visual language. Preserve layered, persistent identities without humanoid faces, robot portraits, metallic textures, or other imagery already rejected by product testing.
- Store role policies now as inert, immutable project metadata. Enforcement and encrypted knowledge retrieval begin in Phase 2.
- Put new user-facing copy in every currently supported locale. English and Spanish receive authored copy; other locales may initially use reviewed English fallback only if the existing localization contract permits it.

## Contract introduced in Phase 1

### `ProjectIntent`

```ts
type ProjectIntent = {
  id: string;
  owner: string;
  orgId: string | null;
  status: "draft" | "confirmed" | "consumed";
  revision: number;
  goal: string;
  successCriteria: string[];
  businessContext: string;
  constraints: string[];
  deadline: string | null;
  budget: string | null;
  proposedKnowledgeSources: string[];
  confirmedFacts: IntentFact[];
  assumptions: IntentFact[];
  recommendedTemplateId: string | null;
  recommendationReason: string;
  createdAt: string;
  updatedAt: string;
};
```

`IntentFact` contains a stable ID, text, provenance (`user` or `sparky`), and confirmation state. Free-form model output is never persisted directly as a trusted intent.

### Template team and policy

Each published project template gains a `team` array. Every entry contains:

- stable `roleId`, display name, plain-language responsibility, and optional preset ID;
- `isLead` and sort order;
- allowed knowledge scopes and node types;
- allowed actions;
- escalation conditions;
- deterministic `avatarSeed` inputs, never presentation-only random values.

The API schema rejects templates with duplicate role IDs, multiple leads, unknown permissions, or an empty team. A template revision remains immutable after publication.

### `AgentAvatarIdentity`

The stored identity contains versioned, deterministic visual attributes such as form, accent, secondary tone, mark, pattern, and detail. Runtime state such as availability, glow, expression, or motion is not persisted in the identity. Preview identities are derived from `templateId + revision + roleId`; project creation stores the exact derived snapshot so later generator changes cannot alter existing teams.

## Task 1: shared domain types and validators

**PerkOS App files**

- Modify `app/lib/projectTemplateTypes.ts`.
- Add `app/lib/projectIntentTypes.ts`.
- Add `app/lib/agentAvatarIdentity.ts`.
- Add `tests/projectIntentTypes.test.ts`.
- Add `tests/agentAvatarIdentity.test.ts`.
- Extend `tests/projectTemplateAnswerText.test.ts` only if helpers move or new localized rendering behavior is added.

**PerkOS API files**

- Modify `src/services/projectTemplateSchema.ts`.
- Add `src/services/projectIntentSchema.ts`.
- Add `src/services/agentAvatarIdentity.ts`.
- Extend `tests/projectTemplateSchema.test.ts`.
- Add `tests/projectIntentSchema.test.ts` and `tests/agentAvatarIdentity.test.ts`.

**Implementation notes**

1. Define matching strict schemas in the API and read-only types in the App.
2. Version the avatar algorithm from its first release (`version: 1`).
3. Make deterministic derivation a pure function with fixed fixtures shared conceptually across repositories.
4. Reject unknown role permissions instead of silently dropping them.
5. Keep policy values intentionally small for Phase 1: `personal`, `organization`, `project`, and `task` scopes; named knowledge-node types; and a curated action union.

**Verification**

- The same seed always returns the same identity.
- Different role IDs in one template produce distinguishable identities.
- Published template payloads without valid policies fail validation.
- Existing Artizen template fixtures are migrated and still validate.

## Task 2: versioned template team definitions

**PerkOS API files**

- Modify `src/services/artizenTemplate.ts`.
- Modify `src/routes/projectTemplates.ts`.
- Modify `scripts/templates-seed.json` and `scripts/seed-templates.mjs` if seed validation requires it.
- Extend `tests/projectTemplatesRoutes.test.ts`.
- Extend `tests/projectTemplateSchema.test.ts`.

**PerkOS App files**

- Modify `app/components/ProjectTemplateWizard.tsx`.
- Modify `app/components/ProjectTemplateConfiguration.tsx`.
- Extend `tests/ProjectTemplateWizard.test.tsx`.

**Implementation notes**

1. Add a valid team and role-policy definition to every template exposed by `/project-templates`.
2. Return the team only from immutable published revisions, never from the mutable template head.
3. Include the exact team, policy, and avatar snapshots in `project_template_instances`.
4. Preserve the current idempotency contract: retrying the same request must return the same project; changing the intent, answers, or snapshot must conflict.
5. Continue using `activation: "configuration-only"`; no ECS task or agent is provisioned.

**Verification**

- Updating and republishing a template does not mutate an existing project's team snapshot.
- A client cannot submit a different team or broader policy than the published revision.
- Legacy configured projects without a team snapshot render a safe compatibility state.

## Task 3: persistent abstract agent identity UI

**PerkOS App files**

- Add `app/components/AgentIdentityAvatar.tsx`.
- Modify `app/components/AgentOrb.tsx` to delegate to the identity component while preserving its public props.
- Modify `app/lib/agentVisuals.ts` only for the compatibility adapter.
- Add `tests/AgentIdentityAvatar.test.tsx`.
- Extend `tests/ActiveAgentsPanel.test.tsx`, `tests/ProjectTeamPanel.test.tsx`, and `tests/TaskAgentCard.test.tsx` with identity continuity assertions.

**Implementation notes**

1. Render a layered SVG/CSS identity with semantic role cues and no face or robot portrait.
2. Support compact, standard, and hero sizes from one component.
3. Treat availability, working, waiting, and resting as runtime overlays that do not change the base identity.
4. Provide accessible text at the containing card; the decorative avatar itself remains hidden from assistive technology.
5. Keep the existing `AgentOrb` API as a migration boundary so Stage, tasks, and rosters can adopt stored identities incrementally.

**Verification**

- The same identity snapshot looks consistent in team preview, Stage, roster, and task cards.
- State changes modify only the state overlay.
- Reduced-motion mode disables ambient avatar movement.
- Snapshot tests or structural assertions cover every identity layer without relying on pixel-perfect output.

## Task 4: project-intent API

**PerkOS API files**

- Add `src/routes/projectIntents.ts`.
- Add `src/services/projectIntents.ts`.
- Add `src/services/sparkyProjectIntake.ts`.
- Modify `src/server.ts` to mount the authenticated router.
- Add `tests/projectIntentsRoutes.test.ts`.
- Add `tests/sparkyProjectIntake.test.ts`.
- Extend `tests/loggingRedaction.test.ts`.

**Endpoints**

- `POST /project-intents`: create a wallet- and optional organization-scoped draft.
- `GET /project-intents/:id`: read only an intent owned by the authenticated account.
- `POST /project-intents/:id/messages`: add one user turn and return Sparky's reply plus a proposed structured patch.
- `PUT /project-intents/:id`: accept an explicitly reviewed patch using `expectedRevision`.
- `POST /project-intents/:id/confirm`: freeze the reviewed intent and selected template recommendation.

**Implementation notes**

1. Reuse the existing LLM adapter, but give Sparky a project-intake-specific system prompt and strict structured-output validator.
2. Store the conversation transcript separately from the canonical intent.
3. Apply proposed structured patches only after validation. User confirmation is required before moving to `confirmed`.
4. Make every write revision-checked and idempotent.
5. Enforce owner and organization boundaries on every read and write.
6. Redact intent content from ordinary logs. Record identifiers, latency, result state, model, and token usage only.
7. Rate-limit message turns and cap transcript, field, and total payload sizes.

**Failure behavior**

- If the model fails, keep the user's turn and allow retry without duplicating it.
- If structured extraction fails, Sparky may return conversational text but cannot modify the canonical intent.
- If a template disappears before confirmation, return a recoverable conflict and request a new recommendation.
- If an account changes, the old draft becomes inaccessible immediately.

## Task 5: Sparky-first project intake UI

**PerkOS App files**

- Add `app/(app)/projects/new/sparky/page.tsx`.
- Add `app/components/SparkyProjectIntake.tsx`.
- Add `app/components/ProjectIntentReview.tsx`.
- Add `app/lib/projectIntents.ts`.
- Modify `app/components/NewProjectWizard.tsx`.
- Modify `app/(app)/projects/new/page.tsx`.
- Add localized strings to `app/i18n/locales/*.json`.
- Add `tests/SparkyProjectIntake.test.tsx`.
- Add `tests/ProjectIntentReview.test.tsx`.

**Implementation notes**

1. Make `/projects/new` lead with two clear choices: “Tell Sparky what you need” and “Browse templates”. Sparky is primary, not mandatory.
2. The intake view contains Sparky, a focused transcript, suggested prompts, composer, and a live intent summary.
3. Sparky asks one useful question at a time and visibly separates confirmed facts from assumptions.
4. Autosave only server-confirmed revisions; never store sensitive drafts in shared browser storage.
5. The review screen permits editing every canonical field before confirmation.
6. Resuming a draft loads by authenticated intent ID; switching accounts clears all in-memory state.
7. Network and model failures preserve typed input and show a retry path.

**Verification**

- A user can complete the flow using keyboard and screen reader labels.
- Repeated submit clicks create one turn.
- Refresh resumes the server draft without leaking it to another wallet.
- Sparky cannot mark generated assumptions as user-confirmed.

## Task 6: template recommendation and complete team preview

**PerkOS App files**

- Add `app/components/TemplateRecommendation.tsx`.
- Add `app/components/ProjectTeamPreview.tsx`.
- Add `app/components/RoleAccessSummary.tsx`.
- Modify `app/components/ProjectTemplateWizard.tsx`.
- Modify `app/components/TeamTemplateCard.tsx` only if the existing card can share the preview primitives without expanding its responsibility.
- Add `tests/TemplateRecommendation.test.tsx`.
- Add `tests/ProjectTeamPreview.test.tsx`.
- Extend `tests/ProjectTemplateWizard.test.tsx`.

**Implementation notes**

1. Show why the template fits the reviewed intent, not only a template name.
2. Show all proposed roles before project creation with persistent avatar, responsibility, readable access summary, actions, and escalation behavior.
3. Avoid security jargon in the primary card; expose exact scopes and node types in an expandable detail.
4. Let the user accept the recommendation, browse alternatives, or return to Sparky.
5. Do not allow role-policy editing in Phase 1. Customization comes after policy enforcement exists.

**Verification**

- Preview order is stable across reloads.
- A role with no preset still receives a deterministic identity.
- Mobile layouts retain role, access, and escalation meaning without horizontal scrolling.

## Task 7: atomic project creation from confirmed intent

**PerkOS API files**

- Modify `src/routes/projectTemplates.ts`.
- Modify `src/services/projectIntentSchema.ts` and `src/services/projectIntents.ts`.
- Extend `tests/projectTemplatesRoutes.test.ts`.
- Extend `tests/projectIntentsRoutes.test.ts`.

**PerkOS App files**

- Modify `app/components/ProjectTemplateWizard.tsx`.
- Modify `app/components/ProjectTemplateConfiguration.tsx`.
- Modify `app/lib/projectIntents.ts`.
- Extend `tests/ProjectTemplateWizard.test.tsx`.

**Implementation notes**

1. Project creation accepts `intentId`, `intentRevision`, `templateId`, `templateRevision`, and the existing request ID.
2. In one Firestore transaction, validate ownership and confirmed status, create the project and immutable configuration snapshot, and mark the intent `consumed` with its project ID.
3. The server derives the team, policy, and avatar snapshots from the published template; the client cannot author them.
4. A retry with the same request ID returns the same project. A consumed intent cannot create a second project.
5. Existing template creation without an intent remains temporarily supported behind the current contract until migration telemetry shows it can be retired.

**Verification**

- Lost-response retry is idempotent.
- Concurrent creates from one intent produce exactly one project.
- Foreign, stale, unconfirmed, or already-consumed intents are rejected without partial writes.
- The resulting project page can render the original intent and team snapshots after later template changes.

## Task 8: onboarding routing and controlled rollout

**PerkOS App files**

- Modify `app/components/AccountProfileWizard.tsx`.
- Modify `app/continue/page.tsx` only if post-auth routing cannot be expressed by the existing account-onboarding response.
- Modify `app/components/ChatbotPanel.tsx` so its “new project” action enters the Sparky flow.
- Modify `app/i18n/locales/*.json`.
- Add or extend `tests/AccountProfileWizard.test.tsx`, `tests/LandingAutoRoute.test.tsx`, and `tests/ChatbotPanel.test.tsx` if present; otherwise add focused routing tests.

**PerkOS API files**

- Add a server-side feature flag or allowlist check to the project-intent routes.
- Add metrics for intake starts, confirmed intents, accepted recommendations, project creation, abandonment, failures, and average number of turns.

**Implementation notes**

1. Complete required account profile fields first, then route first-project users to Sparky.
2. Returning users are never forced through Sparky; they can open the dashboard and start the flow voluntarily.
3. Roll out first to internal accounts, then selected beta accounts, then all eligible users.
4. Keep the current direct project and template routes as rollback paths throughout the beta.

**Verification**

- New-account and returning-account routing tests cover wallet changes and incomplete profiles.
- Disabling the flag hides the new entrypoint without making existing drafts or projects unreadable.
- Analytics contain no transcript or canonical intent content.

## Recommended pull-request sequence

Keep changes reviewable and deployable in this order:

1. **API contract PR:** schemas, template team policies, deterministic avatar identity, migrations, no route behavior change.
2. **App identity PR:** avatar generator/component and compatibility adapter.
3. **API intent PR:** authenticated intent routes, Sparky extraction, storage, logs, and tests behind a disabled flag.
4. **App intake PR:** Sparky conversation and review UI behind the same flag.
5. **App preview PR:** recommendation, role access summaries, and team preview.
6. **Cross-repository creation PRs:** atomic consumption and project snapshot rendering.
7. **Rollout PR:** onboarding routing, metrics, locale completion, and beta allowlist.

Do not mix Phase 2 encryption or knowledge retrieval into these PRs. Phase 1 policy is data to display and snapshot, not an authorization promise.

## End-to-end acceptance test

Using a fresh beta wallet:

1. sign in and complete the required profile;
2. arrive at the Sparky project-intake entrypoint;
3. describe a small-business outcome in plain language;
4. answer Sparky's clarifying questions;
5. review confirmed facts, assumptions, success criteria, and constraints;
6. receive a relevant template recommendation;
7. inspect every proposed agent, persistent avatar, role, access summary, and escalation rule;
8. confirm and create the project once;
9. open the project and see the same intent, team order, identities, policies, and template revision;
10. refresh, switch accounts, retry the final request, and verify isolation and idempotency;
11. confirm that no agent runtime started and no knowledge was decrypted or disclosed.

## Release gates

- App and API unit/integration suites pass.
- App typecheck, lint, and production build pass.
- API typecheck, lint, and build pass.
- Firestore security review confirms all intent reads and writes are server-mediated.
- Threat review covers cross-tenant reads, prompt injection into structured extraction, stale revisions, replay, excessive payloads, and log leakage.
- English and Spanish copy receive product review; remaining supported locales have no missing keys.
- Beta metrics and rollback path are confirmed before enabling the feature in production.
