# PerkOS MiniApp — Backend Contract

This is the contract the MiniApp expects from its backend. The current REST
implementation is at `process.env.NEXT_PUBLIC_PERKOS_API_URL` (defaults to
`https://nexus-api.perkos.xyz/api`). When migrating to Firebase Functions /
Firestore, preserve the request / response shapes below or update the client
in lockstep.

All paths in this doc are relative to that base URL.

## Conventions

### Identity

The wallet address is the identity. Every wallet-scoped endpoint is mounted
under:

```
/wallets/{walletAddress}
```

There is no auth header today. When Firebase Auth lands, the client will send
`Authorization: Bearer <idToken>` and the backend must validate that the
`walletAddress` segment matches a claim on the token.

### Response envelope

Success:

```json
{
  "data": <payload>
}
```

Some legacy endpoints (notably `/assistant/chat`) may return the payload at
the top level — the client normalizes via `payload.data ?? payload`. New
endpoints should always use the `data` envelope.

Error:

```json
{
  "error": "human-readable message"
}
```

`response.ok === false` triggers the client to throw `new Error(error)`. Set
the HTTP status to something appropriate (400 / 404 / 409 / 500) so React
Query treats it as a failed mutation/query.

### Encoding

All path segments containing wallet addresses, project ids, task ids, or
agent ids are `encodeURIComponent`'d on the client. The server should
`decodeURIComponent` them.

---

## Endpoints

### Overview

```
GET /wallets/{walletAddress}/overview
```

Aggregated dashboard data.

**Response** (`data`):

```ts
{
  stats: {
    activeProjects: number;
    registeredAgents: number;
    activeTasks: number;
    completedTasks: number;
  };
  projects: Project[];   // see Project type below
  tasks: Task[];         // recent tasks across projects
}
```

---

### Projects

#### List

```
GET /wallets/{walletAddress}/projects
```

**Response**: `{ projects: Project[] }`

#### Create

```
POST /wallets/{walletAddress}/projects
```

**Request**:

```ts
{
  name: string;
  goal: string;
  budget?: string;        // defaults to "0 USDC"
  agentIds?: string[];    // defaults to []
}
```

**Response**: `{ project: Project }`

#### Read one

```
GET /wallets/{walletAddress}/projects/{projectId}
```

**Response** (`ProjectDetail`):

```ts
{
  project: Project;
  tasks: Task[];
  messages: ChatMessage[];
}
```

#### Update

```
PATCH /wallets/{walletAddress}/projects/{projectId}
```

**Request**: partial of `{ name, goal, status }`.

**Response**: `{ project: Project }`

#### Delete

```
DELETE /wallets/{walletAddress}/projects/{projectId}
```

**Response**: 200/204 with no body.

#### Start project

```
POST /wallets/{walletAddress}/projects/{projectId}/start
```

Kicks off scheduled work. No body required.

**Response**:

```ts
{
  tasks: Task[];
  messages?: ChatMessage[];
}
```

---

### Tasks

Tasks live under a project.

#### Create (bulk)

```
POST /wallets/{walletAddress}/projects/{projectId}/tasks
```

**Request**:

```ts
{
  tasks: Array<{
    name: string;
    priority?: "High" | "Medium" | "Low";
    agent?: string;        // display name, "App Agent" if omitted
    prompt?: string;       // long-form description fed to the agent
  }>;
}
```

**Response**: `{ tasks: Task[] }`

#### Update

```
PATCH /wallets/{walletAddress}/projects/{projectId}/tasks/{taskId}
```

**Request**: partial of `{ name, priority, agent, prompt, status }`.

`status` accepts the literal strings `Backlog`, `In progress`, `Review`,
`Done`.

**Response**: `{ task: Task }`

#### Delete

```
DELETE /wallets/{walletAddress}/projects/{projectId}/tasks/{taskId}
```

**Response**: 200/204 with no body.

---

### Project chat

#### Post message

```
POST /wallets/{walletAddress}/projects/{projectId}/messages
```

**Request**:

```ts
{
  text: string;
  from?: "user" | "agent";   // defaults to "user"
}
```

**Response**: `{ message: ChatMessage }`

History is returned as part of `GET /projects/{projectId}` (the
`ProjectDetail.messages` array). When Firestore lands, swap to real-time
subscriptions on the messages subcollection.

---

### Agents

#### List

```
GET /wallets/{walletAddress}/agents
```

**Response** (`data`): `Agent[]` (no envelope around the array).

#### Launch (a.k.a. register)

```
POST /agent-launches
```

Note: **not** under `/wallets/{walletAddress}` — the wallet address is part
of the body. The response is also top-level (no `data` envelope) for legacy
reasons.

**Request**:

```ts
{
  walletAddress: string;
  runtime: "Hermes" | "OpenClaw";
  name: string;
  plugins?: string[];
  modelKey?: string;      // only when BYOK is selected
}
```

