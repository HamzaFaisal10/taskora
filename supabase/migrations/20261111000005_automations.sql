-- =============================================================================
-- Taskora — automation engine
-- Runs the rules in public.automations when tasks change.
--
-- Trigger types (automations.trigger ->> 'type'):
--   task_created                       a task is created
--   status_changed  {to_category}      a task moves into a status category
--   label_added                        a label is added (filter with a label_id condition)
--   due_in          {days}             a task is due in N days (run daily by the cron job)
--
-- Conditions: [{"field": "status_category" | "priority" | "source" | "label_id" | "assignee_id",
--               "op": "eq" | "neq" | "in" | "not_in", "value": ...}]
--
-- Actions: assign {user_id}, notify {user_id}, notify_assignee, set_priority {priority},
--          move_to_category {category}, add_label {label_id}, complete_subtasks, stop_timers
-- =============================================================================

create or replace function private.automation_condition(p_cond jsonb, p_actual text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_cond ->> 'op'
    when 'eq' then p_actual is not distinct from (p_cond ->> 'value')
    when 'neq' then p_actual is distinct from (p_cond ->> 'value')
    when 'in' then p_actual = any (select jsonb_array_elements_text(p_cond -> 'value'))
    when 'not_in' then p_actual is null or not (p_actual = any (select jsonb_array_elements_text(p_cond -> 'value')))
    else false
  end;
$$;

-- Runs every enabled automation of the task's project that matches the event.
create or replace function private.run_automations(p_task uuid, p_event text, p_ctx jsonb default '{}'::jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.tasks;
  v_category public.status_category;
  v_ref text;
  v_rule public.automations;
  v_cond jsonb;
  v_action jsonb;
  v_ok boolean;
  v_actual text;
  v_status uuid;
  v_ran integer := 0;
begin
  -- Actions change tasks, which fire these triggers again. Only the first level runs rules,
  -- so a rule can never trigger itself or another rule in a loop.
  if coalesce(current_setting('taskora.in_automation', true), '') = 'on' then
    return 0;
  end if;

  select * into v_task from public.tasks where id = p_task;
  if v_task.id is null or v_task.archived_at is not null then
    return 0;
  end if;
  select category into v_category from public.task_statuses where id = v_task.status_id;
  select p.key || '-' || v_task.number into v_ref from public.projects p where p.id = v_task.project_id;

  perform set_config('taskora.in_automation', 'on', true);

  for v_rule in
    select * from public.automations
    where project_id = v_task.project_id and enabled and trigger ->> 'type' = p_event
    order by created_at
  loop
    -- Trigger filters
    if p_event = 'status_changed' and v_rule.trigger ? 'to_category'
       and v_rule.trigger ->> 'to_category' is distinct from v_category::text then
      continue;
    end if;
    if p_event = 'due_in' and (v_rule.trigger ->> 'days')::int is distinct from (p_ctx ->> 'days')::int then
      continue;
    end if;

    -- Conditions (all must match)
    v_ok := true;
    for v_cond in select * from jsonb_array_elements(v_rule.conditions) loop
      v_actual := case v_cond ->> 'field'
        when 'status_category' then v_category::text
        when 'priority' then v_task.priority::text
        when 'source' then v_task.source::text
        when 'assignee_id' then v_task.assignee_id::text
        when 'label_id' then coalesce(p_ctx ->> 'label_id', (
          select tl.label_id::text from public.task_labels tl
          where tl.task_id = v_task.id and tl.label_id::text = v_cond ->> 'value' limit 1))
        else null
      end;
      if not private.automation_condition(v_cond, v_actual) then
        v_ok := false;
        exit;
      end if;
    end loop;
    continue when not v_ok;

    -- Actions
    for v_action in select * from jsonb_array_elements(v_rule.actions) loop
      case v_action ->> 'type'
        when 'assign' then
          update public.tasks set assignee_id = (v_action ->> 'user_id')::uuid
          where id = v_task.id
            and exists (select 1 from public.workspace_members m
                        where m.workspace_id = v_task.workspace_id and m.user_id = (v_action ->> 'user_id')::uuid);
        when 'set_priority' then
          update public.tasks set priority = (v_action ->> 'priority')::public.task_priority where id = v_task.id;
        when 'move_to_category' then
          select id into v_status from public.task_statuses
          where project_id = v_task.project_id and category = (v_action ->> 'category')::public.status_category
          order by position limit 1;
          if v_status is not null then
            update public.tasks set status_id = v_status where id = v_task.id;
          end if;
        when 'add_label' then
          insert into public.task_labels (task_id, label_id)
          select v_task.id, l.id from public.labels l
          where l.id = (v_action ->> 'label_id')::uuid and l.workspace_id = v_task.workspace_id
          on conflict do nothing;
        when 'complete_subtasks' then
          select id into v_status from public.task_statuses
          where project_id = v_task.project_id and category = 'completed' order by position limit 1;
          update public.tasks c set status_id = v_status
          from public.task_statuses s
          where c.parent_id = v_task.id and s.id = c.status_id
            and s.category not in ('completed', 'canceled') and v_status is not null;
        when 'stop_timers' then
          update public.time_entries set ended_at = now() where task_id = v_task.id and ended_at is null;
        when 'notify', 'notify_assignee' then
          insert into public.notifications (user_id, workspace_id, kind, task_id, title)
          select u, v_task.workspace_id, 'automation', v_task.id,
                 'Automation “' || v_rule.name || '” ran on ' || v_ref || ' · ' || v_task.title
          from (select case when v_action ->> 'type' = 'notify'
                            then (v_action ->> 'user_id')::uuid
                            else (select assignee_id from public.tasks where id = v_task.id) end as u) x
          where u is not null
            and exists (select 1 from public.workspace_members m where m.workspace_id = v_task.workspace_id and m.user_id = u);
        else
          null; -- unknown action types are ignored so old rules never break a save
      end case;
    end loop;

    update public.automations set run_count = run_count + 1, last_run_at = now() where id = v_rule.id;
    insert into public.activity (workspace_id, project_id, task_id, actor_id, action, meta)
    values (v_task.workspace_id, v_task.project_id, v_task.id, null, 'automation_ran',
            jsonb_build_object('automation_id', v_rule.id, 'name', v_rule.name, 'trigger', p_event));
    v_ran := v_ran + 1;
  end loop;

  perform set_config('taskora.in_automation', '', true);
  return v_ran;
exception when others then
  perform set_config('taskora.in_automation', '', true);
  raise;
end;
$$;

-- Event hooks -----------------------------------------------------------------

create or replace function private.automations_on_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category text;
begin
  if tg_op = 'INSERT' then
    perform private.run_automations(new.id, 'task_created');
  elsif new.status_id is distinct from old.status_id then
    select category::text into v_category from public.task_statuses where id = new.status_id;
    perform private.run_automations(new.id, 'status_changed', jsonb_build_object('to_category', v_category));
  end if;
  return null;
end;
$$;

create trigger tasks_automations
  after insert or update of status_id on public.tasks
  for each row execute function private.automations_on_task();

create or replace function private.automations_on_label()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.run_automations(new.task_id, 'label_added', jsonb_build_object('label_id', new.label_id));
  return null;
end;
$$;

create trigger task_labels_automations
  after insert on public.task_labels
  for each row execute function private.automations_on_label();

-- Scheduled rules ("due in N days"), called once a day by the cron job.
create or replace function public.run_scheduled_automations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule record;
  v_task record;
  v_total integer := 0;
begin
  for v_rule in
    select distinct a.project_id, (a.trigger ->> 'days')::int as days
    from public.automations a
    where a.enabled and a.trigger ->> 'type' = 'due_in'
  loop
    for v_task in
      select t.id from public.tasks t
      join public.task_statuses s on s.id = t.status_id
      where t.project_id = v_rule.project_id
        and t.archived_at is null
        and t.due_date = current_date + v_rule.days
        and s.category not in ('completed', 'canceled')
        -- once per task per day
        and not exists (
          select 1 from public.activity a
          where a.task_id = t.id and a.action = 'automation_ran' and a.created_at >= current_date
            and (a.meta ->> 'trigger') = 'due_in'
        )
    loop
      v_total := v_total + private.run_automations(v_task.id, 'due_in', jsonb_build_object('days', v_rule.days));
    end loop;
  end loop;
  return v_total;
end;
$$;

revoke execute on function public.run_scheduled_automations() from public, anon, authenticated;
grant execute on function public.run_scheduled_automations() to service_role;
revoke execute on function private.run_automations(uuid, text, jsonb) from public, anon, authenticated;
