# Development E2E hardening

## Objective

Preserve the successful Development product E2E while removing three risks
observed during the run: duplicate agent identities during ECS deployments,
plaintext Platform Tools JWTs in task definitions, and contradictory agent
status labels in the App.

## Architecture

Agent services use replacement deployments with `minimumHealthyPercent: 0`
and `maximumPercent: 100`. An agent name is a singleton relay identity, so a
brief drain-before-start is safer than overlapping revisions that repeatedly
evict each other from Transport and Chat.

The API stores the Development Platform Tools signing secret in Secrets
Manager. ECS receives only its ARN and injects the value into the bridge with
`containerDefinitions[].secrets`; the plaintext must not appear in the task
definition or provision job. Platform Tools on the VPS reads the same secret
from its protected env until its own runtime supports Secrets Manager.

The App derives the current lifecycle presentation from one live-status model.
Historical timestamps remain history and must not imply current hibernation.
Relay-connected agents should not claim to lack provisioning merely because
they do not expose a direct endpoint.

## Error handling and compatibility

Production keeps its current behavior until the same secret exists and the
new code is promoted. Development fails closed when Tools is enabled without a
valid secret reference. Existing agents are updated idempotently through a new
task-definition revision. Rollback consists of restoring the prior env/compose
backups and reprocessing the same provision job.

## Verification

Unit tests cover ECS deployment configuration, secret injection, absence of a
plaintext JWT, and status presentation. Development smoke verification checks
one running revision, stable relay registration, MCP on port 5071, a completed
board task, hibernation, and ECS `0/0/0`.
