-- =============================================================================
-- Taskora — clearer notifications, and who may archive a project
-- 1. Someone @mentioned in a comment gets the "mentioned you" notification only, not a second
--    "commented on" one for the same comment.
-- 2. When a task is completed, its watchers (the person who created it, the assignee, commenters)
--    hear about it, unless they completed it themselves.
-- 3. Archiving or restoring a project is for owners, admins and the person who created the project.
-- =============================================================================

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
  join public.profiles pr on pr.id = w.user_id
  where w.task_id = new.task_id
    and w.user_id is distinct from new.author_id
    -- Mentioned people get a "mentioned you" notification from the app instead.
    and not (
      pr.full_name <> ''
      and position(lower('@' || pr.full_name) in lower(new.body)) > 0
    );

  if new.author_id is not null then
    insert into public.task_watchers (task_id, user_id) values (new.task_id, new.author_id) on conflict do nothing;
  end if;
  return null;
end;
$$;

-- Completion notifications for watchers.
create or replace function private.tasks_notify_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_ref text;
begin
  if new.status_id is not distinct from old.status_id then
    return null;
  end if;
  if not exists (select 1 from public.task_statuses s where s.id = new.status_id and s.category = 'completed')
     or exists (select 1 from public.task_statuses s where s.id = old.status_id and s.category = 'completed') then
    return null;
  end if;
  select p.key || '-' || new.number into v_ref from public.projects p where p.id = new.project_id;

  insert into public.notifications (user_id, workspace_id, kind, task_id, actor_id, title)
  select w.user_id, new.workspace_id, 'status_changed', new.id, v_actor,
         'completed ' || v_ref || ' · ' || new.title
  from public.task_watchers w
  where w.task_id = new.id and w.user_id is distinct from v_actor;
  return null;
end;
$$;

drop trigger if exists tasks_notify_completed on public.tasks;
create trigger tasks_notify_completed
  after update of status_id on public.tasks
  for each row execute function private.tasks_notify_completed();

-- Only owners, admins and the project's creator may archive or restore it.
create or replace function private.projects_guard_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and new.archived_at is distinct from old.archived_at
     and not private.is_admin(new.workspace_id)
     and new.created_by is distinct from auth.uid() then
    raise exception 'ARCHIVE_NOT_ALLOWED: only admins and the project creator can archive it' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_guard_archive on public.projects;
create trigger projects_guard_archive
  before update of archived_at on public.projects
  for each row execute function private.projects_guard_archive();
