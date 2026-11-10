-- =============================================================================
-- Taskora — RPC functions called by the app
-- =============================================================================

-- Create a workspace; the caller becomes its owner.
create or replace function public.create_workspace(p_name text, p_slug text)
returns public.workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_ws public.workspaces;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if lower(btrim(p_slug)) in ('demo', 'admin', 'api', 'app', 'auth', 'login', 'settings', 'pricing', 'f') then
    raise exception 'SLUG_TAKEN' using errcode = 'P0001', hint = 'That workspace URL is already in use.';
  end if;

  insert into public.workspaces (name, slug, created_by)
  values (btrim(p_name), lower(btrim(p_slug)), v_user)
  returning * into v_ws;

  return v_ws;
exception
  when unique_violation then
    raise exception 'SLUG_TAKEN' using errcode = 'P0001', hint = 'That workspace URL is already in use.';
end;
$$;

-- Accept an invite sent to the signed-in user's email address.
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_invite public.workspace_invites;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select lower(email) into v_email from public.profiles where id = v_user;

  select * into v_invite from public.workspace_invites
  where token = p_token and accepted_at is null and expires_at > now()
  for update;

  if v_invite.id is null then
    raise exception 'INVITE_INVALID' using errcode = 'P0001', hint = 'This invite link has expired or was already used.';
  end if;
  if v_invite.email <> v_email then
    raise exception 'INVITE_WRONG_EMAIL' using errcode = 'P0001', hint = 'This invite was sent to a different email address.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, v_user, v_invite.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invites set accepted_at = now() where id = v_invite.id;

  insert into public.notifications (user_id, workspace_id, kind, actor_id, title)
  select v_invite.invited_by, v_invite.workspace_id, 'invite_accepted', v_user, 'accepted your workspace invite'
  where v_invite.invited_by is not null and v_invite.invited_by <> v_user;

  return v_invite.workspace_id;
end;
$$;

-- Reorder: move a task to a status column at a position between two neighbours.
create or replace function public.move_task(p_task uuid, p_status uuid, p_before uuid default null, p_after uuid default null)
returns double precision
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_before double precision;
  v_after double precision;
  v_pos double precision;
begin
  select position into v_before from public.tasks where id = p_before and status_id = p_status;
  select position into v_after from public.tasks where id = p_after and status_id = p_status;

  v_pos := case
    when v_before is not null and v_after is not null then (v_before + v_after) / 2
    when v_before is not null then v_before + 1024
    when v_after is not null then v_after - 1024
    else 1024
  end;

  update public.tasks set status_id = p_status, position = v_pos where id = p_task;
  if not found then
    raise exception 'Task not found or not editable' using errcode = '42501';
  end if;
  return v_pos;
end;
$$;

-- Public form: read the form definition (no sign-in needed).
create or replace function public.get_public_form(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'title', f.title,
    'description', f.description,
    'fields', f.fields,
    'workspace', w.name
  )
  from public.forms f
  join public.projects p on p.id = f.project_id
  join public.workspaces w on w.id = p.workspace_id
  where f.slug = p_slug and f.is_public and p.archived_at is null;
$$;

-- Public form: submit an answer -> new task in the project's Triage column.
-- Field definitions look like: {"id": "q1", "label": "What happened?", "type": "short_text",
--                               "required": true, "maps_to": "title" | "description" | "priority" | "requester_email"}
create or replace function public.submit_form(p_slug text, p_answers jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_form public.forms;
  v_project public.projects;
  v_field jsonb;
  v_value text;
  v_title text;
  v_description text := '';
  v_priority public.task_priority := 'none';
  v_email text;
  v_status uuid;
  v_task public.tasks;
begin
  select * into v_form from public.forms where slug = p_slug and is_public;
  if v_form.id is null then
    raise exception 'FORM_NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into v_project from public.projects where id = v_form.project_id and archived_at is null;
  if v_project.id is null then
    raise exception 'FORM_NOT_FOUND' using errcode = 'P0001';
  end if;

  for v_field in select * from jsonb_array_elements(v_form.fields) loop
    v_value := left(btrim(coalesce(p_answers ->> (v_field ->> 'id'), '')), 5000);
    if coalesce((v_field ->> 'required')::boolean, false) and v_value = '' then
      raise exception 'FORM_FIELD_REQUIRED' using errcode = 'P0001', hint = (v_field ->> 'label') || ' is required.';
    end if;
    continue when v_value = '';

    case v_field ->> 'maps_to'
      when 'title' then v_title := left(v_value, 300);
      when 'priority' then
        v_priority := case lower(v_value)
          when 'blocking my work' then 'urgent' when 'urgent' then 'urgent'
          when 'high' then 'high' when 'medium' then 'medium' when 'low' then 'low'
          else 'none' end;
      when 'requester_email' then
        if v_value !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
          raise exception 'FORM_EMAIL_INVALID' using errcode = 'P0001', hint = 'Enter a valid email address.';
        end if;
        v_email := lower(v_value);
      else
        v_description := v_description || '**' || (v_field ->> 'label') || '**' || chr(10) || v_value || chr(10) || chr(10);
    end case;
  end loop;

  if v_title is null then
    v_title := 'New request from ' || v_form.title;
  end if;

  select id into v_status from public.task_statuses
  where project_id = v_project.id and category = 'triage' order by position limit 1;

  insert into public.tasks (project_id, title, description, priority, status_id, source, requester_email)
  values (v_project.id, v_title, btrim(v_description), v_priority, v_status, 'form', v_email)
  returning * into v_task;

  update public.forms set submission_count = submission_count + 1 where id = v_form.id;

  insert into public.notifications (user_id, workspace_id, kind, task_id, title)
  select m.user_id, v_project.workspace_id, 'form_submission', v_task.id,
         'New ' || v_form.title || ' submission · ' || v_task.title
  from public.workspace_members m
  where m.workspace_id = v_project.workspace_id and m.role in ('owner', 'admin');

  return v_project.key || '-' || v_task.number;
end;
$$;

-- Spend AI credits atomically; resets the monthly counter when a new month starts.
create or replace function public.use_ai_credits(p_workspace uuid, p_amount integer default 1)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ws public.workspaces;
  v_limit integer;
begin
  if not private.can_write(p_workspace) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into v_ws from public.workspaces where id = p_workspace for update;
  if v_ws.ai_credits_period_start < date_trunc('month', now()) then
    v_ws.ai_credits_used := 0;
    v_ws.ai_credits_period_start := date_trunc('month', now());
  end if;

  v_limit := case v_ws.plan when 'free' then 20 when 'pro' then 200 else 1000000 end;
  if v_ws.ai_credits_used + p_amount > v_limit then
    raise exception 'AI_CREDITS_EXHAUSTED' using errcode = 'P0001',
      hint = 'You have used all AI credits for this month.';
  end if;

  update public.workspaces
  set ai_credits_used = v_ws.ai_credits_used + p_amount,
      ai_credits_period_start = v_ws.ai_credits_period_start
  where id = p_workspace;

  return v_limit - (v_ws.ai_credits_used + p_amount);
end;
$$;

revoke execute on function public.create_workspace(text, text) from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
revoke execute on function public.move_task(uuid, uuid, uuid, uuid) from public, anon;
revoke execute on function public.use_ai_credits(uuid, integer) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.move_task(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.use_ai_credits(uuid, integer) to authenticated;
grant execute on function public.get_public_form(text) to anon, authenticated;
grant execute on function public.submit_form(text, jsonb) to anon, authenticated;
