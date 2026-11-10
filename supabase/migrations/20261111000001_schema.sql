-- =============================================================================
-- Taskora — core schema
-- Tables, enums, indexes and data-integrity triggers.
-- Row level security lives in the next migration.
-- =============================================================================

create schema if not exists private;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.workspace_role as enum ('owner', 'admin', 'member', 'guest');
create type public.plan_tier as enum ('free', 'pro', 'business');
create type public.task_priority as enum ('none', 'low', 'medium', 'high', 'urgent');
create type public.status_category as enum ('triage', 'backlog', 'unstarted', 'started', 'review', 'completed', 'canceled');
create type public.health as enum ('on_track', 'at_risk', 'off_track');
create type public.sprint_state as enum ('planned', 'active', 'completed');
create type public.task_source as enum ('app', 'ai', 'form', 'automation', 'import', 'recurring');
create type public.custom_field_kind as enum ('text', 'number', 'date', 'select', 'checkbox', 'person');
create type public.notification_kind as enum (
  'assigned', 'mentioned', 'commented', 'status_changed', 'due_soon',
  'invite_accepted', 'automation', 'form_submission'
);

-- -----------------------------------------------------------------------------
-- Shared helpers
-- -----------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- People & workspaces
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  email text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 48),
  plan public.plan_tier not null default 'free',
  is_demo boolean not null default false,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text,
  current_period_end timestamptz,
  ai_credits_used integer not null default 0 check (ai_credits_used >= 0),
  ai_credits_period_start timestamptz not null default date_trunc('month', now()),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.workspace_role not null default 'member' check (role <> 'owner'),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz
);
create unique index workspace_invites_open_idx
  on public.workspace_invites (workspace_id, email) where accepted_at is null;

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  tone text not null default 'neutral'
    check (tone in ('neutral', 'accent', 'info', 'success', 'warning', 'danger', 'violet', 'pink')),
  created_at timestamptz not null default now()
);
create unique index labels_name_idx on public.labels (workspace_id, lower(name));

-- -----------------------------------------------------------------------------
-- Projects
-- -----------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null check (key ~ '^[A-Z][A-Z0-9]{1,5}$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  color text not null default '#CDF461' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  health public.health not null default 'on_track',
  lead_id uuid references public.profiles (id) on delete set null,
  start_date date,
  target_date date,
  task_seq integer not null default 0,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, key),
  check (target_date is null or start_date is null or target_date >= start_date)
);
create index projects_workspace_idx on public.projects (workspace_id) where archived_at is null;

-- Guests only see the projects they are added to.
create table public.project_guests (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.project_favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create table public.task_statuses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  category public.status_category not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index task_statuses_project_idx on public.task_statuses (project_id, position);

create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  goal text not null default '',
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  state public.sprint_state not null default 'planned',
  created_at timestamptz not null default now()
);
create index sprints_project_idx on public.sprints (project_id, start_date);
create unique index sprints_one_active_idx on public.sprints (project_id) where state = 'active';

create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  kind public.custom_field_kind not null,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Tasks
-- -----------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  number integer not null,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  description text not null default '' check (char_length(description) <= 50000),
  status_id uuid not null references public.task_statuses (id) on delete restrict,
  priority public.task_priority not null default 'none',
  assignee_id uuid references public.profiles (id) on delete set null,
  creator_id uuid references public.profiles (id) on delete set null,
  parent_id uuid references public.tasks (id) on delete cascade,
  sprint_id uuid references public.sprints (id) on delete set null,
  start_date date,
  due_date date,
  estimate smallint check (estimate is null or estimate between 0 and 100),
  position double precision not null default 0,
  recurrence jsonb,
  recurrence_source_id uuid references public.tasks (id) on delete set null,
  source public.task_source not null default 'app',
  requester_email text,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number),
  check (due_date is null or start_date is null or due_date >= start_date),
  check (parent_id is null or parent_id <> id)
);
create index tasks_board_idx on public.tasks (project_id, status_id, position) where archived_at is null;
create index tasks_assignee_idx on public.tasks (assignee_id, due_date) where archived_at is null;
create index tasks_parent_idx on public.tasks (parent_id);
create index tasks_sprint_idx on public.tasks (sprint_id);
create index tasks_workspace_due_idx on public.tasks (workspace_id, due_date) where archived_at is null;
create index tasks_title_search_idx on public.tasks using gin (to_tsvector('simple', title));

