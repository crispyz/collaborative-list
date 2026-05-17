# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT**: Always check this file before starting any task to ensure you follow the established patterns and conventions.

---

## Agent Behavior Directives

### Pre-Work

**Clean Before You Build:** Before structural refactors, remove dead props, unused exports, unused imports, and debug logs first. Commit cleanup separately. After restructuring, delete anything now unused.

**Phased Execution:** Never attempt multi-file refactors in a single response. Break work into explicit phases. Complete Phase 1, run verification, and wait for explicit approval before Phase 2. Each phase must touch no more than 5 files.

**Plan and Build Are Separate Steps:** When asked to "make a plan" or "think about this first," output only the plan. No code until the user says go. When the user provides a written plan, follow it exactly. If you spot a real problem, flag it and wait - don't improvise. If instructions are vague (e.g. "add a settings page"), don't start building. Outline what you'd build and where it goes. Get approval first.

**Spec-Based Development:** For non-trivial features (3+ steps or architectural decisions), enter plan mode. Use the `AskUserQuestion` tool to interview the user about technical implementation, UX, concerns, and tradeoffs before writing code. Write detailed specs upfront to reduce ambiguity. The spec becomes the contract - execute against it, not against assumptions. Strip away all assumptions before touching code.

### Understanding Intent

**Follow References, Not Descriptions:** When the user points to existing code as a reference, study it thoroughly before building. Match its patterns exactly. The user's working code is a better spec than their English description.

**Work From Raw Data:** When the user pastes error logs, work directly from that data. Don't guess, don't chase theories - trace the actual error. If a bug report has no error output, ask for it: "paste the console output - raw data finds the real problem faster."

**One-Word Mode:** When the user says "yes," "do it," or "push" - execute. Don't repeat the plan. Don't add commentary. The context is loaded, the message is just the trigger.

### Code Quality

**Write Human Code:** Write code that reads like a human wrote it. No robotic comment blocks, no excessive section headers, no corporate descriptions of obvious things. If three experienced devs would all write it the same way, that's the way.

**Don't Over-Engineer:** Don't build for imaginary scenarios. If the solution handles hypothetical future needs nobody asked for, strip it back. Simple and correct beats elaborate and speculative.

**Verify Non-Trivial Changes:** After meaningful changes (new features, refactors, bug fixes touching multiple files), run `npm run lint` before reporting completion. Skip this for trivial edits like typos or translation updates.

### Context & Edit Safety

**Context Decay Awareness:** After 10+ messages in a conversation, you MUST re-read any file before editing it. Do not trust your memory of file contents. Auto-compaction may have silently destroyed that context. After editing, re-read to confirm the change applied correctly — the Edit tool fails silently when old_string doesn't match stale context.

**Parallelize Large Tasks:** For tasks touching >5 independent files, launch parallel sub-agents instead of processing sequentially. One task per agent, use `run_in_background` for long-running work. This keeps the main context window clean and prevents context decay on large changesets.

**Tool Result Blindness:** Tool results over 50,000 characters are silently truncated to a 2,000-byte preview. If any search or command returns suspiciously few results, re-run with narrower scope (single directory, stricter glob). State when you suspect truncation occurred.

**No Semantic Search:** You have grep, not an AST. When renaming or changing any function/type/variable, you MUST search separately for: direct calls, type-level references, string literals, dynamic imports, re-exports, barrel file entries, and test files/mocks. Assume a single grep missed something.

**One Source of Truth:** Never fix a display problem by duplicating data or state. One source, everything else reads from it.

### Self-Improvement & Debugging

**Bug Autopsy:** After fixing a bug, explain why it happened and whether anything could prevent that category of bug in the future. Don't just fix and move on.

**Failure Recovery:** If a fix doesn't work after two attempts, stop. Read the entire relevant section top-down. Figure out where your mental model was wrong and say so. If the user says "step back" or "we're going in circles," drop everything. Rethink from scratch. Propose something fundamentally different.

