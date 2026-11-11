-- =============================================================================
-- Taskora — the shared demo account can't create workspaces
-- Everyone who clicks "Try the demo" signs in as the same account, so anything it created outside the
-- demo workspace would be visible to every visitor and never reset. Real users are never members of a
-- demo workspace, so membership identifies the demo account. The server (no auth.uid()) is unaffected.
-- =============================================================================
create or replace function private.block_demo_workspace_create()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and exists (
    select 1
    from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
    where m.user_id = auth.uid() and w.is_demo
  ) then
    raise exception 'DEMO_ACCOUNT: sign up to create your own workspace' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists workspaces_block_demo_create on public.workspaces;
create trigger workspaces_block_demo_create
  before insert on public.workspaces
  for each row execute function private.block_demo_workspace_create();
