-- =============================================================================
-- Taskora — share projects with guests
-- An invite can name projects; when a guest accepts it they're added to those projects. Guests only
-- ever see projects they've been added to (see private.can_view_project), can comment, and can't edit.
-- =============================================================================
alter table public.workspace_invites
  add column if not exists project_ids uuid[] not null default '{}';

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
    -- Already accepted by this person: just open the workspace.
    select * into v_invite from public.workspace_invites where token = p_token;
    if v_invite.id is not null and v_invite.accepted_at is not null and exists (
      select 1 from public.workspace_members
      where workspace_id = v_invite.workspace_id and user_id = v_user
    ) then
      return v_invite.workspace_id;
    end if;
    raise exception 'INVITE_INVALID' using errcode = 'P0001', hint = 'This invite link has expired or was already used.';
  end if;
  if v_invite.email <> v_email then
    raise exception 'INVITE_WRONG_EMAIL' using errcode = 'P0001', hint = 'This invite was sent to a different email address.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invite.workspace_id, v_user, v_invite.role)
  on conflict (workspace_id, user_id) do nothing;

  -- Projects named on the invite (only ones in this workspace that still exist).
  insert into public.project_guests (project_id, user_id)
  select p.id, v_user
  from public.projects p
  where p.id = any (v_invite.project_ids) and p.workspace_id = v_invite.workspace_id
  on conflict do nothing;

  update public.workspace_invites set accepted_at = now() where id = v_invite.id;

  insert into public.notifications (user_id, workspace_id, kind, actor_id, title)
  select v_invite.invited_by, v_invite.workspace_id, 'invite_accepted', v_user, 'accepted your workspace invite'
  where v_invite.invited_by is not null and v_invite.invited_by <> v_user;

  return v_invite.workspace_id;
end;
$$;

revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;
