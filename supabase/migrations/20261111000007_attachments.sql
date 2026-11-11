-- =============================================================================
-- Taskora — task attachments in Supabase Storage
-- Files live in the private "attachments" bucket at <task id>/<random id>-<file name>.
-- Access to a file follows access to its task, checked by the same helpers as the rows.
-- =============================================================================

-- Task id from an object path, or null when the path doesn't start with a uuid.
create or replace function private.attachment_task(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_first text := split_part(p_name, '/', 1);
begin
  if v_first ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return v_first::uuid;
  end if;
  return null;
end;
$$;

-- Storage only exists on Supabase; the plain Postgres used in tests skips this block.
do $do$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('attachments', 'attachments', false, 26214400)
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

    execute $p$drop policy if exists "attachments: read with task" on storage.objects$p$;
    execute $p$drop policy if exists "attachments: upload with task" on storage.objects$p$;
    execute $p$drop policy if exists "attachments: delete with task" on storage.objects$p$;

    execute $p$
      create policy "attachments: read with task" on storage.objects
        for select to authenticated
        using (bucket_id = 'attachments' and private.can_view_task(private.attachment_task(name)))
    $p$;
    execute $p$
      create policy "attachments: upload with task" on storage.objects
        for insert to authenticated
        with check (bucket_id = 'attachments' and private.can_write_task(private.attachment_task(name)))
    $p$;
    execute $p$
      create policy "attachments: delete with task" on storage.objects
        for delete to authenticated
        using (bucket_id = 'attachments' and private.can_write_task(private.attachment_task(name)))
    $p$;
  end if;
end;
$do$;
