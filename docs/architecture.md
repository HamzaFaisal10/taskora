# How Taskora fits together

This document explains the main decisions in plain language. It grows with every phase.

## 1. The big picture

```
Browser (Next.js pages + React components)
   │  reads and writes with the Supabase client, as the signed-in user
   ▼
Supabase
   ├─ Auth ............ who you are (email, Google, demo login)
   ├─ PostgreSQL ...... all data, protected by row level security (RLS)
   ├─ Storage ......... task attachments
   └─ Realtime ........ live updates on the board
Next.js server routes (only where a secret is needed)
   ├─ Stripe checkout + webhooks
   ├─ OpenAI calls
   └─ nightly demo reset (cron)
```

The browser talks to the database directly, but only ever **as the signed-in user**. Security is enforced
inside the database, so a bug in the UI can never leak another company's data.

## 2. Design system

- **Tokens first.** Every colour is a CSS variable (`--bg`, `--card`, `--accent`, …) defined twice in
  `src/app/globals.css`: once for dark mode (the default) and once for light mode. Components only use
  the tokens, which is why switching theme is instant and nothing needs to be restyled.
- **Accessible primitives.** Menus, dialogs, tabs, tooltips and selects are built on Radix UI, which handles
  keyboard navigation, focus and screen readers. Our components (`src/components/ui`) add the Taskora look.
- **Fonts are bundled** (the `geist` package), so builds never depend on downloading fonts.
- `/styleguide` shows every component in both themes. It is the quickest way to check the design.

## 3. Database design

The schema lives in `supabase/migrations`, split into four files that run in order:

| File                | What it does                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `…01_schema.sql`    | Tables, enums, indexes and the triggers that keep data consistent                                  |
| `…02_security.sql`  | Row level security policies and column permissions                                                 |
| `…03_functions.sql` | RPC functions the app calls (create workspace, accept invite, move task, public forms, AI credits) |
| `…04_demo.sql`      | `reset_demo()`, which rebuilds the demo workspace                                                  |

### Key ideas

- **Workspaces are the security boundary.** Every row belongs to a workspace (directly or through its
  project/task). Membership has a role: `owner`, `admin`, `member` or `guest`.
- **Tasks carry `workspace_id`** even though it can be derived from the project. That makes the most common
  security checks and queries fast. A trigger fills it in, so it can never be wrong.
- **Task numbers** (`MOB-136`) come from a per-project counter (`projects.task_seq`) that a trigger
  increments, so numbers are unique and never reused.
- **Ordering on the board** uses a `position` number. Moving a card puts it halfway between its new
  neighbours (`move_task()`), so only one row changes per drag.
- **Triggers do the bookkeeping:** new users get a profile, new workspaces get an owner and default labels,
  new projects get default statuses, task changes write to the activity log and notify the assignee, and
  comments notify everyone watching the task.

### Security (row level security)

Every table has RLS turned on. The rules, in one sentence each:

- You only see data from workspaces you belong to.
- Owners and admins manage members and settings; members create and edit work; guests can only read and
  comment on the projects shared with them.
- Billing and plan fields can only be changed by the server, never from the browser (enforced with
  column-level permissions, not just policies).
- Anonymous visitors cannot read any table. Public forms work through two RPC functions that expose only
  what the form needs.

Helper functions such as `private.can_view_project()` live in a `private` schema that the API does not
expose. They are `security definer` so a policy can check membership without recursively triggering the
policies of the membership table.

### Plan limits

A trigger enforces the Free plan (3 active projects, 5 members) and the Pro plan (25 members) inside the
database. The app shows a friendly upgrade dialog when it receives the `PLAN_LIMIT_*` error.

## 4. The demo workspace

`reset_demo()` deletes and recreates the "Halcyon Labs" workspace: 8 teammates and a client guest,
4 projects, sprints, custom fields, dependencies, comments, time tracking, automations, forms, goals,
invoices and eight weeks of finished work for the charts.

All dates are relative to **today**, so the demo always looks current. It runs once during setup
(`npm run demo:setup`) and every night from a cron job, so every visitor gets a clean workspace.

## 5. Sign-in and the app shell

- **Supabase Auth** handles email/password, password reset and (optionally) Google. Server actions in
  `src/app/(auth)/actions.ts` validate input with Zod and turn Supabase errors into friendly messages.
- **`src/proxy.ts`** (Next.js 16's replacement for middleware) refreshes the session cookie on every request
  and sends signed-out visitors to `/login?next=…`. `safeNext()` only allows same-site redirects.
- **One-click demo, no password.** `POST /api/demo` uses the service-role key on the server to create a
  one-time sign-in token for the demo account and exchanges it for a session cookie. The demo account has
  no password at all, so there is nothing to leak.
- **Workspaces** are created through the `create_workspace()` RPC (reserved URLs like `demo` are refused).
  Invites are rows in `workspace_invites`; the link `/invite/<token>` calls `accept_invite()`, which checks
  the token, expiry and email address.
- **The shell** (`src/components/shell`) is one sidebar used twice: fixed on desktop, a drawer on phones.
  `⌘K` opens a command menu for pages, projects, workspaces and theme. The theme can be Dark, Light or
  System.

## 6. Keeping the demo fresh

`/api/cron/reset-demo` runs every night from Vercel Cron (`vercel.json`) and only answers requests that
carry `CRON_SECRET`. A GitHub Actions workflow (`keepalive.yml`) also pings `/api/health` daily so the free
Supabase project never pauses for inactivity.

## 7. Testing

`npm run db:test` creates a fresh Postgres database, applies every migration and checks, among others:

- outsiders see nothing from another workspace and cannot write into it
- guests only see shared projects and cannot create tasks
- members cannot touch billing fields or create a second owner
- the Free plan stops at 3 projects
- public forms create Triage tasks and validate their fields
- the demo reset can run repeatedly and only the server may call it

The tests run on a plain Postgres with a small stand-in for Supabase's `auth` schema
(`supabase/tests/supabase-stub.sql`), and in GitHub Actions on every push.
