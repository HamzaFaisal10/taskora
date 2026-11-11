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

### Handling secrets

- The service-role key is read only on the server (`src/lib/supabase/admin.ts`, marked `server-only`).
- Keys pasted into a dashboard sometimes pick up a stray space or line break; `cleanKey()` strips
  whitespace, since real keys never contain any.
- Server logs record only an error's name, code and status (`safeError()`), never its message, because
  some auth errors echo request headers.

## 6. Project views and the task panel

- **One load, four views.** `getProjectData()` (`src/lib/project/data.ts`) fetches statuses, tasks, people,
  labels and sprints once in the project layout. Board, List, Calendar and Timeline are client components
  that read the same store (`src/components/project/store.tsx`), so switching views is instant and the
  search and filters carry over.
- **Optimistic updates.** Every change (drag a card, pick a priority, move a date) updates the screen first,
  then calls a server action in `src/lib/project/actions.ts`. If the database refuses it (permissions,
  validation), the change is rolled back and a toast explains why.
- **Drag and drop** uses dnd-kit with mouse, touch (press and hold) and keyboard sensors. Dropping a card
  sends only its new neighbours to `move_task()`, which picks a position between them.
- **The task panel** opens from `?task=MOB-123`, so every task has a shareable link and the browser back
  button closes it. It loads comments, subtasks, dependencies and the activity log on demand.
- Long "Done" columns show the most recent cards first, with the rest one click away.

## 7. Sprints, goals, automations and forms

- **Sprints** (`/p/KEY/sprints`): one active sprint per project (a unique index enforces it). The burndown
  is drawn from each task's `completed_at` against an ideal line; tasks without an estimate count as one
  point. Completing a sprint moves unfinished tasks to the next sprint or the backlog.
- **Automations run inside the database** (`…05_automations.sql`). Triggers on `tasks` and `task_labels`
  call `run_automations()`, which checks each enabled rule's trigger and conditions and applies its actions
  (assign, notify, set priority, move, add label, complete subtasks, stop timers). Actions change tasks,
  which would fire the triggers again, so a transaction flag stops rules from triggering other rules and
  looping. "Due in N days" rules run once a day from the cron job, once per task.
- **Forms** have a public page at `/f/<slug>` that needs no account. It reads the form through
  `get_public_form()` and submits through `submit_form()`, which validates answers and creates a task in
  the project's Triage column. Anonymous visitors never touch a table directly.
- **Goals** are measured by key results. A goal's progress is the average of its key results, and a key
  result can go up or down (for example "first reply time: 9h → 4h").

## 8. AI assistant and analytics

- **AI in the task panel:** break a task into subtasks, summarize where it stands, or draft a description.
  `src/lib/ai/engine.ts` calls OpenAI when `OPENAI_API_KEY` is set. Without a key it runs in **demo mode**:
  it picks a playbook from the task's title and labels and summarizes from the task's real status, owner,
  blockers and latest comment. Demo answers carry a "Demo AI" badge, so nobody mistakes them for a model.
- Every request costs one AI credit, charged inside the database by `use_ai_credits()` (Free 20, Pro 200
  per month), so the limit can't be bypassed from the browser.
- **Analytics** (`/w/<slug>/analytics`) loads the workspace's top-level tasks once and computes everything
  in `src/lib/analytics/compute.ts` (pure functions with unit tests): 30-day KPIs against the 30 days
  before, created vs completed per week, median cycle time, open work per person and project progress.
  Chart colours are validated for contrast in both themes; every chart has a legend, hover details and a
  table view.

### Keeping it fast

- Reads that the panel and the AI need go through GET/POST route handlers (`/api/tasks/...`, `/api/ai`)
  instead of server actions, because Next.js runs server actions one at a time.
- Edits update the screen optimistically and don't re-render the whole project on the server.
- The task panel opens instantly with what the board already knows (`?task=` is a shallow URL change),
  then fills in comments, subtasks and history.

## 9. Billing, time tracking and settings

- **Plans** live in `src/lib/billing/plans.ts` (Free, Pro $8 and Business $16 per member a month). The
  database enforces the same project, member and AI-credit limits.
- **Two billing modes.** With `STRIPE_SECRET_KEY` (a test-mode key) an upgrade opens Stripe Checkout and
  `/api/stripe/webhook` keeps the plan in sync. The webhook signature is checked with HMAC-SHA256 and a
  five-minute replay window (`verifyWebhook`, unit tested). Without keys, and always in the demo
  workspace, upgrades go to a **demo checkout** labelled "Demo payment — no real charge". It never asks for
  card details and contacts no payment provider; it just switches the plan and records a demo invoice.
- Plan columns can't be written from the browser (column-level grants), so plan changes run on the server
  with the service role, after checking that the person is an owner or admin.
- **Time tracking:** start and stop a timer from any task (one running timer per person, enforced by a
  unique index), or log time by hand. The timer stays visible in the sidebar on every page. The Time page
  shows a weekly grid per person and exports CSV.
- **Settings:** workspace name and URL, delete workspace (owner only, type the name to confirm), shared
  labels, members and invites, billing, and your profile.
- Signing out only ends the current browser's session, so one visitor leaving the shared demo account
  never signs out anyone else.

## 10. Keeping the demo fresh

`/api/cron/reset-demo` runs every night from Vercel Cron (`vercel.json`) and only answers requests that
carry `CRON_SECRET`. A GitHub Actions workflow (`keepalive.yml`) also pings `/api/health` daily so the free
Supabase project never pauses for inactivity.

## 11. Collaboration: files, mentions and live updates

- **Attachments** live in a private Storage bucket. Object paths start with the task id, and the bucket's
  policies call the same `can_view_task` / `can_write_task` helpers as the tables, so a file is readable
  exactly when its task is. The browser shows files through short-lived signed URLs.
- **@mentions** are matched against workspace members' full names when a comment is saved; each person
  mentioned gets a `mentioned` notification (never the author). Reactions are a small fixed emoji set.
- **Live updates** use Supabase Realtime on `tasks`, `task_statuses`, `comments` and `notifications`.
  Realtime applies row level security too, so the hook (`src/lib/realtime/use-live.ts`) hands the channel
  the signed-in token before subscribing. Changes are debounced into one `router.refresh()` for the board,
  a reload of the open task panel, or a refresh of the Inbox badge.
- **Projects and columns** are created and edited in the app: new projects start from a template, and
  `delete_status` moves a column's tasks before removing it.

- **Rich text** in descriptions and updates is a small Markdown subset (`src/lib/rich-text.ts`) parsed into
  plain data and rendered as React elements, so typed text can never become HTML. Only http(s) links are
  allowed.
- **Plan with AI** (`src/lib/ai/plan.ts`) turns a brief into tasks; demo mode uses rules (requirements,
  bullets, "nice to have" sections, priority and size words, existing labels). Nothing is saved until the
  person reviews the list.
- **Status updates** (`src/lib/ai/status-update.ts`) are drafted from the project's numbers: work finished
  this week, sprint pace, overdue and blocked tasks, and what is due next. Posting one also sets the
  project's health on the home page.

## 12. Testing

`npm run db:test` creates a fresh Postgres database, applies every migration and checks, among others:

- outsiders see nothing from another workspace and cannot write into it
- guests only see shared projects and cannot create tasks
- members cannot touch billing fields or create a second owner
- the Free plan stops at 3 projects
- public forms create Triage tasks and validate their fields
- the demo reset can run repeatedly and only the server may call it

The tests run on a plain Postgres with a small stand-in for Supabase's `auth` schema
(`supabase/tests/supabase-stub.sql`), and in GitHub Actions on every push.
