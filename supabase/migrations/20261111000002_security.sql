-- =============================================================================
-- Taskora — row level security
--
-- Rules in one sentence: you can only see data from workspaces you belong to.
--   owner / admin  -> manage the workspace, members, billing and everything below
--   member         -> create and edit projects, tasks and the rest of the work
--   guest          -> read and comment on the specific projects shared with them
--
-- Helper functions live in the "private" schema so they are not exposed through
-- the API. They are SECURITY DEFINER so policies can look up membership without
-- recursing into the policies of workspace_members itself.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function private.member_role(p_workspace uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.workspace_members
  where workspace_id = p_workspace and user_id = auth.uid();
$$;

create or replace function private.is_member(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace and user_id = auth.uid()
  );
$$;

create or replace function private.can_write(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.member_role(p_workspace) in ('owner', 'admin', 'member'), false);
$$;

create or replace function private.is_admin(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.member_role(p_workspace) in ('owner', 'admin'), false);
$$;

create or replace function private.project_workspace(p_project uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select workspace_id from public.projects where id = p_project;
$$;

create or replace function private.task_project(p_task uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select project_id from public.tasks where id = p_task;
$$;

-- Full members see every project; guests only the ones shared with them.
create or replace function private.can_view_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case private.member_role(private.project_workspace(p_project))
    when 'owner' then true
    when 'admin' then true
    when 'member' then true
    when 'guest' then exists (
      select 1 from public.project_guests where project_id = p_project and user_id = auth.uid()
    )
    else false
  end;
$$;

create or replace function private.can_write_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_write(private.project_workspace(p_project));
$$;

create or replace function private.can_view_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_view_project(private.task_project(p_task));
$$;

create or replace function private.can_write_task(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_write_project(private.task_project(p_task));
$$;

create or replace function private.shares_workspace(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user
  );
$$;

grant usage on schema private to authenticated, service_role;
grant execute on all functions in schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Turn RLS on everywhere
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'workspaces', 'workspace_members', 'workspace_invites', 'labels',
    'projects', 'project_guests', 'project_favorites', 'task_statuses', 'sprints',
    'custom_fields', 'tasks', 'task_labels', 'task_dependencies', 'task_watchers',
    'task_field_values', 'comments', 'comment_reactions', 'attachments', 'time_entries',
    'activity', 'automations', 'forms', 'goals', 'key_results', 'goal_projects',
    'project_updates', 'notifications', 'invoices'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- Anonymous visitors get nothing from tables; public forms go through RPCs.
revoke all on all tables in schema public from anon;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy "profiles: read self and teammates" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_workspace(id));

create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- workspaces
-- -----------------------------------------------------------------------------
create policy "workspaces: members read" on public.workspaces
  for select to authenticated
  using (private.is_member(id));

create policy "workspaces: admins update" on public.workspaces
  for update to authenticated
  using (private.is_admin(id))
  with check (private.is_admin(id));

create policy "workspaces: owner deletes" on public.workspaces
  for delete to authenticated
  using (private.member_role(id) = 'owner' and not is_demo);

-- Billing fields are only ever written by the server (service role):
-- people may only rename their workspace or change its URL.
revoke update on public.workspaces from authenticated;
grant update (name, slug) on public.workspaces to authenticated;
-- Workspaces are created through public.create_workspace().
revoke insert on public.workspaces from authenticated;

-- -----------------------------------------------------------------------------
-- workspace_members & invites
-- -----------------------------------------------------------------------------
create policy "members: read own workspaces" on public.workspace_members
  for select to authenticated
  using (private.is_member(workspace_id));

create policy "members: admins add" on public.workspace_members
  for insert to authenticated
  with check (private.is_admin(workspace_id) and role <> 'owner');

create policy "members: admins change roles" on public.workspace_members
  for update to authenticated
  using (private.is_admin(workspace_id) and role <> 'owner')
  with check (private.is_admin(workspace_id) and role <> 'owner');
revoke update on public.workspace_members from authenticated;
grant update (role) on public.workspace_members to authenticated;

create policy "members: admins remove, anyone leaves" on public.workspace_members
  for delete to authenticated
  using (
    role <> 'owner'
    and (private.is_admin(workspace_id) or user_id = (select auth.uid()))
  );

create policy "invites: admins manage" on public.workspace_invites
  for all to authenticated
  using (private.is_admin(workspace_id))
  with check (private.is_admin(workspace_id) and invited_by = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Workspace-level content: labels, goals, invoices
-- -----------------------------------------------------------------------------
create policy "labels: members read" on public.labels
  for select to authenticated using (private.is_member(workspace_id));
create policy "labels: writers manage" on public.labels
  for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));

create policy "goals: full members read" on public.goals
  for select to authenticated using (private.can_write(workspace_id));
create policy "goals: writers manage" on public.goals
  for all to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));

