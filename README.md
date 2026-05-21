# Collaborative List

A real-time collaborative to-do list. Multiple users open the same list URL in different browsers and see edits propagate instantly.

**Live demo:** https://collab-list-web.onrender.com (free-tier cold start ~30–50s after idle)

## Stack

- **Backend:** Node.js + TypeScript + Fastify + Prisma + PostgreSQL + WebSockets (`@fastify/websocket`)
- **Frontend:** Next.js (App Router) + React 19 + TypeScript + TanStack Query + Tailwind v4 + shadcn/ui + `dnd-kit`
- **Shared:** Zod schemas → inferred TypeScript types (single source of truth for request shapes and `RealtimeEvent`)
- **Monorepo:** npm workspaces

```
apps/
  api/     Fastify HTTP + WebSocket server
  web/     Next.js frontend
packages/
  db/      Prisma schema + client singleton (driver adapter)
  shared/  Zod schemas and shared TypeScript types
```

## Local setup

**Prerequisites:** Node ≥ 24 (pinned via `.nvmrc`) and Docker Desktop running.

```bash
# 1. Pinned Node version (uses .nvmrc → 24.15.0)
nvm use

# 2. Install dependencies (npm workspaces hoists everything)
npm install

# 3. Copy the env template
cp .env.example .env

# 4. Start PostgreSQL (Docker, container port 5432 → host 5433)
npm run db:up

# 5. Apply database migrations
npm run db:migrate

# 6. Start API + Web in one command
npm run dev
```

| Service    | Port | URL                                                 |
| ---------- | ---- | --------------------------------------------------- |
| Web        | 3001 | http://localhost:3001                               |
| API        | 4000 | http://localhost:4000 (`/health` to check liveness) |
| PostgreSQL | 5433 | `postgresql://postgres:postgres@localhost:5433/...` |

> Port 3001 instead of Next.js's default 3000 to avoid colliding with anything else on the host; same reason Postgres maps to 5433 instead of 5432.

## Scripts

### Run

| Command                           | Does                                                                  |
| --------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                     | Starts API and Web in parallel (`concurrently`, colour-prefixed logs) |
| `npm run api:dev`                 | API alone (tsx watch, :4000)                                          |
| `npm run web:dev`                 | Web alone (next dev, :3001)                                           |
| `npm run api:build` / `web:build` | Production build per app                                              |
| `npm run api:start` / `web:start` | Run the production build per app                                      |

### Database

| Command               | Does                                              |
| --------------------- | ------------------------------------------------- |
| `npm run db:up`       | `docker compose up -d` (starts Postgres)          |
| `npm run db:down`     | `docker compose down`                             |
| `npm run db:migrate`  | `prisma migrate dev` against the dev database     |
| `npm run db:generate` | Regenerate the Prisma client after schema changes |
| `npm run db:studio`   | Browse the dev database visually                  |

### Quality

| Command                | Does                                                                              |
| ---------------------- | --------------------------------------------------------------------------------- |
| `npm run typecheck`    | `tsc --noEmit` across every workspace, strict mode                                |
| `npm run format`       | Prettier writes formatted output across the repo                                  |
| `npm run format:check` | Prettier in check mode (non-zero on drift; CI-friendly)                           |
| `npm run test:api`     | HTTP smoke test: 44 happy- and error-path assertions against every API route      |
| `npm run test:ws`      | WebSocket smoke test: 14 assertions covering every `RealtimeEvent` type + subtask |
| `npm run test`         | Runs both smoke tests sequentially                                                |

## Implemented stories

1. Create to-do items
2. Multiple lists with unique shareable URLs
3. Real-time collaboration between users (WebSocket; sub-100ms propagation)
4. PostgreSQL persistence (Prisma 7, driver adapter)
5. Mark items as done
6. Filter active / done / all (URL search param)
7. Freeze / unfreeze list by owner (server-side enforced; owner bypasses, non-owners blocked + UI disabled)
8. Price/cost per task (stored as integer cents)
9. Aggregate total cost per list — recomputes live; separates `Visible` vs `All` when filtered; includes subtask prices
10. Drag-and-drop reordering — `dnd-kit`-driven, per-scope (root rows + subtasks reorder within their own parent), position persisted to PostgreSQL as `Float`, reorders broadcast to other clients
11. One-level subtasks — `parentId` self-reference with cascade-delete; each subtask has its own title/price/done/position; reorders are scoped to siblings (server rejects cross-parent reorders); add-subtask flow with hover-`+` affordance and counter pill

## Sharing & ownership model

No signup or login. Anyone with a list's URL can view and edit it; the creator's browser holds a per-list `ownerToken` (in `localStorage`) that the server checks for owner-only actions (freeze/unfreeze, delete-list, edit-while-frozen). Same model as Excalidraw rooms or a Figma "Anyone with the link" share — chosen so the submission stays focused on the collaborative-list mechanics rather than building yet another auth flow.

The homepage groups lists into **Your lists** (owned by this browser) and **Shared with me** (visited via a share link), so visitors of a share link have a way back to the lists they've collaborated on without bookmarking the URL.

## Intentionally out of scope

Cut to keep the submission focused and production-oriented within the available time:

- Infinite nested subtasks (capped at one level by design)
- Markdown rich-text descriptions
- Real-time cursor / text selection collaboration
- Special typed items (`work-task`, `food`)
- Offline editing with reconnect sync
- VR / 3D multi-list browsing
- Drag-converting subtasks to root tasks

## Deployment

The repo ships with [`render.yaml`](./render.yaml) — a Render Blueprint that provisions a Postgres instance plus the API and Web services. The live demo above is deployed from `main` on every push.

## Project documents

- [`CLAUDE.md`](./CLAUDE.md) — coding rules, architectural constraints, plan-of-attack order
