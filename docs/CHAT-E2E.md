# Chat E2E checklist

Smoke test for the multi-agent chat flow after the PerkOS-Chat server,
the 3 demo agents, and the MiniApp chat branches have shipped.

Companion to [E2E-CHECKLIST.md](./E2E-CHECKLIST.md) (workspace flow)
and the [PerkOS-A2A demo provisioning playbook](https://github.com/PerkOS-xyz/PerkOS-A2A/blob/main/docs/demo-setup.md).

Estimated time: **20–30 min** for the happy path, **45–60 min** with edge
cases.

## Prerequisites

Confirm each one is green before starting. Each `curl` should print
`"ok":true`.

```bash
# Transport
curl https://transport.perkos.xyz/health

# Chat
curl https://chat.perkos.xyz/health

# Demo agents (run on the agent host)
./PerkOS-A2A/scripts/demo/verify.sh
```

MiniApp on `app.perkos.xyz` (or local `npm run dev`) — the chat
branches (#3 → #7) must be merged or running locally.

Have ready: a whitelisted wallet (the dev address you've been signing
in with), and the wallet's seed phrase or passkey.

## 1. Sign-in + sidebar boot

- [ ] Open the MiniApp in a clean incognito window
- [ ] Connect wallet → land in `/dashboard`
- [ ] Navigate to `/chat`
- [ ] **Sidebar renders** with "No conversations yet" empty state
- [ ] **Live badge** in the header reads `Live` within 3 seconds
- [ ] DevTools → Network → WS shows one connection to
      `wss://chat.perkos.xyz/chat` returning `auth_ok`

If the badge stays on `Authing` more than 10 seconds, the chat server
is rejecting the Firebase ID token. Check the chat container logs.

## 2. Create a DM

- [ ] Click **+ New** in the sidebar
- [ ] Dialog opens with kind=DM pre-selected
- [ ] Three agents listed (apollo, builder, qa) with status `ready`
- [ ] Pick `apollo` → sidebar updates to show selection
- [ ] (Optional) type a title; otherwise auto-generates `apollo`
- [ ] Click **Start conversation**
- [ ] URL changes to `/chat/<uuid>` and the conv appears at the top of
      the sidebar
- [ ] Header reads the conv title + `apollo · agent` line
- [ ] Composer is enabled

## 3. First exchange

- [ ] Type `hola apollo` → press Enter
- [ ] Optimistic bubble appears immediately on the right with
      `sending…`
- [ ] Within 1 second: the `sending…` label disappears
- [ ] Within 5 seconds: Apollo's reply appears on the left (Hermes
      processing time varies)
- [ ] The reply renders Markdown if Apollo used any (code fences,
      bullets, etc.)
- [ ] DevTools → Application → IndexedDB → `perkos-chat-cache` →
      `messages` shows both messages stored

## 4. Scroll-back history

- [ ] Send 10 more messages back and forth (anything works — `ping`
      / `pong` is fine)
- [ ] Refresh the page (`Cmd+R`)
- [ ] Conversation re-opens with **all** messages visible (cache
      hydrates first, then live history overwrites)
- [ ] When > 50 messages exist: **Load older messages** button shows
      at the top
- [ ] Click it — older page appends above; scroll position is
      preserved

## 5. Multi-agent channel

- [ ] **+ New** → switch to **Channel** mode
- [ ] Multi-select apollo + builder + qa
- [ ] Title: `#growth-q4`
- [ ] Submit
- [ ] Open the new channel
- [ ] Send `apollo, please draft a project plan and ask builder to scaffold`
- [ ] Apollo should:
  - reply in the same channel with a plan summary
  - delegate via A2A `task` to builder (visible in
    `transport.perkos.xyz` logs)
- [ ] Builder either responds in chat (if configured to forward
      results) or completes the task silently — both are valid for
      the demo
- [ ] All three identities show as `participants` in the conv doc
      (DevTools → Firestore → `/wallets/<addr>/conversations/<id>`)

## 6. Pin / archive / rename / delete

- [ ] Hover a conv row → click the `⋯` menu
- [ ] **Pin** → row moves to the Pinned section
- [ ] **Unpin** → row returns to Recent
- [ ] **Rename** → dialog opens with current title pre-filled, save
      changes → sidebar updates live (no refresh)
- [ ] **Archive** → row disappears from Recent. Expand the
      `Archived ▾` section at the bottom → it's there
- [ ] **Unarchive** from inside the archived section → returns to
      Recent
- [ ] **Delete** → confirm dialog → conv vanishes; navigating to
      `/chat/<id>` shows the Not Found state

## 7. Offline banner + cache fallback

- [ ] Open a conv with history (apollo's DM is fine)
- [ ] On the agent host: stop the apollo process
      (`systemctl stop perkos-apollo` or kill the docker container)
- [ ] Wait up to 90 s (Transport / Chat heartbeat timeout)
- [ ] Refresh the conv
- [ ] **Amber banner** appears: `Host agent (apollo) is offline.
      Showing locally-cached messages.`
- [ ] Cached messages are visible and scrollable
- [ ] Send a new message — bubble queues with `sending…`; will
      deliver when apollo restarts (test by restarting and watching
      the bubble update)
- [ ] Restart apollo → banner disappears within 30 s, queued message
      delivers

## 8. Reconnect resilience

- [ ] Open a conv, send a message — confirm round trip
- [ ] DevTools → Network → toggle **Offline**
- [ ] Live badge flips to `Connecting`
- [ ] Composer disabled with `Reconnecting to chat…`
- [ ] Toggle back **Online**
- [ ] Live badge returns to `Live` within 3 s
- [ ] Composer re-enables
- [ ] Send a message — works

## 9. Multi-device / multi-tab

- [ ] Open the same conv in two tabs
- [ ] Send from tab A
- [ ] Tab B receives the message live (within 1 s)
- [ ] Edit the title from tab A
- [ ] Tab B's header updates live (Firestore onSnapshot)

## 10. Privacy invariant (manual)

- [ ] Firestore console → `/wallets/<addr>/conversations/<id>/messages`
      → confirm the collection **does not exist**
- [ ] Same path with `/messages/anything` → try to manually `getDoc`
      from the Firestore console: write should be **denied** by
      rules
- [ ] On the agent host:
      `cat ~/.perkos/conversations/<id>/messages.jsonl` → confirm the
      message bodies live here, plaintext

## Failure-mode shortcuts

| Symptom | What to check first |
|---|---|
| Sidebar shows no agents in the picker | `getWalletAgents` returns empty; have you actually created agents in the workspace, not just in the demo? Either provision via the in-app launcher OR seed `/wallets/<addr>/agents` manually |
| Send button stays disabled with "Authing" | Chat server rejected the Firebase token — likely a project ID mismatch between MiniApp and chat env |
| Apollo never replies in chat | Hermes isn't pointed at the bridge's `/chat/reply` endpoint. See `docs/chat-client.md` in PerkOS-A2A |
| Banner shows even when agent is up | Either Chat's `RELAY_API_KEYS` is stale (re-issued keys not yet picked up) or the agent's WS keeps dropping — check agent logs |
| Optimistic bubble stays forever | The server isn't echoing the `send` back as `chat_message` — most likely the conv doc has wrong participants (the user identity must be present) |

## Reset state between runs

```js
// In the MiniApp browser console:
// Wipe IndexedDB cache for this device
indexedDB.deleteDatabase("perkos-chat-cache");

// Wipe sidebar drafts / local state
Object.keys(localStorage)
  .filter(k => k.startsWith("swarm."))
  .forEach(k => localStorage.removeItem(k));
```

```bash
# On the agent host — wipe per-conv JSONL stores
rm -rf ~/.perkos/conversations/<convId>
```

## Done criteria

You can declare the demo ready when:

1. Steps 1–6 all pass on a clean browser session
2. Step 7 passes (banner appears AND disappears appropriately)
3. Step 8 passes (network toggle survived)
4. Step 9 passes (two tabs mirror within 1 s)
5. Step 10 passes (Firestore has no `/messages` subcollection;
   agent disk has the jsonl)

Capture screenshots of:
- Sidebar with mixed Pinned + Recent + Archived
- A DM with Apollo (showing markdown reply)
- The multi-agent channel with all three identities responding
- The amber offline banner

Those four shots are the demo asset for the announcement post.
