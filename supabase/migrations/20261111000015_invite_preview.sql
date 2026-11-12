-- =============================================================================
-- Taskora — the invite page knows the invite's state before anyone clicks Accept
-- Whoever holds the (secret) link can see which workspace it is for, who sent it, and whether it
-- still works. The invited email is shown masked when someone signed in with another address opens it.
-- =============================================================================
create or replace function public.invite_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_invite public.workspace_invites;
  v_workspace text;
  v_slug text;
  v_inviter text;
  v_status text;
  v_masked text;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into v_invite from public.workspace_invites where token = p_token;
  if v_invite.id is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  select w.name, w.slug into v_workspace, v_slug from public.workspaces w where w.id = v_invite.workspace_id;
  select nullif(p.full_name, '') into v_inviter from public.profiles p where p.id = v_invite.invited_by;
  select lower(email) into v_email from public.profiles where id = v_user;

  if exists (
    select 1 from public.workspace_members
    where workspace_id = v_invite.workspace_id and user_id = v_user
  ) then
    v_status := 'member';
  elsif v_invite.accepted_at is not null then
    v_status := 'used';
  elsif v_invite.expires_at <= now() then
    v_status := 'expired';
  elsif v_invite.email <> v_email then
    v_status := 'wrong_email';
  else
    v_status := 'ok';
  end if;

  -- a***@gmail.com
  v_masked := left(v_invite.email, 1) || '***' || substr(v_invite.email, position('@' in v_invite.email));

  return jsonb_build_object(
    'status', v_status,
    'workspace', v_workspace,
    'slug', case when v_status = 'member' then v_slug end,
    'inviter', v_inviter,
    'role', v_invite.role,
    'email', case when v_status = 'ok' then v_invite.email else v_masked end
  );
end;
$$;

revoke execute on function public.invite_preview(text) from public, anon;
grant execute on function public.invite_preview(text) to authenticated;
