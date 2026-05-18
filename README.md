# Collaborative List

A real-time collaborative to-do list. Multiple users open the same list URL in different browsers and see edits propagate instantly. Built as a deliberately focused technical submission demonstrating full-stack product development, not a partial implementation of every possible feature.

## Stack

- **Backend:** Node.js + TypeScript + Fastify + Prisma + PostgreSQL + WebSockets (`@fastify/websocket`)
- **Frontend:** Next.js (App Router) + React 19 + TypeScript + TanStack Query + Tailwind v4 + shadcn/ui
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

| Command                | Does                                                                         |
| ---------------------- | ---------------------------------------------------------------------------- |
| `npm run typecheck`    | `tsc --noEmit` across every workspace, strict mode                           |
| `npm run format`       | Prettier writes formatted output across the repo                             |
| `npm run format:check` | Prettier in check mode (non-zero on drift; CI-friendly)                      |
| `npm run test:api`     | HTTP smoke test: 41 happy- and error-path assertions against every API route |
| `npm run test:ws`      | WebSocket smoke test: 9 assertions, one per `RealtimeEvent` type             |
| `npm run test`         | Runs both smoke tests sequentially                                           |

## Deploy to Render

This repo ships with [`render.yaml`](./render.yaml) so the whole stack can be deployed via Render's Blueprint feature.

1. Push the repo to GitHub (private is fine).
2. Render dashboard → **New** → **Blueprint** → connect this repo → Render reads `render.yaml`.
3. Click **Apply**. Render provisions one Postgres database + two web services (`collab-list-api` and `collab-list-web`).
4. First build takes ~5 minutes — Prisma generates the client and applies the initial migration as part of the API service's build step.
5. Visit `https://collab-list-web.onrender.com`. First request after idle takes ~30–50s (Render's free tier sleeps after 15 minutes — known caveat).

Caveats on the free tier:

- Web services sleep after 15 min inactivity → cold start on the next request.
- Free Postgres is deleted after 90 days; upgrade or recreate before then.

If you fork into a different Render account, update `NEXT_PUBLIC_API_URL` in `render.yaml` to match the API service's hostname (Render uses `<service-name>.onrender.com`).

## Implemented stories

**Primary scope:**

1. Create to-do items
2. Multiple lists with unique shareable URLs
3. Real-time collaboration between users (WebSocket; sub-100ms propagation)
4. PostgreSQL persistence (Prisma 7, driver adapter)
5. Mark items as done
6. Filter active / done / all (URL search param)
7. Freeze / unfreeze list by owner (server-side enforced; owner bypasses, non-owners blocked + UI disabled)
8. Price/cost per task (stored as integer cents)
9. Aggregate total cost per list (recomputes live; separates `Visible` vs `All` when filtered)

**Not implemented (deferred):**

- Drag & drop ordering — `position: Float` field exists in the schema, ready for `dnd-kit` integration
- Subtasks — `parentId` self-reference + cascade delete already in place; UI not wired yet
- Subtask price aggregation in parent

## Intentionally out of scope

Cut deliberately to keep the submission focused and production-oriented within the available time:

- Infinite nested subtasks
- Markdown rich-text descriptions
- Real-time cursor / text selection collaboration
- Special typed items (`work-task`, `food`)
- Offline editing with reconnect sync
- VR / 3D multi-list browsing
- Drag-converting subtasks to root tasks
- User accounts / authentication — sharing model is anonymous URL + per-list `ownerToken`, similar to Figma share links or Excalidraw rooms

## Project documents

- [`CLAUDE.md`](./CLAUDE.md) — coding rules, architectural constraints, plan-of-attack order
