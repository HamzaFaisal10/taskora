-- =============================================================================
-- Taskora — live updates
-- Streams task, comment and notification changes to open browsers through Supabase Realtime.
-- Realtime applies the same row level security, so people only receive rows they can read.
-- =============================================================================
do $do$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['tasks', 'comments', 'notifications', 'task_statuses'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$do$;