**Autonomous Bug Fixing:** When given a bug report: just fix it. Don't ask for hand-holding. Trace logs, errors, failing tests - then resolve them. Zero context switching required from the user.

**Learn From Corrections:** After any correction from the user, save the pattern as a feedback memory so the same mistake doesn't repeat in future conversations.

---

## Git Conventions

### Commit Messages

All commits **must** use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>: <short description>
```

**Types:** `feat` (new feature), `fix` (bug fix), `refactor`, `chore`, `docs`, `test`, `perf`, `ci`, `style`

```bash
# ✅ CORRECT
git commit -m "feat: add CSV export for articles"
git commit -m "fix: article filter not persisting across navigation"
git commit -m "refactor: convert supplier table from Flowbite to shadcn"

# ❌ WRONG
git commit -m "updated stuff"
git commit -m "WIP"
git commit -m "Fix bug"
```

**Rules:**

- Imperative mood: "add feature" not "added feature"
- Lowercase description, no period at end
- First line under 72 characters
- Breaking changes: append `!` after type (e.g., `feat!: redesign navigation`)

---

## Project Context

This is the **technical home task**: a collaborative real-time to-do list application. The goal is a **polished, stable, product-like submission** demonstrating full-stack capability, not a superficial implementation of every possible feature.

### Required Stack (non-negotiable)

- **Database:** PostgreSQL
- **Language:** TypeScript
- **Frontend Framework:** React
- **Backend:** Node.js

### Repository Layout

Monorepo structure (already scaffolded):

```
collaborative-list/
  apps/
    web/       # React / Next.js frontend
    api/       # Node.js backend API + WebSocket server
  packages/
    db/        # Prisma schema and database client
    shared/    # Shared TypeScript types and validation schemas
```

### Recommended Stack

**Backend:** Node.js + TypeScript + Express/Fastify + Prisma + PostgreSQL + WebSocket/Socket.IO + Zod
**Frontend:** React/Next.js + TypeScript + TanStack Query + WebSocket client + Tailwind/shadcn + dnd-kit (if drag & drop)

### Chosen Implementation Scope

**Primary stories (must be implemented well, stable, deployed):**

1. **Create to-do items** — title, validation, immediate UI feedback.
2. **Multiple lists with unique shareable URLs** — independent lists, each with its own URL/state/ownership.
3. **Real-time collaboration** — create/edit/delete/complete/reorder broadcasts to all users on the same list without refresh; scoped per list.
4. **PostgreSQL persistence** — lists, todos, completion, price, order, freeze state all survive restart.
5. **Mark items as done** — toggle state, visually distinct, persisted, broadcast.
6. **Filter active/done/all** — view-only filter, does not mutate data.
7. **Freeze/unfreeze list (owner-only)** — owner identified via `ownerToken` in localStorage (no full auth); non-owners blocked from mutation when frozen; broadcast.
8. **Price/cost per task** — optional numeric; **store as integer cents** to avoid float issues; persisted, broadcast.
9. **Aggregate total cost per list** — UI shows total, updates real-time on any mutation; optionally split active vs all.

**Bonus scope (only after primary stories are stable):**

- **Drag & drop ordering** — `position` field per todo, `dnd-kit` on frontend.
- **Subtasks** — start with one level (title, done, optional price). Recursive aggregation only if core is solid. **Skip infinite nesting.**
- **Aggregate subtasks into parent** — parent shows own price, subtask total, or combined.

### Intentionally Out of Scope

Do not implement these without explicit user direction — they were deliberately cut to keep the submission focused:

- Infinite nested subtasks
- Markdown rich-text descriptions
- Real-time cursor / text selection collaboration
- Special typed items (`work-task`, `food`)
- Offline editing with reconnect sync
- VR / 3D multi-list browsing
- Drag-converting subtasks to root tasks

### Real-Time Event Shape

Reference contract for WebSocket events:

```ts
type RealtimeEvent =
  | { type: 'todo.created'; listId: string; item: TodoItem }
  | { type: 'todo.updated'; listId: string; item: TodoItem }
  | { type: 'todo.deleted'; listId: string; itemId: string }
  | { type: 'todo.reordered'; listId: string; items: TodoItem[] }
  | { type: 'list.frozen'; listId: string }
  | { type: 'list.unfrozen'; listId: string };
