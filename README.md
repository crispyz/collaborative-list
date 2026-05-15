# Collaborative List

A real-time collaborative to-do list. Multiple users open the same list URL in different browsers and see edits propagate instantly. Built as a deliberately focused technical submission demonstrating full-stack product development, not a partial implementation of every possible feature.

## Stack

- **Backend:** Node.js + TypeScript + Prisma + PostgreSQL + WebSockets
- **Frontend:** React / Next.js + TypeScript + TanStack Query
- **Shared:** Zod for input validation and inferred TypeScript types
- **Monorepo:** npm workspaces

```
apps/
  api/     Node.js HTTP + WebSocket server
  web/     Next.js frontend
packages/
  db/      Prisma schema and database client
  shared/  Zod schemas and shared TypeScript types
```

## Local setup

**Prerequisites:** Node ≥ 20.19 (pinned via `.nvmrc`) and Docker Desktop running.

```bash
# Use the pinned Node version
nvm use

# Install dependencies (npm workspaces hoists everything)
npm install

# Copy the env template
cp .env.example .env

# Start PostgreSQL
docker compose up -d

# Apply database migrations
npm run db:migrate
```

### Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Strict TypeScript check across all workspaces |
| `npm run db:generate` | Regenerate the Prisma client after schema changes |
| `npm run db:migrate` | Apply pending migrations to the dev database |
| `npm run db:studio` | Browse the dev database in Prisma Studio |

## Implemented stories

_To be listed when shipped._

**Primary:**

1. Create to-do items
2. Multiple lists with unique shareable URLs
3. Real-time collaboration between users
4. PostgreSQL persistence
5. Mark items as done
6. Filter active / done / all
7. Freeze / unfreeze list by owner
8. Price/cost per task (stored as integer cents)
9. Aggregate total cost per list

**Bonus (only after primary is stable):**

- Drag & drop ordering
- Subtasks (one level)
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

## Project documents

- [`CLAUDE.md`](./CLAUDE.md) — coding rules, architectural constraints, and the plan-of-attack order
