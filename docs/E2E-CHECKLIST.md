# MiniApp — End-to-End Test Checklist

Run this before Firebase integration. The goal is to catch bugs while the
backend contract is well-understood, so when Firestore lands you're only
debugging the swap, not the UI.

Time budget: ~30 min for the happy path, ~60 min if you also do the edge
cases.

## Setup

```bash
cd MiniApp
rm -rf .next        # eliminate stale codegen
npm run dev
```

Open <http://localhost:3000> in a fresh incognito window. Open DevTools →
Console + Network tabs.

## Reset state between runs

In DevTools Application → Local Storage, delete keys starting with `swarm.`
to wipe drafts / saved org / notifications. Or run in console:

```js
Object.keys(localStorage)
  .filter(k => k.startsWith("swarm."))
  .forEach(k => localStorage.removeItem(k));
```

---

## 1. Landing page

- [ ] `/` renders without errors
- [ ] Hero "Launch app" button → routes to `/sign-in`
- [ ] All landing sections render (Hero, Features, How It Works, Products, Contact)
- [ ] Contact form submits → toast success / error
- [ ] No console errors

## 2. Sign-in / wallet connect

- [ ] `/sign-in` shows the connect button
- [ ] Connecting a whitelisted wallet → routes into onboarding (first time) or `/dashboard`
- [ ] Connecting a non-whitelisted wallet → shows the AccessGate
  - [ ] Email validation: empty → error after submit; invalid format → inline error
  - [ ] Successful submit → "You're on the list" confirmation card
  - [ ] "Use a different wallet" → disconnects and returns to sign-in

## 3. Onboarding

- [ ] First-time whitelisted wallet hits `/onboarding`
- [ ] Workspace step accepts a name → routes to `/onboarding/project`
- [ ] "Create project" CTA carries the `?from=onboarding` flag
- [ ] After project creation, redirects to `/onboarding/agent`
- [ ] After agent launch, redirects to `/dashboard`

## 4. Dashboard

- [ ] Stats show real counts from `/wallets/.../overview`
- [ ] **First-time empty state**: with 0 projects + 0 tasks, the
      "New here?" callout appears
  - [ ] Click "Create starter project" → toast success → "Welcome to PerkOS"
        project appears in the list with 3 demo tasks
- [ ] Workspace name from settings shows in the WorkspaceCard
- [ ] Quick actions (mobile) work
- [ ] PerkOS Agent panel (chatbot) opens from the floating trigger

## 5. Command menu (⌘K)

- [ ] `Cmd+K` (Mac) / `Ctrl+K` opens the menu
- [ ] Type → filters across nav + projects + agents
- [ ] Select a project → navigates to `/projects/{id}`
- [ ] Linear-style sequence `g p` (no modifier, focus not in input) → routes to /projects
- [ ] `c t` → routes to /tasks/new
- [ ] Esc closes the menu

## 6. Projects CRUD

### List
- [ ] `/projects` empty state shows "No projects yet" + CTA
- [ ] Search box appears when there are projects, filters by name/goal/status
- [ ] No-match state shows "No projects match X"

### Create
- [ ] `/projects/new` form validation:
  - [ ] Submit empty → inline errors on name + goal
  - [ ] Name < 2 chars → name error
  - [ ] Goal < 10 chars → goal error
  - [ ] Valid input → submits, toast success, redirects to /projects
- [ ] **Draft persistence**: type a name, navigate away to /dashboard, come back
      to /projects/new → name is still there

### Detail
- [ ] `/projects/{id}` renders header with stats, tabs, kanban
- [ ] Tab "Tasks" → kanban with the 3 demo tasks in "To do"
- [ ] Tab "Agents" → empty state if no agents, list otherwise
- [ ] Tab "Project chat" → composer + messages list

### Edit
- [ ] Pencil icon in header opens EditProjectDialog
- [ ] Name + goal pre-filled
- [ ] Empty name → inline error, submit blocked
- [ ] Save → toast "Project updated", header reflects new name

### Delete
- [ ] Trash icon in header opens ConfirmDialog
- [ ] Cancel → dialog closes, project still exists
- [ ] Confirm → toast "Project deleted", redirect to /projects

## 7. Tasks

### Create
- [ ] `/tasks/new` form validation (name, description, priority, agent, project)
- [ ] Submit valid → redirects to project detail with the new task in "To do"
- [ ] Draft persistence on this form too

### Kanban
- [ ] Drag a task from "To do" → "In progress" → optimistic move + console log
- [ ] Drag back → same
- [ ] **Keyboard nav**: Tab to drag handle (becomes visible), ArrowRight → moves to next column
- [ ] ArrowLeft on a "Done" task → moves back to "In progress"

### Edit task
- [ ] Hover task → Edit pencil + Trash appear top-right
- [ ] Click edit → EditTaskDialog with current values
- [ ] Change priority + agent → save → toast success, card updates
- [ ] Click trash → ConfirmDialog → confirm → task removed

## 8. Agents CRUD

### List
- [ ] `/agents` empty state with CTA when 0 agents
- [ ] Search filters across name, runtime, plugins

### Launcher (7 steps)
- [ ] Step 1 (Runtime): can't advance without picking Hermes or OpenClaw
- [ ] Step 2 (Hosting): self-host shows IP + SSH inputs
  - [ ] Invalid IP "999.999.0.0" → inline error
  - [ ] Invalid SSH key "abc" → inline error