create policy "key results: follow goal" on public.key_results
  for all to authenticated
  using (exists (select 1 from public.goals g where g.id = goal_id and private.can_write(g.workspace_id)))
  with check (exists (select 1 from public.goals g where g.id = goal_id and private.can_write(g.workspace_id)));

create policy "goal projects: follow goal" on public.goal_projects
  for all to authenticated
  using (exists (select 1 from public.goals g where g.id = goal_id and private.can_write(g.workspace_id)))
  with check (
    exists (select 1 from public.goals g where g.id = goal_id and private.can_write(g.workspace_id))
    and private.can_write_project(project_id)
  );

create policy "invoices: admins read" on public.invoices
  for select to authenticated using (private.is_admin(workspace_id));

-- -----------------------------------------------------------------------------
-- Projects and project-level content
-- -----------------------------------------------------------------------------
create policy "projects: visible projects" on public.projects
  for select to authenticated using (private.can_view_project(id));
create policy "projects: writers create" on public.projects
  for insert to authenticated
  with check (private.can_write(workspace_id) and created_by = (select auth.uid()));
create policy "projects: writers update" on public.projects
  for update to authenticated
  using (private.can_write(workspace_id)) with check (private.can_write(workspace_id));
create policy "projects: admins delete" on public.projects
  for delete to authenticated using (private.is_admin(workspace_id));
revoke update on public.projects from authenticated;
grant update (key, name, description, color, health, lead_id, start_date, target_date, archived_at)
  on public.projects to authenticated;

create policy "project guests: read" on public.project_guests
  for select to authenticated using (private.can_view_project(project_id));
create policy "project guests: admins manage" on public.project_guests
  for all to authenticated
  using (private.is_admin(private.project_workspace(project_id)))
  with check (
    private.is_admin(private.project_workspace(project_id))
    and private.member_role(private.project_workspace(project_id)) is not null
  );

create policy "favorites: own" on public.project_favorites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.can_view_project(project_id));

-- Statuses, sprints, custom fields, forms, automations, updates: read if you can
-- see the project, change if you can write in its workspace.
do $$
declare
  t text;
