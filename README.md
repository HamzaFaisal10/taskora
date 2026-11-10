# Taskora

A fast, focused project management SaaS for product teams: Kanban boards, list, calendar and timeline views, sprints, automations, forms, goals, analytics and AI task planning.

Built by Hamza Faisal (StartEQ) as a full-stack portfolio project.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Storage, Realtime) · Stripe · OpenAI

> 🚧 Work in progress — built in phases. See [docs/architecture.md](docs/architecture.md) for how it fits together.

## What's inside

| Area                                                  | Where                                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Design system (tokens, dark/light themes, components) | `src/app/globals.css`, `src/components/ui`, live preview at `/styleguide` |
| Database schema, row level security, RPCs             | `supabase/migrations`                                                     |
| Demo workspace that rebuilds itself every night       | `supabase/migrations/*_demo.sql`, `scripts/demo-setup.ts`                 |
| Database tests (run against real Postgres)            | `scripts/db-test.ts`                                                      |

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in your Supabase keys
npm run dev                  # http://localhost:3000
```

### Checks

```bash
npm run lint
npm run typecheck
npm test            # unit tests
npm run db:start    # local Postgres for the database tests (needs PostgreSQL 16 installed)
npm run db:test     # applies every migration and tests security rules, limits and RPCs
```

CI runs all of these on every push (`.github/workflows/ci.yml`).

## Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the files in `supabase/migrations` in order.
3. Copy the Project URL, anon key and service role key into `.env.local` (and into Vercel).
4. Create the demo account and data: `npm run demo:setup`.
