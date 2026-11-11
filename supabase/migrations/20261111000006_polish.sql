-- =============================================================================
-- Taskora — polish and gaps (Phase 7)
-- =============================================================================

-- "To do" used a near-white dot that disappeared on the light theme.
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
    (new.id, 'To do', '#A9B1BC', 'unstarted', 2),
    (new.id, 'In progress', '#F5B841', 'started', 3),
    (new.id, 'In review', '#6CA8FF', 'review', 4),
    (new.id, 'Done', '#4FD18B', 'completed', 5),
    (new.id, 'Canceled', '#5C636D', 'canceled', 6);
  return new;
end;
$$;

update public.task_statuses set color = '#A9B1BC' where upper(color) = '#ECEDEE';

-- Deleting a column moves its tasks to another column of the same project first.
create or replace function public.delete_status(p_status uuid, p_move_to uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project uuid;
begin
  select project_id into v_project from public.task_statuses where id = p_status;
  if v_project is null then
    raise exception 'STATUS_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_move_to = p_status or not exists (select 1 from public.task_statuses where id = p_move_to and project_id = v_project) then
    raise exception 'STATUS_MOVE_INVALID' using errcode = 'P0001', hint = 'Pick another column in the same project.';
  end if;
  update public.tasks set status_id = p_move_to where status_id = p_status;
  delete from public.task_statuses where id = p_status;
end;
$$;

revoke execute on function public.delete_status(uuid, uuid) from public, anon;
grant execute on function public.delete_status(uuid, uuid) to authenticated;
