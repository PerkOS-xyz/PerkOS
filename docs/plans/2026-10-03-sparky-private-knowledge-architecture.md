# Sparky and private knowledge architecture

## Objective

Bring the clearest parts of PerkOS Runtime into PerkOS.xyz:

1. After sign-in, the user meets Sparky and can describe the outcome they need.
2. Sparky recommends a project template and explains the proposed team.
3. Before project creation, the user sees every agent, its role, access boundary, and persistent generated avatar.
4. The agents continue working in ECS while the user is offline.
5. Their knowledge lives on PerkOS infrastructure, encrypted per tenant and disclosed to each agent only when its role and current task allow it.

This is not a direct port of Runtime's device vault. Runtime can derive a local vault key from a wallet signature because work and storage are local. PerkOS.xyz needs durable server-side agent access, so a wallet-derived key cannot be the only decryption key.

## Recommended user experience

### 1. Sign-in and Sparky intake

The first authenticated screen is a focused conversation with Sparky, not a dashboard full of empty product areas. Sparky asks for the desired business outcome, important constraints, available data, and whether the user wants to begin from a recommended template or explore manually.

The conversation produces a structured `ProjectIntent`, not only chat text:

- goal and success criteria;
- business and project context;
- constraints, deadlines, and budget;
- suggested template and team;
- proposed knowledge sources;
- facts that require confirmation.

Sparky must distinguish confirmed facts, user preferences, assumptions, and generated recommendations. The user reviews this summary before project creation.

### 2. Template and team preview

Opening a template shows the proposed team before any agents are provisioned. Each role has:

- a plain-language responsibility;
- the knowledge it can read and create;
- actions it may perform;
- escalation conditions;
- a persistent avatar identity generated from the role and agent identity.

Reuse Runtime's avatar model: permanent identity layers (`head`, `visor`, `modules`, `pattern`, `detail`, role, accent) are stored with the agent; expression, ring, glow, and motion are runtime state. Sparky retains a distinct visual identity.

### 3. Project workspace

After creation, Stage remains the operational view and Explore becomes the living knowledge view. Sparky stays available as the user's interface for questions, approvals, knowledge corrections, and team changes. New knowledge appears with provenance and access classification, not as an unexplained AI memory.

## Knowledge model

Knowledge is stored as typed nodes and relationships rather than one undifferentiated vector store.

### Node types

- user profile and preference;
- organization policy;
- project brief;
- person, agent, and role;
- source and source snapshot;
- fact and assumption;
- decision and approval;
- task, artifact, and result;
- conversation summary;
- credential reference (never the secret value).

### Required metadata

Every node includes tenant, scope, project, classification, provenance, creator, timestamps, version, retention policy, allowed roles, and integrity hash. Relationships carry their own authorization metadata because an edge can reveal sensitive information even when node bodies remain encrypted.

Scopes are hierarchical:

1. `personal`: private to the user and Sparky unless explicitly shared;
2. `organization`: reusable organizational knowledge;
3. `project`: shared according to project roles;
4. `task`: the smallest context granted for one execution.

## Encryption and storage

Use envelope encryption with separate keys per tenant and purpose.

- AWS KMS protects a tenant Key Encryption Key.
- A random Data Encryption Key encrypts each knowledge object or bounded object group using authenticated encryption.
- Ciphertext, nonce, algorithm, key version, and authenticated metadata are stored together.
- Plaintext keys never enter Firestore, logs, container environment variables, or agent prompts.
- Key rotation re-wraps data keys without rewriting every encrypted object.
- Deleting the tenant key provides cryptographic erasure in addition to storage deletion.

Firestore can retain non-sensitive indexes, IDs, status, and authorization references. Encrypted bodies and immutable versions should live in a private, versioned S3 bucket. Search indexes must be tenant-isolated. Embeddings are sensitive derived data and require the same tenant and role filters as source content.

PerkOS servers are capable of decrypting authorized content so agents can work while the user is offline. This must be explicit in product language: encrypted at rest and in transit, with tightly controlled service-side decryption, not zero-knowledge encryption.

## Authorization model

Use RBAC for understandable template defaults and ABAC for runtime enforcement.

### Template policy

Each template revision declares roles, allowed node types, allowed scopes, actions, classifications, and escalation rules. Published policy revisions are immutable and the project retains a snapshot.

### Runtime checks

Every knowledge operation evaluates:

