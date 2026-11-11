-- =============================================================================
-- Taskora — monthly or yearly billing
-- Only the server (service role) and the Stripe webhook change it: authenticated users can update just
-- the workspace name and slug (see the column grants in the security migration).
-- =============================================================================
alter table public.workspaces
  add column if not exists billing_interval text not null default 'month'
  check (billing_interval in ('month', 'year'));
