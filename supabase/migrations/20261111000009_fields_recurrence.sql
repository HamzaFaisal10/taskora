-- =============================================================================
-- Taskora — custom field integrity and recurring tasks
-- =============================================================================

-- A field value must belong to a field of the task's own project, and match the field's kind.
create or replace function private.task_field_values_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind public.custom_field_kind;
  v_options jsonb;
begin
  select f.kind, f.options into v_kind, v_options
  from public.custom_fields f
  join public.tasks t on t.project_id = f.project_id
  where f.id = new.field_id and t.id = new.task_id;
  if v_kind is null then
    raise exception 'Field does not belong to this project';
  end if;

  if (v_kind = 'number' and jsonb_typeof(new.value) <> 'number')
    or (v_kind = 'checkbox' and jsonb_typeof(new.value) <> 'boolean')
    or (v_kind in ('text', 'date', 'select', 'person') and jsonb_typeof(new.value) <> 'string')
    or (v_kind = 'date' and (new.value #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$')
    or (v_kind = 'text' and char_length(new.value #>> '{}') > 500)
    or (v_kind = 'select' and not v_options ? (new.value #>> '{}'))
  then
    raise exception 'Invalid value for this field';
  end if;
  return new;
end;
$$;

drop trigger if exists task_field_values_check on public.task_field_values;
create trigger task_field_values_check
  before insert or update on public.task_field_values
  for each row execute function private.task_field_values_check();

-- -----------------------------------------------------------------------------
-- Recurring tasks
-- recurrence = {"freq": "daily" | "weekdays" | "weekly" | "monthly", "interval": 1..12}
-- When a recurring task is completed, the next one is created with its dates moved forward, and the
-- finished task stops repeating (so reopening and finishing it again never makes a duplicate).
-- -----------------------------------------------------------------------------
create or replace function private.next_occurrence(p_from date, p_rec jsonb)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_freq text := coalesce(p_rec ->> 'freq', 'weekly');
  v_interval int := greatest(1, least(12, coalesce((p_rec ->> 'interval')::int, 1)));
  v_next date;
begin
  if v_freq = 'daily' then
    return p_from + v_interval;
  elsif v_freq = 'weekdays' then
    v_next := p_from + 1;
    while extract(isodow from v_next) > 5 loop
      v_next := v_next + 1;
    end loop;
    return v_next;
  elsif v_freq = 'monthly' then
    return (p_from + make_interval(months => v_interval))::date;
  else
    return p_from + 7 * v_interval;
  end if;
end;
$$;

create or replace function private.tasks_recur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base date := coalesce(new.due_date, current_date);
  v_due date;
  v_new uuid := gen_random_uuid();
begin
  v_due := private.next_occurrence(v_base, new.recurrence);
  -- Skip occurrences already in the past, so a long-overdue task jumps to the next future date.
  while v_due < current_date loop
    v_due := private.next_occurrence(v_due, new.recurrence);
  end loop;

  insert into public.tasks (id, project_id, title, description, priority, assignee_id, creator_id,
                            start_date, due_date, estimate, recurrence, recurrence_source_id)
  values (v_new, new.project_id, new.title, new.description, new.priority, new.assignee_id, new.creator_id,
          case when new.start_date is not null and new.due_date is not null
               then v_due - (new.due_date - new.start_date) end,
          v_due, new.estimate, new.recurrence, coalesce(new.recurrence_source_id, new.id));

  insert into public.task_labels (task_id, label_id)
  select v_new, label_id from public.task_labels where task_id = new.id;
  insert into public.task_field_values (task_id, field_id, value)
  select v_new, field_id, value from public.task_field_values where task_id = new.id;

  update public.tasks set recurrence = null where id = new.id;
  return null;
end;
$$;

drop trigger if exists tasks_recur on public.tasks;
create trigger tasks_recur
  after update on public.tasks
  for each row
  when (new.completed_at is not null and old.completed_at is null
        and new.recurrence is not null and new.archived_at is null and new.parent_id is null)
  execute function private.tasks_recur();

-- Recurrence settings the app accepts.
alter table public.tasks drop constraint if exists tasks_recurrence_shape;
alter table public.tasks add constraint tasks_recurrence_shape check (
  recurrence is null or (
    jsonb_typeof(recurrence) = 'object'
    and recurrence ->> 'freq' in ('daily', 'weekdays', 'weekly', 'monthly')
  )
);