create table public.task_labels (
  task_id uuid not null references public.tasks (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (task_id, label_id)
);
create index task_labels_label_idx on public.task_labels (label_id);

create table public.task_dependencies (
  task_id uuid not null references public.tasks (id) on delete cascade,
  blocked_by_id uuid not null references public.tasks (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, blocked_by_id),
  check (task_id <> blocked_by_id)
);
create index task_dependencies_blocker_idx on public.task_dependencies (blocked_by_id);

create table public.task_watchers (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (task_id, user_id)
);

create table public.task_field_values (
  task_id uuid not null references public.tasks (id) on delete cascade,
  field_id uuid not null references public.custom_fields (id) on delete cascade,
  value jsonb not null,
  primary key (task_id, field_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index comments_task_idx on public.comments (task_id, created_at);

create table public.comment_reactions (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, emoji)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  size_bytes bigint not null check (size_bytes between 0 and 104857600),
  mime_type text not null default 'application/octet-stream',
  created_at timestamptz not null default now()
);
create index attachments_task_idx on public.attachments (task_id);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
create index time_entries_task_idx on public.time_entries (task_id);
create index time_entries_user_idx on public.time_entries (user_id, started_at desc);
-- Only one running timer per person.
create unique index time_entries_one_running_idx on public.time_entries (user_id) where ended_at is null;

create table public.activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_task_idx on public.activity (task_id, created_at desc);
create index activity_workspace_idx on public.activity (workspace_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Automations, forms, goals, updates
-- -----------------------------------------------------------------------------
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  trigger jsonb not null,
  conditions jsonb not null default '[]'::jsonb check (jsonb_typeof(conditions) = 'array'),
  actions jsonb not null check (jsonb_typeof(actions) = 'array' and jsonb_array_length(actions) > 0),
  enabled boolean not null default true,
  run_count integer not null default 0,
  last_run_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index automations_project_idx on public.automations (project_id) where enabled;

create table public.forms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  fields jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  is_public boolean not null default true,
  submission_count integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '',
  owner_id uuid references public.profiles (id) on delete set null,
  period text not null default '',
  due_date date,
  health public.health not null default 'on_track',
  created_at timestamptz not null default now()
);

create table public.key_results (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  start_value numeric not null default 0,
  current_value numeric not null default 0,
  target_value numeric not null check (target_value <> start_value),
  unit text not null default '',
  position integer not null default 0
);

create table public.goal_projects (
  goal_id uuid not null references public.goals (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  primary key (goal_id, project_id)
);

create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  health public.health not null,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index project_updates_project_idx on public.project_updates (project_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Notifications & billing
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind public.notification_kind not null,
  task_id uuid references public.tasks (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_inbox_idx on public.notifications (user_id, created_at desc);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  number text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'paid' check (status in ('paid', 'open', 'void')),
  period_start date not null,
  period_end date not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index invoices_workspace_idx on public.invoices (workspace_id, created_at desc);

-- =============================================================================
-- Integrity triggers
-- =============================================================================

create trigger workspaces_touch before update on public.workspaces
  for each row execute function private.touch_updated_at();
create trigger projects_touch before update on public.projects
  for each row execute function private.touch_updated_at();

-- New auth user -> profile row.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), split_part(coalesce(new.email, ''), '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- New workspace -> creator becomes owner, default labels.
create or replace function private.handle_new_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict do nothing;
  end if;

  insert into public.labels (workspace_id, name, tone) values
    (new.id, 'Bug', 'danger'),
    (new.id, 'Feature', 'accent'),
    (new.id, 'Design', 'pink'),
    (new.id, 'Backend', 'violet'),
    (new.id, 'Frontend', 'info');
  return new;
end;
$$;

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function private.handle_new_workspace();

-- New project -> default workflow statuses.
create or replace function private.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_statuses (project_id, name, color, category, position) values
    (new.id, 'Triage', '#E58BD8', 'triage', 0),
    (new.id, 'Backlog', '#8A919B', 'backlog', 1),
    (new.id, 'To do', '#ECEDEE', 'unstarted', 2),
    (new.id, 'In progress', '#F5B841', 'started', 3),
    (new.id, 'In review', '#6CA8FF', 'review', 4),
    (new.id, 'Done', '#4FD18B', 'completed', 5),
    (new.id, 'Canceled', '#5C636D', 'canceled', 6);
  return new;
end;
$$;

create trigger on_project_created
  after insert on public.projects
  for each row execute function private.handle_new_project();

-- Plan limits: Free = 3 active projects and 5 members, Pro = 25 members.
create or replace function private.enforce_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plan_tier;
  v_count integer;
begin
  select plan into v_plan from public.workspaces where id = new.workspace_id;

  if tg_table_name = 'projects' then
    if v_plan = 'free' then
      select count(*) into v_count from public.projects
      where workspace_id = new.workspace_id and archived_at is null and id <> new.id;
      if v_count >= 3 then
        raise exception 'PLAN_LIMIT_PROJECTS' using errcode = 'P0001',
          hint = 'The Free plan includes 3 active projects. Upgrade to Pro for unlimited projects.';
      end if;
    end if;
  elsif tg_table_name = 'workspace_members' and new.role <> 'guest' then
    select count(*) into v_count from public.workspace_members
    where workspace_id = new.workspace_id and role <> 'guest' and user_id <> new.user_id;
    if (v_plan = 'free' and v_count >= 5) or (v_plan = 'pro' and v_count >= 25) then
      raise exception 'PLAN_LIMIT_MEMBERS' using errcode = 'P0001',
        hint = 'Your plan''s member limit has been reached. Upgrade to add more people.';
    end if;
  end if;
  return new;
end;
$$;

create trigger projects_plan_limit
  before insert on public.projects
  for each row execute function private.enforce_plan_limits();
create trigger projects_plan_limit_unarchive
  before update of archived_at on public.projects
  for each row when (old.archived_at is not null and new.archived_at is null)
  execute function private.enforce_plan_limits();
create trigger members_plan_limit
  before insert on public.workspace_members
  for each row execute function private.enforce_plan_limits();

-- Tasks: numbering, defaults, and keeping related rows in the same project.
create or replace function private.tasks_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category public.status_category;
  v_project uuid;
begin
  if tg_op = 'INSERT' then
    -- workspace always comes from the project
    select workspace_id into new.workspace_id from public.projects where id = new.project_id;
    if new.workspace_id is null then
      raise exception 'Project % not found', new.project_id;
    end if;

    update public.projects set task_seq = task_seq + 1
    where id = new.project_id
    returning task_seq into new.number;

    if new.status_id is null then
      select id into new.status_id from public.task_statuses
      where project_id = new.project_id and category = 'unstarted'
      order by position limit 1;
    end if;

    if new.position = 0 then
      select coalesce(max(position), 0) + 1024 into new.position
      from public.tasks where status_id = new.status_id;
    end if;

    new.creator_id := coalesce(new.creator_id, auth.uid());
  else
    if new.project_id <> old.project_id or new.workspace_id <> old.workspace_id then
      raise exception 'Tasks cannot be moved between projects';
    end if;
    new.number := old.number;
    new.updated_at := now();
  end if;

  select category, project_id into v_category, v_project from public.task_statuses where id = new.status_id;
  if v_project is distinct from new.project_id then
    raise exception 'Status does not belong to this project';
  end if;

  if new.sprint_id is not null and not exists (
    select 1 from public.sprints where id = new.sprint_id and project_id = new.project_id
  ) then
    raise exception 'Sprint does not belong to this project';
  end if;

  if new.parent_id is not null and not exists (
    select 1 from public.tasks where id = new.parent_id and project_id = new.project_id
  ) then
    raise exception 'Parent task must be in the same project';
  end if;

  if v_category = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function private.tasks_before_write();

-- Activity log + notifications for task changes.
create or replace function private.tasks_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_ref text;
begin
  select p.key || '-' || new.number into v_ref from public.projects p where p.id = new.project_id;

  if tg_op = 'INSERT' then
    insert into public.activity (workspace_id, project_id, task_id, actor_id, action, meta)
    values (new.workspace_id, new.project_id, new.id, v_actor, 'created', jsonb_build_object('source', new.source));

    if new.creator_id is not null then
      insert into public.task_watchers (task_id, user_id) values (new.id, new.creator_id) on conflict do nothing;
    end if;
  else
    if new.status_id is distinct from old.status_id then
      insert into public.activity (workspace_id, project_id, task_id, actor_id, action, meta)
      values (new.workspace_id, new.project_id, new.id, v_actor, 'status_changed',
              jsonb_build_object('from', old.status_id, 'to', new.status_id));
    end if;
    if new.priority is distinct from old.priority then
      insert into public.activity (workspace_id, project_id, task_id, actor_id, action, meta)
      values (new.workspace_id, new.project_id, new.id, v_actor, 'priority_changed',
              jsonb_build_object('from', old.priority, 'to', new.priority));
    end if;
    if new.due_date is distinct from old.due_date then
      insert into public.activity (workspace_id, project_id, task_id, actor_id, action, meta)
      values (new.workspace_id, new.project_id, new.id, v_actor, 'due_changed',
              jsonb_build_object('from', old.due_date, 'to', new.due_date));
    end if;
    if new.assignee_id is distinct from old.assignee_id then
      insert into public.activity (workspace_id, project_id, task_id, actor_id, action, meta)
      values (new.workspace_id, new.project_id, new.id, v_actor, 'assignee_changed',
              jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id));
    end if;
  end if;

  -- Tell the new assignee (unless they assigned themselves).
  if new.assignee_id is not null
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and new.assignee_id is distinct from v_actor then
    insert into public.task_watchers (task_id, user_id) values (new.id, new.assignee_id) on conflict do nothing;
    insert into public.notifications (user_id, workspace_id, kind, task_id, actor_id, title)
    values (new.assignee_id, new.workspace_id, 'assigned', new.id, v_actor,
            'assigned you to ' || v_ref || ' · ' || new.title);
  end if;

  return null;
end;
$$;

create trigger tasks_after_write
  after insert or update on public.tasks
  for each row execute function private.tasks_after_write();

-- New comment -> notify watchers, add the author as a watcher.
create or replace function private.comments_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task record;
begin
  select t.id, t.workspace_id, t.project_id, t.title, p.key || '-' || t.number as ref
  into v_task
  from public.tasks t join public.projects p on p.id = t.project_id
  where t.id = new.task_id;

  insert into public.activity (workspace_id, project_id, task_id, actor_id, action, meta)
  values (v_task.workspace_id, v_task.project_id, new.task_id, new.author_id, 'commented',
          jsonb_build_object('comment_id', new.id));

  insert into public.notifications (user_id, workspace_id, kind, task_id, actor_id, title, body)
  select w.user_id, v_task.workspace_id, 'commented', new.task_id, new.author_id,
         'commented on ' || v_task.ref || ' · ' || v_task.title, left(new.body, 280)
  from public.task_watchers w
  where w.task_id = new.task_id and w.user_id is distinct from new.author_id;

  if new.author_id is not null then
    insert into public.task_watchers (task_id, user_id) values (new.task_id, new.author_id) on conflict do nothing;
  end if;
  return null;
end;
$$;

create trigger comments_after_insert
  after insert on public.comments
  for each row execute function private.comments_after_insert();

-- Dependencies must stay inside one workspace.
create or replace function private.check_dependency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select workspace_id from public.tasks where id = new.task_id)
     is distinct from (select workspace_id from public.tasks where id = new.blocked_by_id) then
    raise exception 'Dependencies must be in the same workspace';
  end if;
  if exists (select 1 from public.task_dependencies where task_id = new.blocked_by_id and blocked_by_id = new.task_id) then
    raise exception 'These tasks already block each other';
  end if;
  return new;
end;
$$;

create trigger task_dependencies_check
  before insert on public.task_dependencies
  for each row execute function private.check_dependency();

-- Labels on a task must belong to the task's workspace.
create or replace function private.check_task_label()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select workspace_id from public.tasks where id = new.task_id)
     is distinct from (select workspace_id from public.labels where id = new.label_id) then
    raise exception 'Label belongs to another workspace';
  end if;
  return new;
end;
$$;

create trigger task_labels_check
  before insert on public.task_labels
  for each row execute function private.check_task_label();

-- Stopping a timer fills in its duration.
create or replace function private.time_entry_duration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ended_at is not null and new.duration_seconds is null then
    new.duration_seconds := greatest(0, extract(epoch from (new.ended_at - new.started_at))::integer);
  end if;
  return new;
end;
$$;

create trigger time_entries_duration
  before insert or update on public.time_entries
  for each row execute function private.time_entry_duration();
