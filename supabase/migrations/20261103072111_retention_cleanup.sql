-- Retention is enforced inside Postgres so it does not depend on web traffic.
-- This migration is Supabase-specific: pg_cron is a managed extension there.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table private.anonymous_account_retention (
  user_id uuid primary key references auth.users(id) on delete cascade,
  empty_since timestamptz not null
);

create index anonymous_account_retention_empty_since_idx
  on private.anonymous_account_retention (empty_since);

alter table private.anonymous_account_retention enable row level security;

revoke all on table private.anonymous_account_retention
  from public, anon, authenticated;
grant select, insert, update, delete on table private.anonymous_account_retention
  to service_role;

create index reports_resolved_retention_idx
  on public.reports (resolved_at)
  where status in ('resolved', 'dismissed');

create index moderation_log_report_retention_idx
  on public.moderation_log (created_at)
  where action in ('resolve_report', 'dismiss_report');

-- Remember when an account stops owning its final grave. Without this marker,
-- an old anonymous account could be removed immediately after a newly deleted
-- grave instead of receiving the promised 90-day grace period.
create or replace function private.track_grave_owner_retention()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op <> 'DELETE' and new.owner_user_id is not null then
    delete from private.anonymous_account_retention
    where user_id = new.owner_user_id;
  end if;

  if tg_op <> 'INSERT'
     and old.owner_user_id is not null
     and (tg_op = 'DELETE' or new.owner_user_id is distinct from old.owner_user_id)
     and not exists (
       select 1
       from public.graves
       where owner_user_id = old.owner_user_id
         and status in ('published', 'hidden')
     ) then
    insert into private.anonymous_account_retention(user_id, empty_since)
    values (old.owner_user_id, clock_timestamp())
    on conflict (user_id) do update
    set empty_since = excluded.empty_since;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.track_grave_owner_retention()
  from public, anon, authenticated;
grant execute on function private.track_grave_owner_retention()
  to service_role;

create trigger graves_track_owner_retention
after insert or delete or update of owner_user_id on public.graves
for each row execute function private.track_grave_owner_retention();

-- Existing anonymous accounts that do not own a grave start their grace period
-- when this migration is applied. Payment/audit references are checked again at
-- deletion time and therefore remain protected.
insert into private.anonymous_account_retention(user_id, empty_since)
select u.id, clock_timestamp()
from auth.users u
where u.is_anonymous is true
  and not exists (
    select 1 from public.graves g where g.owner_user_id = u.id
  )
on conflict (user_id) do nothing;

create or replace function private.run_retention_cleanup(
  p_now timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_rate_limits bigint;
  v_idempotency bigint;
  v_report_logs bigint;
  v_reports bigint;
  v_permanent_markers bigint;
  v_anonymous_users bigint;
begin
  delete from public.rate_limit_buckets
  where expires_at < p_now;
  get diagnostics v_rate_limits = row_count;

  delete from public.api_idempotency
  where expires_at < p_now;
  get diagnostics v_idempotency = row_count;

  delete from public.moderation_log
  where action in ('resolve_report', 'dismiss_report')
    and created_at < p_now - interval '1 year';
  get diagnostics v_report_logs = row_count;

  delete from public.reports
  where status in ('resolved', 'dismissed')
    and resolved_at < p_now - interval '1 year';
  get diagnostics v_reports = row_count;

  -- Anonymous users can be upgraded to a permanent identity outside the
  -- current app. Their now-irrelevant empty-account marker must not linger.
  delete from private.anonymous_account_retention r
  using auth.users u
  where u.id = r.user_id
    and coalesce(u.is_anonymous, false) is false;
  get diagnostics v_permanent_markers = row_count;

  with candidates as (
    select u.id
    from auth.users u
    where u.is_anonymous is true
      and coalesce(
        (
          select r.empty_since
          from private.anonymous_account_retention r
          where r.user_id = u.id
        ),
        u.created_at
      ) < p_now - interval '90 days'
      and not exists (
        select 1 from public.graves g where g.owner_user_id = u.id
      )
      and not exists (
        select 1 from public.purchase_intents i where i.owner_at_creation = u.id
      )
      and not exists (
        select 1 from public.moderation_log m where m.admin_user_id = u.id
      )
    order by u.created_at
    limit 500
    for update of u skip locked
  )
  delete from auth.users u
  using candidates c
  where u.id = c.id;
  get diagnostics v_anonymous_users = row_count;

  return jsonb_build_object(
    'rateLimitBuckets', v_rate_limits,
    'idempotencyRows', v_idempotency,
    'reportModerationLogs', v_report_logs,
    'resolvedReports', v_reports,
    'permanentAccountMarkers', v_permanent_markers,
    'anonymousUsers', v_anonymous_users
  );
end;
$$;

-- Only the migration owner (postgres) and jobs it schedules may execute the
-- cleanup. In particular, the service role cannot turn this into an Auth-user
-- deletion endpoint through PostgREST.
revoke all on function private.run_retention_cleanup(timestamptz)
  from public, anon, authenticated, service_role;

comment on function private.run_retention_cleanup(timestamptz) is
  'Deletes expired abuse/idempotency records, one-year-old resolved reports, and anonymous accounts that have owned no graves for at least 90 days.';

do $$
begin
  if not exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    raise exception using
      errcode = '55000',
      message = 'PG_CRON_REQUIRED',
      hint = 'Enable the Supabase Cron integration before applying this migration.';
  end if;
end;
$$;

select cron.schedule(
  'someday-cemetery-retention',
  '17 3 * * *',
  $$select private.run_retention_cleanup();$$
);

-- pg_cron does not prune its own execution history.
select cron.schedule(
  'someday-cemetery-cron-history-retention',
  '47 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days';$$
);