begin
  foreach t in array array['task_statuses', 'sprints', 'custom_fields', 'project_updates'] loop
    execute format(
      'create policy "%1$s: readers" on public.%1$I for select to authenticated using (private.can_view_project(project_id))', t);
    execute format(
      'create policy "%1$s: writers insert" on public.%1$I for insert to authenticated with check (private.can_write_project(project_id))', t);
    execute format(
      'create policy "%1$s: writers update" on public.%1$I for update to authenticated using (private.can_write_project(project_id)) with check (private.can_write_project(project_id))', t);
    execute format(
      'create policy "%1$s: writers delete" on public.%1$I for delete to authenticated using (private.can_write_project(project_id))', t);
  end loop;

  foreach t in array array['forms', 'automations'] loop
    execute format(
      'create policy "%1$s: writers" on public.%1$I for all to authenticated using (private.can_write_project(project_id)) with check (private.can_write_project(project_id))', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tasks
-- -----------------------------------------------------------------------------
create policy "tasks: visible projects" on public.tasks
  for select to authenticated using (private.can_view_project(project_id));
create policy "tasks: writers create" on public.tasks
  for insert to authenticated with check (private.can_write_project(project_id));
create policy "tasks: writers update" on public.tasks
  for update to authenticated
  using (private.can_write_project(project_id)) with check (private.can_write_project(project_id));
create policy "tasks: writers delete" on public.tasks
  for delete to authenticated using (private.can_write_project(project_id));
revoke update on public.tasks from authenticated;
grant update (title, description, status_id, priority, assignee_id, parent_id, sprint_id, start_date,
              due_date, estimate, position, recurrence, archived_at)
  on public.tasks to authenticated;

-- Task children: read if you can see the task, change if you can edit it.
do $$
declare
  t text;
begin
  foreach t in array array['task_labels', 'task_dependencies', 'task_field_values', 'attachments'] loop
    execute format(
      'create policy "%1$s: readers" on public.%1$I for select to authenticated using (private.can_view_task(task_id))', t);
    execute format(
      'create policy "%1$s: writers insert" on public.%1$I for insert to authenticated with check (private.can_write_task(task_id))', t);
    execute format(
      'create policy "%1$s: writers update" on public.%1$I for update to authenticated using (private.can_write_task(task_id)) with check (private.can_write_task(task_id))', t);
    execute format(
      'create policy "%1$s: writers delete" on public.%1$I for delete to authenticated using (private.can_write_task(task_id))', t);
  end loop;
end;
$$;

create policy "watchers: readers" on public.task_watchers
  for select to authenticated using (private.can_view_task(task_id));
create policy "watchers: follow yourself" on public.task_watchers
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_view_task(task_id));
create policy "watchers: unfollow yourself" on public.task_watchers
  for delete to authenticated using (user_id = (select auth.uid()));

-- Comments: guests can comment on shared projects; you edit only your own.
create policy "comments: readers" on public.comments
  for select to authenticated using (private.can_view_task(task_id));
create policy "comments: post as yourself" on public.comments
  for insert to authenticated
  with check (author_id = (select auth.uid()) and private.can_view_task(task_id));
create policy "comments: edit own" on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
create policy "comments: delete own or admin" on public.comments
  for delete to authenticated
  using (
    author_id = (select auth.uid())
    or private.is_admin(private.project_workspace(private.task_project(task_id)))
  );
revoke update on public.comments from authenticated;
grant update (body, edited_at) on public.comments to authenticated;

create policy "reactions: readers" on public.comment_reactions
  for select to authenticated
  using (exists (select 1 from public.comments c where c.id = comment_id and private.can_view_task(c.task_id)));
create policy "reactions: react as yourself" on public.comment_reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.comments c where c.id = comment_id and private.can_view_task(c.task_id))
  );
create policy "reactions: remove own" on public.comment_reactions
  for delete to authenticated using (user_id = (select auth.uid()));

-- Time entries: everyone on the project sees them; you log only your own.
create policy "time: readers" on public.time_entries
  for select to authenticated using (private.can_view_task(task_id));
create policy "time: log own" on public.time_entries
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_write_task(task_id));
create policy "time: edit own" on public.time_entries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.can_write_task(task_id));
create policy "time: delete own" on public.time_entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- Activity is written by triggers only.
create policy "activity: readers" on public.activity
  for select to authenticated
  using (
    case when task_id is not null then private.can_view_task(task_id)
         when project_id is not null then private.can_view_project(project_id)
         else private.can_write(workspace_id) end
  );
revoke insert, update, delete on public.activity from authenticated;

-- -----------------------------------------------------------------------------
-- Notifications: your own inbox. Mentions are sent by teammates via the app.
-- -----------------------------------------------------------------------------
create policy "notifications: own inbox" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: mark read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: clear own" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "notifications: mention a teammate" on public.notifications
  for insert to authenticated
  with check (
    kind = 'mentioned'
    and actor_id = (select auth.uid())
    and private.is_member(workspace_id)
    and exists (select 1 from public.workspace_members m where m.workspace_id = notifications.workspace_id and m.user_id = notifications.user_id)
    and (task_id is null or private.can_view_task(task_id))
  );
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