- [ ] Step 3 (LLM): BYOK shows provider + key
  - [ ] OpenAI provider + key "wrong-prefix" → inline error about `sk-` prefix
  - [ ] Anthropic + non-`sk-ant-` → inline error
- [ ] Step 4 (Channels): selection optional, filters by runtime (X only on Hermes)
- [ ] Step 5 (Template): must pick one
- [ ] Step 6 (Plugins): template plugins pre-checked
- [ ] Step 7 (Summary): name pre-filled, Launch → toast, clears draft, redirects
- [ ] **Draft persistence**: get to step 4, hard-refresh → land on step 4 with state intact

### Edit
- [ ] `/agents/{id}` "Edit" button opens EditAgentDialog
- [ ] Rename → save → list reflects new name
- [ ] Add a plugin via Enter → appears as badge
- [ ] Remove a plugin via × → disappears
- [ ] Save Changes disabled when no diff vs original
- [ ] Cancel discards changes

### Delete
- [ ] Lifecycle card → Delete → ConfirmDialog → confirm → toast + redirect to /agents

## 9. Chat

### PerkOS Agent (floating)
- [ ] Trigger button opens panel
- [ ] Empty state shows quick actions
- [ ] Type a message → reply appears with Markdown rendering (test with `**bold** *italic* \`code\``)
- [ ] **Slash commands**: type `/t` → popover shows "Create task"
  - [ ] Arrow down + Enter → routes to /tasks/new
  - [ ] `/clear` → wipes the conversation
- [ ] Voice button visible when input empty, send button when not

### 1-on-1 agent chat
- [ ] `/chat/agent/{id}` loads agent header + composer
- [ ] First message starts the conversation
- [ ] Reply uses Markdown
- [ ] "Clear" button resets

### Project chat
- [ ] Tab "Project chat" inside `/projects/{id}` works
- [ ] Sending a message renders in the list

## 10. Organizations (local)

- [ ] `/organizations/new` form:
  - [ ] Invalid email → inline error
  - [ ] Invalid wallet `0xnope` → inline error
  - [ ] Valid email/wallet → adds as badge
  - [ ] × on badge removes
- [ ] Submit → toast success, routes to /dashboard
- [ ] `/organizations` shows the saved org with name + members
- [ ] × next to a member → toast "Member removed", member gone
- [ ] "Delete" → ConfirmDialog → org deleted, page shows empty state

## 11. Notifications

- [ ] Bell icon shows count badge when there are unread (start fresh: 0)
- [ ] Click bell → popover with "No notifications" empty state
- [ ] Manually add notifications via console:
  ```js
  const ns = JSON.parse(localStorage.getItem("swarm.notifications.v1") || "[]");
  ns.unshift({ id: "1", kind: "task", title: "Task done", read: false, createdAt: Date.now() });
  localStorage.setItem("swarm.notifications.v1", JSON.stringify(ns));
  window.dispatchEvent(new Event("perkos:notifications-changed"));
  ```
- [ ] Bell badge shows "1"
- [ ] Click bell → notification shown with "New" badge
- [ ] Click row → marks as read, badge disappears
- [ ] "View all" → routes to `/notifications`
- [ ] On `/notifications`, filter tabs work (All / Unread)
- [ ] "Mark all read" → toast, badges gone
- [ ] × on a row → notification disappears
- [ ] "Clear all" → ConfirmDialog → all gone, empty state

## 12. Settings

- [ ] Account section shows formatted wallet (`0xabc…1234`)
- [ ] Copy full → toast or "Copied" confirmation
- [ ] Workspace section: change name → save → toast, value persists
- [ ] Danger zone "Clear organization draft" → toast
- [ ] Danger zone "Reset onboarding state" → ConfirmDialog → toast, draft + workspace cleared
- [ ] Disconnect → routes to /sign-in

## 13. Routing edge cases

- [ ] Random URL like `/does-not-exist` → not-found page with CTAs
- [ ] Throw something inside a page (temporary `throw new Error()` in a component) → error.tsx renders
- [ ] Reset state → revisit `/projects/non-existent-id` → backend error surfaces in the inline ErrorBanner

## 14. A11y / keyboard-only

- [ ] Tab from top of page → focus visible on every interactive element
- [ ] Skip link "Skip to main content" appears on first Tab
- [ ] Sidebar nav: focused active item has `aria-current="page"`
- [ ] Kanban: Tab → drag handle visible → ArrowLeft/Right moves cards
- [ ] Dialogs: Esc closes, focus returns to trigger
- [ ] No `aria-` warnings in DevTools

## 15. Mobile (DevTools responsive @ 375px)

- [ ] Hamburger menu opens the Sheet with nav
- [ ] Bottom nav visible
- [ ] Kanban becomes single-column or scrolls horizontally without breaking
- [ ] Chat panels fit and aren't cut off
- [ ] Forms remain usable

---

## Reporting

When something fails:

1. Take a screenshot
2. Note the URL + steps to reproduce
3. Copy the console error stack
4. Flag whether it's UI-only or hits the backend (check the Network tab)

Bugs that don't touch the backend can be fixed before Firebase. Bugs that
do go on the Firebase migration punch list.