```

### Key Implementation Constraints

- **Money:** integer cents in DB. Format on display only.
- **Ownership:** `ownerToken` per list, stored client-side; no full auth.
- **Real-time scope:** events broadcast only to clients subscribed to that `listId`.
- **Persistence:** every state-changing operation must survive server restart — no in-memory-only state for primary stories.

### Coding Rules

- **TypeScript strict mode everywhere** — `strict: true` in every `tsconfig.json`. No `any` escape hatches without a written reason.
- **Business logic lives in the API/server layer.** The frontend renders state and dispatches intents; it does not own rules (validation, freeze enforcement, aggregation logic).
- **Validate every API input with Zod** at the route boundary. Infer TS types from the Zod schemas — schemas are the source of truth for request shapes.
- **Prisma access stays in `apps/api` services.** No Prisma imports from `apps/web` or shared packages. The frontend talks HTTP/WebSocket, never the DB.
- **No new dependencies unless they clearly reduce complexity.** Prefer the standard library and what's already installed. If a dep is added, justify it in the commit message.
- **Always use the latest stable version of every dependency.** Do not pin a version remembered from training data — it will be months or years out of date. Before adding or bumping a package, check the current latest with `npm view <pkg> version` (or the package's official docs/changelog). Outdated pins create silent technical debt, miss security/perf fixes, and diverge from documented APIs. "Latest stable" means the latest non-prerelease tag; do not pin betas or RCs without a reason.
- **PostgreSQL is the single source of truth.** Real-time events are _notifications_ that state changed — never the canonical state. Clients reconcile by refetching or by applying events to a server-confirmed baseline; they must tolerate missed/duplicate events.
- **Mutation → persist → broadcast.** Every state-changing API handler must (1) write to PostgreSQL, (2) only then emit the corresponding WebSocket event to the list's room. Never broadcast before the DB commit.
- **Freeze enforcement is server-side.** Every mutation handler checks `list.frozen` and `ownerToken` and rejects on mismatch. The UI may _also_ disable controls when frozen, but the UI is not the gate — a bypassed client must not be able to mutate a frozen list.

### Submission Requirements

- Hosted/running app URL
- Source repo URL (kept private after review)
- `README.md` listing implemented stories
- Position the README as a deliberate focused submission, not a partial attempt at everything

### Plan-Of-Attack Order

Build in this order so each step is demoable and the primary scope is always shippable:

1. **Foundation:** Prisma schema (List, TodoItem with position/priceCents/isDone, freeze fields, ownerToken), DB migrations, shared types in `packages/shared`.
2. **API CRUD:** Create/get list, CRUD todos, freeze/unfreeze (gated by ownerToken). Zod validation at the boundary.
3. **Frontend basics:** List page at `/lists/[id]`, create-list flow, render todos, create/toggle/delete/edit todo, price input, filter tabs, total cost display.
4. **Real-time:** WebSocket server, room-per-list, emit on every mutation, client subscribes on list mount, optimistic updates reconciled by events.
5. **Freeze flow:** Owner UI (only if localStorage has matching token), server-side enforcement on every mutation, frozen-state UI everywhere.
6. **Polish + deploy:** Empty states, loading/error feedback, deploy (Docker Compose locally, hosted target TBD), write README.
7. **Bonuses (only if 1–6 are solid):** Drag & drop with `position`, one-level subtasks, subtask aggregation.