**Response** (`LaunchAgentResponse`):

```ts
{
  ok: boolean;
  launchId: string;
  result: {
    mode?: string;
    status?: string;
    taskArn?: string;
    agent?: Agent;
  };
}
```

#### Update

```
PATCH /wallets/{walletAddress}/agents/{agentId}
```

**Request**: partial of `{ name, plugins }`.

**Response**: `{ agent: Agent }`

#### Delete

```
DELETE /wallets/{walletAddress}/agents/{agentId}
```

**Response**: 200/204 with no body.

---

### Assistant chat (PerkOS Agent + 1-on-1)

#### Buffered (default)

```
POST /assistant/chat
```

**Request**:

```ts
{
  walletAddress: string;
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  agentId?: string;   // when chatting with a specific agent, omitted for the meta-assistant
}
```

**Response**:

```ts
{
  reply: string;
  agent?: { id?: string; name?: string; runtime?: string };
}
```

#### Streaming (preferred when available)

Same endpoint, with `Accept: text/event-stream` and `stream: true` in the
body. The server should respond with `Content-Type: text/event-stream` and
write SSE frames:

```
data: {"chunk":"Hello"}

data: {"chunk":" world"}

data: {"reply":"Hello world","agent":{"id":"…","runtime":"Hermes"}}

data: [DONE]
```

The client (`assistantChatStream`) parses both `chunk` and `reply` fields,
and falls back to the buffered shape if the server ignores the streaming
header.

---

### Access requests (alpha gate)

```
POST /api/request-access
```

Served by the MiniApp itself (Next.js route handler), not the PerkOS API.
Forwards request access form submissions to whatever side channel is wired
(currently logs server-side / sends an email).

**Request**:

```ts
{
  walletAddress: string;
  email: string;
  name?: string;
  useCase?: string;
}
```

**Response**: 200 on success, `{ error: string }` otherwise.

---

## Type reference

These shapes live in `app/lib/perkosApi.ts` and are the canonical client
contract.

### Project

```ts
type Project = {
  id?: string;
  name: string;
  goal?: string;
  status: string;          // free-form, "Active" / "Paused" / etc.
  agents: number;
  tasks: number;
  budget: string;
  agentIds?: string[];
  createdAt?: string;
  updatedAt?: string;
};
```

### Task

```ts
type TaskStatus = "Backlog" | "In progress" | "Review" | "Done";

type Task = {
  id?: string;
  name: string;
  status: TaskStatus | string;
  priority: "High" | "Medium" | "Low" | string;
  agent: string;           // display name
  agentId?: string;
  prompt?: string;
  result?: string;
  logs?: string[];
};
```

### ChatMessage

```ts
type ChatMessage = {
  id?: string;
  from: "agent" | "user";
  text: string;
  agentName?: string;      // populated when from === "agent"
};
```

### Agent

```ts
type AgentRuntime = "OpenClaw" | "Hermes";

type Agent = {
  id: string;
  name: string;
  runtime: AgentRuntime;
  status: "provisioning" | "ready" | "failed" | "unknown";
  walletAddress: string;
  plugins: string[];
  taskArn?: string;
  endpoint?: string;
  createdAt?: string;
  image?: string;
  modelKeyProvided?: boolean;
};
```

---

## Firebase migration notes

When swapping the backend for Firebase:

1. **Firestore layout (suggested)**
   ```
   /wallets/{walletAddress}/projects/{projectId}
   /wallets/{walletAddress}/projects/{projectId}/tasks/{taskId}
   /wallets/{walletAddress}/projects/{projectId}/messages/{messageId}
   /wallets/{walletAddress}/agents/{agentId}
   ```

2. **Auth**: client signs a SIWE-style message → exchange for a Firebase
   custom token via a Function → use that token to authorize Firestore /
   Functions requests. The `walletAddress` in the URL must match a claim.

3. **Realtime upgrades**: project chat (`messages`) and notifications are the
   biggest wins. Swap `getWalletProject` polling for `onSnapshot`.

4. **Whitelist**: today `NEXT_PUBLIC_PERKOS_WHITELIST` env var. Move to a
   Firestore doc + read in the auth-token-exchange Function so the deny
   happens server-side.

5. **`launchAgent`** is the trickiest endpoint — it triggers infra
   provisioning (ECS task). Keep it as an HTTPS Function rather than direct
   Firestore writes.

6. **Notifications** today live in client localStorage
   (`swarm.notifications.v1`). When real, move to
   `/wallets/{walletAddress}/notifications/{id}` and subscribe via
   `onSnapshot`.

7. **Drafts** (`agent.new.v1`, `project.new.v1`, `task.new.v1`, etc.) stay
   client-local — they're UX, not data.