- tenant and organization membership;
- project membership;
- ECS task identity and agent identity;
- assigned project role;
- current task and execution ID;
- requested action;
- node type, scope, and classification;
- time-bound grant and approval state.

The default is deny. Agents have no direct KMS, S3, Firestore, or vector-database access. A `Knowledge Access Broker` authenticates the ECS workload, evaluates policy, decrypts only authorized objects, and returns a minimal context bundle.

## Exceptional access through Sparky

When an agent needs knowledge outside its normal role:

1. the broker denies the read without disclosing the protected content;
2. the agent returns a structured access request with purpose, requested scope, and expected duration;
3. Sparky explains the request to the user in plain language;
4. the user may deny it or grant a one-time, task-bound, expiring capability;
5. the broker records the decision and every use of the grant;
6. the capability expires automatically and can be revoked immediately.

There is no project-wide privilege escalation and no permanent role mutation from a one-time approval.

## Agent execution flow

1. The orchestrator assigns a task and execution ID to an ECS agent.
2. The agent authenticates with its workload identity.
3. It asks the broker for context using the execution ID and declared purpose.
4. The broker evaluates policy and retrieves candidate knowledge within tenant, project, role, and task boundaries.
5. Only selected objects are decrypted; prompt-sized excerpts and provenance are returned.
6. The agent produces artifacts and structured knowledge proposals.
7. A validation layer classifies, scans, and versions the proposals before writing encrypted knowledge.
8. Human-gated decisions remain pending until approved.
9. Audit events record requester, purpose, policy decision, objects disclosed, output references, cost, and timing without logging plaintext.

## Service boundaries

- **Sparky Gateway:** conversation, intent extraction, recommendations, and approval UX.
- **Template Service:** immutable template and role-policy revisions.
- **Agent Identity Service:** binds PerkOS agents to ECS workload identities.
- **Knowledge Access Broker:** policy enforcement, retrieval, decryption, and minimal disclosure.
- **Knowledge Store:** encrypted objects, versions, relationships, and tenant-isolated search.
- **Knowledge Writer:** validates and classifies proposed writes before persistence.
- **Audit Service:** append-only security and provenance events.

These may begin as modules inside PerkOS-API, but their contracts should remain distinct so the broker and audit path can later be isolated without changing agent behavior.

## Failure and security behavior

- KMS or policy-service failure fails closed; agents receive a retryable access error.
- An agent cannot broaden its own role or declare a different project.
- Retrieval results are always filtered before decryption and again before response construction.
- Prompt-injection content from sources remains marked as untrusted data.
- Secrets are references resolved by a separate secrets broker and never become graph nodes or embeddings.
- Cross-tenant identifiers return indistinguishable not-found responses.
- Offline work continues only within existing policy; new sensitive grants wait for the user.
- Users can inspect access history, revoke agents, export their encrypted knowledge, and request deletion.

## Delivery phases

### Phase 1: cohesive experience

Port the Sparky-first intake, structured `ProjectIntent`, team preview, and Runtime avatar identity system. Store template role policies but do not yet expose encrypted knowledge to agents.

### Phase 2: encrypted project knowledge

Introduce tenant envelope encryption, typed project nodes, provenance, versioning, the Knowledge Access Broker, ECS workload authentication, and role-filtered retrieval. Start with project scope and a small supported node set.

### Phase 3: durable autonomous memory

Add organization and personal scopes, conversation summarization, agent knowledge proposals, tenant-isolated semantic search, policy-aware graph exploration, retention, export, and deletion.

### Phase 4: sensitive-access approvals

Add Sparky-mediated requests, one-time task capabilities, approval notifications, complete audit UX, and security exercises for confused-deputy, prompt-injection, cross-tenant, and revoked-agent scenarios.

## Acceptance criteria

- A new user can describe a goal to Sparky and understand the recommended template and team before provisioning.
- The same agent has a recognizable avatar across preview, Stage, chat, task, and Explore.
- Agents continue authorized work while the user is offline.
- Two roles in one project demonstrably receive different context for the same query.
- No agent can directly access encryption keys or storage.
- Cross-tenant and cross-project access tests fail closed.
- Every decrypted disclosure has a policy decision and non-plaintext audit event.
- Revoking an agent prevents new reads immediately.
- Sensitive exceptional access is task-bound, expiring, and visible to the user through Sparky.

