-- =============================================================================
-- Taskora — demo workspace
--
-- public.reset_demo() rebuilds the "Halcyon Labs" demo workspace from scratch.
-- It runs when the demo is first set up and again every night, so visitors
-- always land in a fresh workspace. All dates are relative to today, which keeps
-- the demo looking current: something is always due today, a sprint is always
-- running and the charts always cover the last eight weeks.
--
-- Only the server (service role) can call it.
-- =============================================================================

-- First status of a given category in a project.
create or replace function private.status_of(p_project uuid, p_category public.status_category)
returns uuid
language sql
stable
set search_path = ''
as $$
  select id from public.task_statuses
  where project_id = p_project and category = p_category
  order by position
  limit 1;
$$;

-- Human task reference, e.g. MOB-136.
create or replace function private.task_ref(p_task uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select p.key || '-' || t.number
  from public.tasks t join public.projects p on p.id = t.project_id
  where t.id = p_task;
$$;

-- Insert one demo task with its labels.
create or replace function private.demo_task(
  p_project uuid,
  p_title text,
  p_category public.status_category,
  p_priority public.task_priority default 'none',
  p_assignee uuid default null,
  p_creator uuid default null,
  p_start date default null,
  p_due date default null,
  p_estimate integer default null,
  p_sprint uuid default null,
  p_labels uuid[] default '{}',
  p_description text default '',
  p_parent uuid default null,
  p_created_at timestamptz default null,
  p_completed_at timestamptz default null,
  p_source public.task_source default 'app',
  p_requester text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.tasks (
    project_id, title, description, status_id, priority, assignee_id, creator_id,
    start_date, due_date, estimate, sprint_id, parent_id, created_at, completed_at,
    source, requester_email
  )
  values (
    p_project, p_title, p_description, private.status_of(p_project, p_category), p_priority,
    p_assignee, p_creator, p_start, p_due, p_estimate::smallint, p_sprint, p_parent,
    coalesce(p_created_at, now()), p_completed_at, p_source, p_requester
  )
  returning id into v_id;

  if coalesce(array_length(p_labels, 1), 0) > 0 then
    insert into public.task_labels (task_id, label_id)
    select v_id, l from unnest(p_labels) as l
    on conflict do nothing;
  end if;

  return v_id;
end;
$$;

create or replace function public.reset_demo(p_email text default 'demo@taskora.example')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d date := current_date;
  n timestamptz := now();
  v_owner uuid;
  v_ws uuid;

  -- Teammates (fixed ids so the demo is stable between resets)
  u_sara   uuid := '00000000-0000-4000-8000-00000000a001';
  u_zain   uuid := '00000000-0000-4000-8000-00000000a002';
  u_ayesha uuid := '00000000-0000-4000-8000-00000000a003';
  u_omar   uuid := '00000000-0000-4000-8000-00000000a004';
  u_daniel uuid := '00000000-0000-4000-8000-00000000a005';
  u_priya  uuid := '00000000-0000-4000-8000-00000000a006';
  u_mei    uuid := '00000000-0000-4000-8000-00000000a007';
  u_lena   uuid := '00000000-0000-4000-8000-00000000a008';

  p_mob uuid; p_web uuid; p_mkt uuid; p_cus uuid;
  l_bug uuid; l_feature uuid; l_design uuid; l_backend uuid; l_frontend uuid;
  l_mobile uuid; l_payments uuid; l_ai uuid; l_request uuid;
  sp11 uuid; sp12 uuid; sp13 uuid;
  f_client uuid; f_budget uuid; f_platform uuid;
  g1 uuid; g2 uuid; g3 uuid;
  c1 uuid; c2 uuid;

  t_auth uuid; t_stripe uuid; t_ai uuid; t_crash uuid; t_kanban uuid; t_onb uuid;
  t_push uuid; t_apple uuid; t_demo uuid; t_safari uuid; t_email_review uuid;
  t_tax uuid; t_form_bug uuid; t_guest_q uuid;

  v_people uuid[];
  v_projects uuid[];
  v_friday date;
  v_created_days integer;
  i integer;
begin
  select id into v_owner from auth.users where lower(email) = lower(p_email);
  if v_owner is null then
    raise exception 'DEMO_USER_MISSING' using errcode = 'P0001',
      hint = 'Create the demo user first: npm run demo:setup';
  end if;

  v_friday := d + ((5 - extract(isodow from d)::integer + 7) % 7);

  -- ---------------------------------------------------------------------------
  -- People. Teammates are sign-in-less accounts that exist only for the demo.
  -- ---------------------------------------------------------------------------
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  select x.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', x.email,
         jsonb_build_object('full_name', x.name), '{"provider": "email", "providers": ["email"]}'::jsonb, n, n
  from (values
    (u_sara, 'sara@halcyon.example', 'Sara Rehman'),
    (u_zain, 'zain@halcyon.example', 'Zain Malik'),
    (u_ayesha, 'ayesha@halcyon.example', 'Ayesha Khan'),
    (u_omar, 'omar@halcyon.example', 'Omar Siddiqui'),
    (u_daniel, 'daniel@halcyon.example', 'Daniel Brooks'),
    (u_priya, 'priya@halcyon.example', 'Priya Nair'),
    (u_mei, 'mei@halcyon.example', 'Mei Tanaka'),
    (u_lena, 'lena@acme.example', 'Lena Fischer')
  ) as x(id, email, name)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, email)
  select u.id, u.raw_user_meta_data ->> 'full_name', u.email
  from auth.users u
  where u.id in (u_sara, u_zain, u_ayesha, u_omar, u_daniel, u_priya, u_mei, u_lena)
  on conflict (id) do update set full_name = excluded.full_name, email = excluded.email;

  insert into public.profiles (id, full_name, email)
  values (v_owner, 'Alex Morgan', lower(p_email))
  on conflict (id) do update set full_name = 'Alex Morgan';

  -- Start clean: removing the workspace removes everything inside it.
  delete from public.workspaces where is_demo;

  -- ---------------------------------------------------------------------------
  -- Workspace, members, labels
  -- ---------------------------------------------------------------------------
  insert into public.workspaces (
    name, slug, plan, is_demo, created_by, subscription_status, current_period_end,
    ai_credits_used, ai_credits_period_start
  )
  values ('Halcyon Labs', 'demo', 'pro', true, v_owner, 'active', n + interval '20 days', 72, date_trunc('month', n))
  returning id into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role) values
    (v_ws, u_sara, 'admin'),
    (v_ws, u_zain, 'member'),
    (v_ws, u_ayesha, 'member'),
    (v_ws, u_omar, 'member'),
    (v_ws, u_daniel, 'member'),
    (v_ws, u_priya, 'member'),
    (v_ws, u_mei, 'member'),
    (v_ws, u_lena, 'guest');

  select id into l_bug from public.labels where workspace_id = v_ws and name = 'Bug';
  select id into l_feature from public.labels where workspace_id = v_ws and name = 'Feature';
  select id into l_design from public.labels where workspace_id = v_ws and name = 'Design';
  select id into l_backend from public.labels where workspace_id = v_ws and name = 'Backend';
  select id into l_frontend from public.labels where workspace_id = v_ws and name = 'Frontend';
  insert into public.labels (workspace_id, name, tone) values (v_ws, 'Mobile', 'info') returning id into l_mobile;
  insert into public.labels (workspace_id, name, tone) values (v_ws, 'Payments', 'warning') returning id into l_payments;
  insert into public.labels (workspace_id, name, tone) values (v_ws, 'AI', 'accent') returning id into l_ai;
  insert into public.labels (workspace_id, name, tone) values (v_ws, 'Client request', 'neutral') returning id into l_request;

  -- ---------------------------------------------------------------------------
  -- Projects
  -- ---------------------------------------------------------------------------
  insert into public.projects (workspace_id, key, name, description, color, health, lead_id, start_date, target_date, created_by)
  values (v_ws, 'MOB', 'Mobile App v2.0', 'The 2.0 release of our iOS and Android app: payments, onboarding and AI features.',
          '#CDF461', 'on_track', v_owner, d - 30, d + 14, v_owner)
  returning id into p_mob;
  insert into public.projects (workspace_id, key, name, description, color, health, lead_id, start_date, target_date, created_by)
  values (v_ws, 'WEB', 'Website Redesign', 'New marketing site with a faster homepage, clearer pricing and a rebuilt blog.',
          '#6CA8FF', 'at_risk', u_priya, d - 40, d + 30, v_owner)
  returning id into p_web;
  insert into public.projects (workspace_id, key, name, description, color, health, lead_id, start_date, target_date, created_by)
  values (v_ws, 'MKT', 'Q4 Marketing Launch', 'Everything for the 2.0 launch: emails, Product Hunt, webinar and paid social.',
          '#F5B841', 'on_track', u_sara, d - 20, d + 35, v_owner)
  returning id into p_mkt;
  insert into public.projects (workspace_id, key, name, description, color, health, lead_id, start_date, target_date, created_by)
  values (v_ws, 'CUS', 'Customer Portal', 'Self-serve portal where clients raise requests, track work and download invoices.',
          '#E58BD8', 'on_track', u_ayesha, d - 60, d + 45, v_owner)
  returning id into p_cus;

  -- Realistic task numbers (these projects have history).
  update public.projects set task_seq = 117 where id = p_mob;
  update public.projects set task_seq = 80 where id = p_web;
  update public.projects set task_seq = 20 where id = p_mkt;
  update public.projects set task_seq = 9 where id = p_cus;

  insert into public.project_favorites (user_id, project_id) values (v_owner, p_mob);
  insert into public.project_guests (project_id, user_id) values (p_cus, u_lena);

  -- Sprints (Mobile App)
  insert into public.sprints (project_id, name, goal, start_date, end_date, state)
  values (p_mob, 'Sprint 11', 'Accounts, roles and the new design system.', d - 22, d - 9, 'completed')
  returning id into sp11;
  insert into public.sprints (project_id, name, goal, start_date, end_date, state)
  values (p_mob, 'Sprint 12', 'Payments and onboarding ready for beta.', d - 8, d + 5, 'active')
  returning id into sp12;
  insert into public.sprints (project_id, name, goal, start_date, end_date, state)
  values (p_mob, 'Sprint 13', 'Notifications and polish before the beta release.', d + 6, d + 19, 'planned')
  returning id into sp13;

  -- Custom fields (Mobile App)
  insert into public.custom_fields (project_id, name, kind, options, position)
  values (p_mob, 'Client', 'select', '["Acme Corp", "Northwind", "Internal"]', 0) returning id into f_client;
  insert into public.custom_fields (project_id, name, kind, options, position)
  values (p_mob, 'Budget', 'number', '[]', 1) returning id into f_budget;
  insert into public.custom_fields (project_id, name, kind, options, position)
  values (p_mob, 'Platform', 'select', '["iOS + Android", "iOS", "Android", "Backend"]', 2) returning id into f_platform;

  -- ---------------------------------------------------------------------------
  -- Mobile App tasks
  -- ---------------------------------------------------------------------------
  perform private.demo_task(p_mob, 'App icon & splash screen', 'completed', 'low', u_sara, u_sara,
    p_due => d - 13, p_estimate => 2, p_sprint => sp11, p_labels => array[l_design],
    p_created_at => n - interval '26 days', p_completed_at => n - interval '13 days');
  perform private.demo_task(p_mob, 'Set up CI builds for iOS and Android', 'completed', 'medium', u_zain, u_zain,
    p_due => d - 12, p_estimate => 3, p_sprint => sp11, p_labels => array[l_backend],
    p_created_at => n - interval '25 days', p_completed_at => n - interval '12 days');
  t_auth := private.demo_task(p_mob, 'Supabase auth + roles', 'completed', 'high', v_owner, v_owner,
    p_start => d - 20, p_due => d - 11, p_estimate => 5, p_sprint => sp11, p_labels => array[l_backend],
    p_description => 'Email and Google sign-in, workspace roles (owner, admin, member, guest) and row level security on every table.',
    p_created_at => n - interval '24 days', p_completed_at => n - interval '10 days');
  perform private.demo_task(p_mob, 'Mobile design tokens', 'completed', 'medium', u_sara, u_sara,
    p_due => d - 10, p_estimate => 3, p_sprint => sp11, p_labels => array[l_design],
    p_created_at => n - interval '23 days', p_completed_at => n - interval '9 days');

  t_kanban := private.demo_task(p_mob, 'Kanban drag & drop reorder', 'review', 'high', u_ayesha, v_owner,
    p_start => d - 6, p_due => d + 1, p_estimate => 3, p_sprint => sp12, p_labels => array[l_mobile],
    p_description => 'Drag cards between columns and reorder inside a column. The new order must survive a refresh and sync to other people in real time.',
    p_created_at => n - interval '9 days');

  t_stripe := private.demo_task(p_mob, 'Set up Stripe subscriptions & webhooks', 'started', 'urgent', v_owner, v_owner,
    p_start => d - 7, p_due => d, p_estimate => 8, p_sprint => sp12, p_labels => array[l_payments, l_backend],
    p_description => 'Connect Stripe Checkout for the Pro and Business plans. Handle checkout.session.completed, customer.subscription.updated and cancellations so the workspace plan always matches Stripe.' || chr(10) || chr(10) ||
      'Free plan stays limited to 3 projects and 5 members. Add a billing portal link in Settings.',
    p_created_at => n - interval '8 days');

  t_ai := private.demo_task(p_mob, 'AI task summary endpoint', 'started', 'high', v_owner, v_owner,
    p_start => d - 2, p_due => d + 2, p_estimate => 5, p_sprint => sp12, p_labels => array[l_ai, l_backend],
    p_description => 'API route that summarizes a task''s description and comments into three short lines. Count one AI credit per call.',
    p_created_at => n - interval '7 days');

  t_crash := private.demo_task(p_mob, 'Crash on Android 14 login', 'started', 'urgent', u_zain, u_ayesha,
    p_start => d - 7, p_due => d - 2, p_estimate => 2, p_sprint => sp12, p_labels => array[l_bug, l_mobile],
    p_description => 'App closes right after Google sign-in on Android 14. Reported by three beta testers.',
    p_created_at => n - interval '8 days');

  t_onb := private.demo_task(p_mob, 'Design onboarding screens', 'unstarted', 'high', u_sara, v_owner,
    p_start => d - 4, p_due => d + 3, p_estimate => 5, p_sprint => sp12, p_labels => array[l_design],
    p_description => 'Four screens: welcome, create workspace, invite teammates, pick a template.',
    p_created_at => n - interval '6 days');

  perform private.demo_task(p_mob, 'Beta tester welcome email', 'started', 'medium', u_mei, u_sara,
    p_due => d + 2, p_estimate => 2, p_sprint => sp12, p_labels => array[l_feature],
    p_created_at => n - interval '5 days');
  perform private.demo_task(p_mob, 'App Store screenshots', 'unstarted', 'low', u_sara, u_sara,
    p_due => d + 5, p_estimate => 2, p_sprint => sp12, p_labels => array[l_design],
    p_created_at => n - interval '4 days');

  -- Sprint 12 work finished so far (gives the burndown a realistic shape).
  perform private.demo_task(p_mob, 'Pricing plans in the paywall', 'completed', 'high', v_owner, v_owner,
    p_due => d - 6, p_estimate => 3, p_sprint => sp12, p_labels => array[l_payments],
    p_created_at => n - interval '9 days', p_completed_at => n - interval '6 days 3 hours');
  perform private.demo_task(p_mob, 'Session refresh on app resume', 'completed', 'medium', u_zain, u_zain,
    p_due => d - 5, p_estimate => 2, p_sprint => sp12, p_labels => array[l_mobile, l_backend],
    p_created_at => n - interval '9 days', p_completed_at => n - interval '5 days 5 hours');
  perform private.demo_task(p_mob, 'Empty states for tasks and inbox', 'completed', 'low', u_sara, u_sara,
    p_due => d - 4, p_estimate => 2, p_sprint => sp12, p_labels => array[l_design],
    p_created_at => n - interval '8 days', p_completed_at => n - interval '4 days 2 hours');
  perform private.demo_task(p_mob, 'Workspace switcher', 'completed', 'medium', u_ayesha, v_owner,
    p_due => d - 3, p_estimate => 3, p_sprint => sp12, p_labels => array[l_mobile],
    p_created_at => n - interval '8 days', p_completed_at => n - interval '2 days 6 hours');
  perform private.demo_task(p_mob, 'Rate limit the auth endpoints', 'completed', 'high', u_omar, u_zain,
    p_due => d - 1, p_estimate => 2, p_sprint => sp12, p_labels => array[l_backend],
    p_created_at => n - interval '7 days', p_completed_at => n - interval '1 day 4 hours');

  t_push := private.demo_task(p_mob, 'Push notification preferences', 'unstarted', 'medium', u_ayesha, v_owner,
    p_start => d + 4, p_due => d + 6, p_estimate => 3, p_sprint => sp13, p_labels => array[l_mobile],
    p_created_at => n - interval '6 days');
  t_apple := private.demo_task(p_mob, 'Add Apple Sign-In', 'backlog', 'medium', u_zain, v_owner,
    p_due => d + 11, p_estimate => 3, p_sprint => sp13, p_labels => array[l_mobile, l_backend],
    p_created_at => n - interval '12 days');
  perform private.demo_task(p_mob, 'Offline mode for task list', 'backlog', 'low', u_ayesha, u_ayesha,
    p_due => d + 18, p_estimate => 8, p_labels => array[l_mobile], p_created_at => n - interval '15 days');
  perform private.demo_task(p_mob, 'Export reports as CSV', 'backlog', 'low', u_sara, v_owner,
    p_due => d + 22, p_estimate => 2, p_labels => array[l_backend], p_created_at => n - interval '14 days');
  perform private.demo_task(p_mob, 'Rate limiting for the public API', 'backlog', 'medium', u_omar, u_omar,
    p_estimate => 3, p_labels => array[l_backend], p_created_at => n - interval '11 days');

  t_demo := private.demo_task(p_mob, 'Weekly client demo', 'unstarted', 'medium', v_owner, v_owner,
    p_due => v_friday, p_description => 'Show Acme the work finished this week. Keep it to 20 minutes.',
    p_created_at => n - interval '30 days');
  update public.tasks
  set recurrence = '{"freq": "weekly", "interval": 1, "byweekday": ["FR"]}'::jsonb
  where id = t_demo;

  -- Subtasks
  perform private.demo_task(p_mob, 'Create products & prices in Stripe', 'completed', 'none', v_owner, v_owner,
    p_parent => t_stripe, p_sprint => sp12, p_created_at => n - interval '8 days', p_completed_at => n - interval '6 days');
  perform private.demo_task(p_mob, 'Checkout session API route', 'completed', 'none', v_owner, v_owner,
    p_parent => t_stripe, p_sprint => sp12, p_created_at => n - interval '8 days', p_completed_at => n - interval '4 days');
  perform private.demo_task(p_mob, 'Verify webhook signatures', 'completed', 'none', v_owner, v_owner,
    p_parent => t_stripe, p_sprint => sp12, p_created_at => n - interval '8 days', p_completed_at => n - interval '2 days');
  perform private.demo_task(p_mob, 'Sync plan on subscription.updated', 'started', 'none', v_owner, v_owner,
    p_parent => t_stripe, p_sprint => sp12, p_created_at => n - interval '8 days');
  perform private.demo_task(p_mob, 'Billing portal button in Settings', 'unstarted', 'none', u_sara, v_owner,
    p_parent => t_stripe, p_sprint => sp12, p_created_at => n - interval '8 days');

  perform private.demo_task(p_mob, 'Prompt that returns three short lines', 'completed', 'none', v_owner, v_owner,
    p_parent => t_ai, p_created_at => n - interval '6 days', p_completed_at => n - interval '2 days');
  perform private.demo_task(p_mob, 'Count AI credits per call', 'completed', 'none', v_owner, v_owner,
    p_parent => t_ai, p_created_at => n - interval '6 days', p_completed_at => n - interval '1 day');
  perform private.demo_task(p_mob, 'Include the latest comments', 'started', 'none', v_owner, v_owner,
    p_parent => t_ai, p_created_at => n - interval '6 days');
  perform private.demo_task(p_mob, 'Cache the summary until the task changes', 'unstarted', 'none', v_owner, v_owner,
    p_parent => t_ai, p_created_at => n - interval '6 days');

  perform private.demo_task(p_mob, 'Reorder inside a column', 'completed', 'none', u_ayesha, u_ayesha,
    p_parent => t_kanban, p_created_at => n - interval '9 days', p_completed_at => n - interval '5 days');
  perform private.demo_task(p_mob, 'Move between columns', 'completed', 'none', u_ayesha, u_ayesha,
    p_parent => t_kanban, p_created_at => n - interval '9 days', p_completed_at => n - interval '4 days');
  perform private.demo_task(p_mob, 'Keep order after refresh', 'completed', 'none', u_ayesha, u_ayesha,
    p_parent => t_kanban, p_created_at => n - interval '9 days', p_completed_at => n - interval '2 days');
  perform private.demo_task(p_mob, 'Keyboard support for moving cards', 'completed', 'none', u_ayesha, u_ayesha,
    p_parent => t_kanban, p_created_at => n - interval '9 days', p_completed_at => n - interval '1 day');

  -- Dependencies
  insert into public.task_dependencies (task_id, blocked_by_id) values
    (t_stripe, t_auth),
    (t_push, t_onb),
    (t_apple, t_crash);

  -- Custom field values
  insert into public.task_field_values (task_id, field_id, value)
  select t.id, f_client, '"Acme Corp"'::jsonb
  from public.tasks t where t.project_id = p_mob and t.parent_id is null and t.completed_at is null;
  insert into public.task_field_values (task_id, field_id, value) values
    (t_stripe, f_budget, '1200'), (t_stripe, f_platform, '"iOS + Android"'),
    (t_ai, f_budget, '800'), (t_ai, f_platform, '"Backend"'),
    (t_crash, f_budget, '300'), (t_crash, f_platform, '"Android"'),
    (t_onb, f_budget, '600'), (t_onb, f_platform, '"iOS + Android"'),
    (t_push, f_budget, '400'), (t_push, f_platform, '"iOS + Android"'),
    (t_apple, f_budget, '350'), (t_apple, f_platform, '"iOS"'),
    (t_kanban, f_budget, '500'), (t_kanban, f_platform, '"iOS + Android"');

  -- ---------------------------------------------------------------------------
  -- Website, Marketing and Customer Portal tasks
  -- ---------------------------------------------------------------------------
  t_safari := private.demo_task(p_web, 'Fix pricing page layout on Safari', 'started', 'high', v_owner, u_priya,
    p_start => d - 4, p_due => d - 1, p_estimate => 2, p_labels => array[l_bug, l_frontend],
    p_description => 'Plan cards overlap on Safari 17 below 1100px wide.', p_created_at => n - interval '5 days');
  perform private.demo_task(p_web, 'New homepage hero', 'review', 'high', u_daniel, u_priya,
    p_start => d - 6, p_due => d + 2, p_estimate => 3, p_labels => array[l_frontend, l_design], p_created_at => n - interval '9 days');
  perform private.demo_task(p_web, 'Migrate blog to MDX', 'unstarted', 'medium', u_daniel, u_priya,
    p_start => d + 3, p_due => d + 9, p_estimate => 5, p_labels => array[l_frontend], p_created_at => n - interval '10 days');
  perform private.demo_task(p_web, 'Pricing page A/B test', 'unstarted', 'medium', u_omar, u_priya,
    p_due => d + 12, p_estimate => 3, p_created_at => n - interval '7 days');
  perform private.demo_task(p_web, 'Accessibility audit', 'backlog', 'medium', u_priya, u_priya,
    p_due => d + 25, p_estimate => 5, p_labels => array[l_frontend], p_created_at => n - interval '16 days');
  perform private.demo_task(p_web, 'Image CDN and lazy loading', 'backlog', 'low', u_daniel, u_daniel,
    p_estimate => 2, p_labels => array[l_frontend], p_created_at => n - interval '18 days');

  t_email_review := private.demo_task(p_mkt, 'Review launch email copy', 'unstarted', 'high', v_owner, u_mei,
    p_due => d, p_estimate => 1, p_created_at => n - interval '3 days');
  perform private.demo_task(p_mkt, 'Launch email sequence', 'started', 'high', u_mei, u_sara,
    p_start => d - 3, p_due => d + 1, p_estimate => 3, p_labels => array[l_feature], p_created_at => n - interval '8 days');
  perform private.demo_task(p_mkt, 'Product Hunt assets', 'unstarted', 'medium', u_sara, u_sara,
    p_due => d + 5, p_estimate => 3, p_labels => array[l_design], p_created_at => n - interval '6 days');
  perform private.demo_task(p_mkt, 'Paid social budget plan', 'review', 'medium', u_omar, u_sara,
    p_due => d + 3, p_estimate => 2, p_created_at => n - interval '7 days');
  perform private.demo_task(p_mkt, 'Webinar landing page', 'backlog', 'low', u_daniel, u_sara,
    p_due => d + 20, p_estimate => 3, p_labels => array[l_frontend], p_created_at => n - interval '10 days');

  t_tax := private.demo_task(p_cus, 'Invoice tax ID field', 'unstarted', 'medium', v_owner, u_ayesha,
    p_due => d + 3, p_estimate => 2, p_labels => array[l_request, l_frontend], p_created_at => n - interval '2 days');
  perform private.demo_task(p_cus, 'Ticket search and filters', 'started', 'high', u_ayesha, u_ayesha,
    p_start => d - 3, p_due => d + 4, p_estimate => 5, p_labels => array[l_frontend], p_created_at => n - interval '9 days');
  perform private.demo_task(p_cus, 'SSO for enterprise clients', 'backlog', 'medium', u_omar, u_ayesha,
    p_estimate => 8, p_labels => array[l_backend], p_created_at => n - interval '20 days');

  -- Triage: requests from the public form and from the client guest
  t_form_bug := private.demo_task(p_cus, 'App crashes after login on my Pixel 8', 'triage', 'urgent',
    p_description => '**Steps to reproduce**' || chr(10) || '1. Open the app 2. Sign in with Google 3. App closes',
    p_created_at => n - interval '12 minutes', p_source => 'form', p_requester => 'lena@acme.example');
  t_guest_q := private.demo_task(p_cus, 'Can invoices show our company tax ID?', 'triage', 'medium', p_creator => u_lena,
    p_created_at => n - interval '1 hour', p_labels => array[l_request]);
  perform private.demo_task(p_cus, 'Dark mode for the client portal', 'triage', 'low',
    p_created_at => n - interval '1 day', p_source => 'form', p_requester => 'tom@northwind.example');

  -- ---------------------------------------------------------------------------
  -- Eight weeks of finished work for the dashboard, plus a realistic backlog.
  -- Deterministic (no random()) so every reset looks the same.
  -- ---------------------------------------------------------------------------
  v_people := array[v_owner, u_sara, u_zain, u_ayesha, u_omar, u_daniel, u_priya, u_mei];
  v_projects := array[p_mob, p_web, p_mkt, p_cus];

  for i in 1..160 loop
    -- skewed towards recent weeks so the "completed" trend rises
    v_created_days := 7 + 49 - floor(sqrt(((i * 37) % 2500)::numeric))::integer;
    perform private.demo_task(
      v_projects[1 + (i % 4)],
      (array['Fix', 'Polish', 'Write', 'Review', 'Update', 'Refactor', 'Test', 'Document'])[1 + (i % 8)] || ' ' ||
        (array['settings screen', 'search results', 'invoice emails', 'sign-up flow', 'reporting queries',
               'team page', 'notification copy', 'image uploads', 'pricing table', 'error states'])[1 + ((i * 7) % 10)],
      'completed',
      (array['low', 'medium', 'medium', 'high'])[1 + (i % 4)]::public.task_priority,
      v_people[1 + ((i * 3) % 8)],
      v_people[1 + (i % 8)],
      p_estimate => 1 + (i % 5),
      p_created_at => n - make_interval(days => v_created_days),
      p_completed_at => n - make_interval(days => v_created_days - (1 + (i % 6)))
    );
  end loop;

  for i in 1..40 loop
    perform private.demo_task(
      v_projects[1 + (i % 4)],
      (array['Explore', 'Investigate', 'Spike:', 'Idea:', 'Clean up'])[1 + (i % 5)] || ' ' ||
        (array['bulk task editing', 'saved filters', 'calendar sync', 'two-factor login', 'audit log export',
               'slow board loading', 'email digests', 'public roadmap', 'task templates', 'mobile widgets'])[1 + ((i * 3) % 10)],
      'backlog',
      (array['none', 'low', 'medium'])[1 + (i % 3)]::public.task_priority,
      case when i % 3 = 0 then null else v_people[1 + ((i * 5) % 8)] end,
      v_people[1 + (i % 8)],
      p_created_at => n - make_interval(days => 3 + (i * 2) % 50)
    );
  end loop;

  -- ---------------------------------------------------------------------------
  -- Conversation, time, automations, forms, goals, updates, billing
  -- ---------------------------------------------------------------------------
  insert into public.comments (task_id, author_id, body, created_at)
  values (t_stripe, u_sara, 'Pricing modal design is attached. Business plan should show "Contact us" above 25 seats.', n - interval '2 hours')
  returning id into c1;
  insert into public.comments (task_id, author_id, body, created_at)
  values (t_stripe, u_zain, '@Alex staging is missing the Stripe test keys, so webhooks fail there. Can you add them to Vercel?', n - interval '40 minutes')
  returning id into c2;
  insert into public.comments (task_id, author_id, body, created_at) values
    (t_crash, u_zain, 'Reproduced on a Pixel 8 and a Galaxy S24. It happens on the Google sign-in redirect.', n - interval '1 day'),
    (t_crash, u_ayesha, 'Two more beta testers reported it this morning.', n - interval '5 hours'),
    (t_kanban, u_ayesha, 'Ready for review. Reordering now survives a refresh and shows up for others instantly.', n - interval '5 hours'),
    (t_onb, u_sara, 'First draft of all four screens is in Figma.', n - interval '3 hours'),
    (t_guest_q, u_lena, 'Our finance team needs the tax ID on every invoice for the new fiscal year.', n - interval '1 hour');

  insert into public.comment_reactions (comment_id, user_id, emoji) values
    (c1, v_owner, '👍'), (c1, u_zain, '👍'), (c2, u_sara, '👀');

  insert into public.time_entries (task_id, user_id, started_at, ended_at, note) values
    (t_stripe, v_owner, n - interval '3 days 5 hours', n - interval '3 days 2 hours', 'Products, prices and checkout session'),
    (t_stripe, v_owner, n - interval '2 days 4 hours', n - interval '2 days 1 hour 55 minutes', 'Webhook signature checks'),
    (t_stripe, v_owner, n - interval '1 day 3 hours', n - interval '1 day 1 hour 45 minutes', 'Plan sync on subscription.updated'),
    (t_ai, v_owner, n - interval '1 day 7 hours', n - interval '1 day 3 hours 55 minutes', 'Prompt and credit counting'),
    (t_kanban, u_ayesha, n - interval '4 days 6 hours', n - interval '4 days 15 minutes', 'Drag and drop between columns'),
    (t_kanban, u_ayesha, n - interval '2 days 3 hours', n - interval '2 days 2 hours', 'Persist order'),
    (t_crash, u_zain, n - interval '1 day 2 hours', n - interval '1 day 20 minutes', 'Reproduce and trace'),
    (t_onb, u_sara, n - interval '1 day 6 hours', n - interval '1 day 2 hours 30 minutes', 'Figma draft');
  -- Zain has a timer running right now. The demo account starts with none, so visitors never see
  -- a clock that has been ticking since the nightly reset.
  insert into public.time_entries (task_id, user_id, started_at, note)
  values (t_crash, u_zain, n - interval '40 minutes', '');

  insert into public.automations (project_id, name, trigger, conditions, actions, enabled, run_count, last_run_at, created_by) values
    (p_mob, 'Review goes to Sara',
      '{"type": "status_changed", "to_category": "review"}', '[]',
      jsonb_build_array(jsonb_build_object('type', 'assign', 'user_id', u_sara), jsonb_build_object('type', 'notify', 'user_id', u_sara)),
      true, 41, n - interval '20 minutes', v_owner),
    (p_mob, 'Clean up finished tasks',
      '{"type": "status_changed", "to_category": "completed"}', '[]',
      '[{"type": "stop_timers"}, {"type": "complete_subtasks"}]',
      true, 58, n - interval '1 hour', v_owner),
    (p_mob, 'Raise priority when due tomorrow',
      '{"type": "due_in", "days": 1}', '[{"field": "status_category", "op": "not_in", "value": ["completed", "canceled"]}]',
      '[{"type": "set_priority", "priority": "high"}, {"type": "notify_assignee"}]',
      true, 27, n - interval '3 hours', v_owner),
    (p_mob, 'Bugs go to Triage',
      '{"type": "label_added"}', jsonb_build_array(jsonb_build_object('field', 'label_id', 'op', 'eq', 'value', l_bug)),
      '[{"type": "move_to_category", "category": "triage"}]',
      true, 6, n - interval '1 day', v_owner),
    (p_cus, 'Tag form requests',
      '{"type": "task_created"}', '[{"field": "source", "op": "eq", "value": "form"}]',
      jsonb_build_array(jsonb_build_object('type', 'add_label', 'label_id', l_request)),
      false, 0, null, v_owner);

  insert into public.forms (project_id, slug, title, description, fields, submission_count, created_by) values
    (p_cus, 'demo-bug-report', 'Report a bug', 'Tell us what went wrong. Our team gets it as a task right away.',
      '[{"id": "q1", "label": "What happened?", "type": "short_text", "required": true, "maps_to": "title"},
        {"id": "q2", "label": "Steps to reproduce", "type": "long_text", "required": false, "maps_to": "description"},
        {"id": "q3", "label": "How urgent?", "type": "select", "options": ["Blocking my work", "High", "Medium", "Low"], "required": false, "maps_to": "priority"},
        {"id": "q4", "label": "Your email", "type": "email", "required": true, "maps_to": "requester_email"}]',
      38, v_owner),
    (p_cus, 'demo-feature-request', 'Request a feature', 'Share an idea for the client portal.',
      '[{"id": "q1", "label": "What would you like?", "type": "short_text", "required": true, "maps_to": "title"},
        {"id": "q2", "label": "Why does it matter?", "type": "long_text", "required": false, "maps_to": "description"},
        {"id": "q3", "label": "Your email", "type": "email", "required": true, "maps_to": "requester_email"}]',
      12, v_owner);

  insert into public.goals (workspace_id, title, description, owner_id, period, due_date, health)
  values (v_ws, 'Launch mobile app v2.0 beta', 'Get 200 beta testers onto the new app with a crash-free experience.', v_owner, 'Q4 2026', d + 50, 'on_track')
  returning id into g1;
  insert into public.goals (workspace_id, title, description, owner_id, period, due_date, health)
  values (v_ws, 'Grow paid workspaces', 'Reach 200 paying workspaces by the end of the quarter.', u_sara, 'Q4 2026', d + 50, 'at_risk')
  returning id into g2;
  insert into public.goals (workspace_id, title, description, owner_id, period, due_date, health)
  values (v_ws, 'Faster customer support', 'Answer every client request in under four hours.', u_ayesha, 'Q4 2026', d + 50, 'on_track')
  returning id into g3;

  insert into public.key_results (goal_id, title, start_value, current_value, target_value, unit, position) values
    (g1, 'Beta testers onboarded', 0, 140, 200, '', 0),
    (g1, 'Crash-free sessions', 97, 99.2, 99.5, '%', 1),
    (g2, 'Paid workspaces', 40, 82, 200, '', 0),
    (g2, 'Trial to paid conversion', 5, 9, 15, '%', 1),
    (g3, 'Median first reply (hours)', 9, 3.1, 4, 'h', 0);

  insert into public.goal_projects (goal_id, project_id) values (g1, p_mob), (g2, p_mkt), (g2, p_web), (g3, p_cus);

  insert into public.project_updates (project_id, author_id, health, body, created_at) values
    (p_mob, v_owner, 'at_risk', 'At risk: the auth migration slipped by two days. Payments work moves to Sprint 12.', n - interval '15 days'),
    (p_mob, v_owner, 'on_track', 'On track: the payments flow is designed and auth shipped. Next up: Stripe webhooks and onboarding.', n - interval '8 days'),
    (p_web, u_priya, 'at_risk', 'At risk: Safari layout bugs on the pricing page are blocking the homepage launch.', n - interval '2 days');

  insert into public.invoices (workspace_id, number, amount_cents, status, period_start, period_end, is_demo, created_at) values
    (v_ws, 'TSK-2026-0011', 6400, 'paid', (date_trunc('month', n) - interval '1 month')::date, (date_trunc('month', n) - interval '1 day')::date, true, date_trunc('month', n) - interval '1 month'),
    (v_ws, 'TSK-2026-0010', 5600, 'paid', (date_trunc('month', n) - interval '2 months')::date, (date_trunc('month', n) - interval '1 month 1 day')::date, true, date_trunc('month', n) - interval '2 months'),
    (v_ws, 'TSK-2026-0009', 4800, 'paid', (date_trunc('month', n) - interval '3 months')::date, (date_trunc('month', n) - interval '2 months 1 day')::date, true, date_trunc('month', n) - interval '3 months');

  -- ---------------------------------------------------------------------------
  -- Tidy up what the triggers recorded while seeding, then write a believable
  -- activity history and inbox.
  -- ---------------------------------------------------------------------------
  update public.activity a
  set actor_id = t.creator_id, created_at = t.created_at
  from public.tasks t
  where a.task_id = t.id and a.action = 'created' and a.workspace_id = v_ws;

  update public.activity a
  set created_at = c.created_at
  from public.comments c
  where a.action = 'commented' and a.workspace_id = v_ws and (a.meta ->> 'comment_id')::uuid = c.id;

  insert into public.activity (workspace_id, project_id, task_id, actor_id, action, meta, created_at) values
    (v_ws, p_mob, t_kanban, u_ayesha, 'status_changed',
      jsonb_build_object('from', private.status_of(p_mob, 'started'), 'to', private.status_of(p_mob, 'review')), n - interval '5 hours'),
    (v_ws, p_mob, t_stripe, v_owner, 'status_changed',
      jsonb_build_object('from', private.status_of(p_mob, 'unstarted'), 'to', private.status_of(p_mob, 'started')), n - interval '7 days'),
    (v_ws, p_mob, t_stripe, v_owner, 'priority_changed', '{"from": "high", "to": "urgent"}', n - interval '2 days');

  delete from public.notifications where workspace_id = v_ws;
  insert into public.notifications (user_id, workspace_id, kind, task_id, actor_id, title, body, read_at, created_at) values
    (v_owner, v_ws, 'mentioned', t_stripe, u_zain, 'mentioned you on ' || private.task_ref(t_stripe),
      'staging is missing the Stripe test keys, so webhooks fail there.', null, n - interval '40 minutes'),
    (v_owner, v_ws, 'form_submission', t_form_bug, null, 'New Report a bug submission · ' || private.task_ref(t_form_bug),
      'App crashes after login on my Pixel 8', null, n - interval '12 minutes'),
    (v_owner, v_ws, 'assigned', t_tax, u_ayesha, 'assigned you to ' || private.task_ref(t_tax) || ' · Invoice tax ID field',
      '', null, n - interval '2 hours'),
    (v_owner, v_ws, 'automation', t_email_review, null, 'raised priority to High on ' || private.task_ref(t_email_review) || ' — due today',
      '', null, n - interval '3 hours'),
    (v_owner, v_ws, 'status_changed', t_kanban, u_ayesha, 'moved ' || private.task_ref(t_kanban) || ' to In review',
      '', null, n - interval '5 hours'),
    (v_owner, v_ws, 'commented', t_stripe, u_sara, 'commented on ' || private.task_ref(t_stripe),
      'Pricing modal design is attached.', n - interval '90 minutes', n - interval '2 hours'),
    (v_owner, v_ws, 'invite_accepted', null, u_mei, 'accepted your workspace invite', '', n - interval '1 day', n - interval '1 day'),
    (v_owner, v_ws, 'assigned', t_safari, u_priya, 'assigned you to ' || private.task_ref(t_safari) || ' · Fix pricing page layout on Safari',
      '', n - interval '4 days', n - interval '5 days');

  return v_ws;
end;
$$;

revoke execute on function private.status_of(uuid, public.status_category) from public;
revoke execute on function private.task_ref(uuid) from public;
revoke execute on function private.demo_task(uuid, text, public.status_category, public.task_priority, uuid, uuid, date, date,
  integer, uuid, uuid[], text, uuid, timestamptz, timestamptz, public.task_source, text) from public;
revoke execute on function public.reset_demo(text) from public, anon, authenticated;
grant execute on function public.reset_demo(text) to service_role;
