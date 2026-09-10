# Account onboarding and Artizen project templates

Status: implementation authorized, not deployed. Design input: Julio and a three-round discussion with Venus on Grow (2026-09-07); conceptual feedback, not Artizen endorsement or runtime certification.

## Boundaries

Account onboarding collects a display name, optional username, language, time zone and optional X/Instagram/TikTok/website links. It never creates an organization, project, agent, paid task or social connection. Authenticated server persistence is account-scoped; browser state must not bleed between wallets. Old onboarding URLs redirect to the account flow. Settings edits the same record. Save on explicit step transitions, not every keystroke; no LLM calls.

Project onboarding is separate: select a published project template, complete its versioned questions, review, create a project. PerkOS-Admin owns template drafts and publication. Templates are data, not executable code. Published revisions are immutable; existing projects retain a snapshot. Agent templates and MiniPay templates remain distinct. Server authorization and validation are authoritative.

## Artizen v1

One Hermes role per project. Required project URL (https://artizen.fund/index/p/<slug>), project name and concise confirmed description. Content language may differ from UI language. Sharing channel and writing sample optional. URL is not ownership proof and is not fetched automatically. One creator can own several independent projects.

Three available actions: prepare an update, revise, save an approved version. The recurring notes question is not part of initial onboarding. Approval/copy is not publication. No automatic posting, outreach, funding search, other agents, voice or social OAuth.

Agent instructions preserve creator voice, prohibit invented feelings/progress and unsupported Artizen mechanics. One clarification at most; unresolved facts stay outside copy-ready text. Empty input produces no generation. Remember only confirmed project context, explicit corrections and a bounded set of approved examples; distinguish working memory from chat retention/backups. Show editable working memory, an optional "doesn't sound like me" signal (not training consent), and an exit clearing only the data promised.

## Execution boundary

Account and template form configuration must work without launching a runtime. Runtime activation remains explicit and gated until provisioned SOUL.md, operational instructions, the versioned skill, isolated context, durable task results and budget admission are tested. A soul promise is not a permission or budget control. Don't publish a template as ready-to-run merely because its form works.

Creator notes → budget admission → one durable run → Hermes → persist draft → human review. Reminders are external to sleeping agents; no input means no LLM call. No runtime waits awake for human review. Scheduling, webhook deduplication/recovery and provider-budget enforcement need a separate verified increment before recurring activation. The existing PM planning approval must not be mistaken for approval of public copy.

## Delivery sequence and acceptance

1. Account API + short multilingual wizard + settings + safe post-auth routing. Test missing/expired auth, cross-account access, invalid social URLs/time zones, resume, errors and wallet-switch races.
2. Admin project-template draft editor/preview/publication + API schema/versioning + App wizard and persisted project configuration. Test malformed schemas, non-admin writes, concurrent edits, unpublished templates, stale versions, optional fields and snapshot isolation.
3. Artizen Hermes package and task/review/memory UI. Test factual uncertainty, corrections, skip, isolation, long completion/reload, approved-vs-published, deletion semantics and idle cost. Only then enable a bounded internal Dev pilot.

Feature branches from development for App/API. Admin currently has only main: isolated feature from its latest main, no automatic production deployment. QA/production promotion requires review after Dev evidence. No secrets or internal monetary budgets in this public repository.
