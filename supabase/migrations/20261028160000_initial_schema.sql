-- Someday Cemetery initial schema.
-- Browser clients never access these base tables or internal RPCs directly.

create table public.gardens (
  id uuid primary key default gen_random_uuid(),
  ordinal integer not null unique check (ordinal > 0),
  capacity integer not null default 100 check (capacity = 100),
  layout_version integer not null default 1 check (layout_version > 0),
  created_at timestamptz not null default now()
);

create table public.graves (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete restrict,
  plot_index integer,
  owner_user_id uuid references auth.users(id) on delete restrict,
  title text,
  epitaph text,
  started_year integer,
  selected_style text not null default 'classic',
  accent text not null default 'stone',
  status text not null default 'published',
  is_example boolean not null default false,
  version integer not null default 1 check (version > 0),
  flower_count integer not null default 0 check (flower_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint graves_plot_range check (
    (garden_id is null and plot_index is null)
    or (garden_id is not null and plot_index between 0 and 99)
  ),
  constraint graves_status_allowed check (status in ('published', 'hidden', 'deleted')),
  constraint graves_style_allowed check (selected_style in ('classic', 'moss', 'wildflowers', 'lantern')),
  constraint graves_accent_allowed check (accent in (
    'stone', 'slate', 'moon', 'fern', 'sage', 'lichen',
    'violet', 'gold', 'rose', 'ember', 'amber', 'starlight'
  )),
  constraint graves_started_year_range check (started_year is null or started_year between 1900 and 9999),
  constraint graves_title_no_newline check (title is null or title !~ E'[\r\n]'),
  constraint graves_epitaph_three_lines check (epitaph is null or array_length(string_to_array(epitaph, E'\n'), 1) <= 3),
  constraint graves_live_shape check (
    status = 'deleted'
    or (
      garden_id is not null and plot_index is not null
      and title is not null and btrim(title) <> ''
      and (is_example or owner_user_id is not null)
    )
  ),
  constraint graves_deleted_scrubbed check (
    status <> 'deleted'
    or (
      owner_user_id is null and title is null and epitaph is null
      and started_year is null and deleted_at is not null
    )
  )
);

create unique index graves_occupied_plot_uidx
  on public.graves (garden_id, plot_index)
  where status in ('published', 'hidden');
create index graves_garden_plot_idx on public.graves (garden_id, plot_index);
create index graves_owner_created_idx on public.graves (owner_user_id, created_at desc)
  where owner_user_id is not null;
create index graves_recent_published_idx on public.graves (created_at desc, id desc)
  where status = 'published' and is_example = false;

create table public.grave_recovery (
  grave_id uuid primary key references public.graves(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  rotated_at timestamptz not null default now()
);

create table public.flowers (
  id uuid primary key default gen_random_uuid(),
  grave_id uuid not null references public.graves(id) on delete cascade,
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (grave_id, visitor_hash)
);
create index flowers_grave_created_idx on public.flowers (grave_id, created_at);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  grave_id uuid not null references public.graves(id) on delete restrict,
  reporter_hash text not null check (reporter_hash ~ '^[0-9a-f]{64}$'),
  reason text not null check (reason in ('spam', 'harassment', 'personal_information', 'real_person', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index reports_open_reporter_uidx
  on public.reports (grave_id, reporter_hash) where status = 'open';
create index reports_status_created_idx on public.reports (status, created_at);
create index reports_grave_idx on public.reports (grave_id);

create table public.purchase_intents (
  id uuid primary key default gen_random_uuid(),
  grave_id uuid not null references public.graves(id) on delete restrict,
  owner_at_creation uuid not null references auth.users(id) on delete restrict,
  mode text not null check (mode in ('sandbox', 'live')),
  sku text not null default 'custom_headstone_v1' check (sku = 'custom_headstone_v1'),
  amount integer not null default 700 check (amount = 700),
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'creating' check (
    status in ('creating', 'checkout_open', 'unknown', 'paid', 'expired', 'failed', 'review_required')
  ),
  provider_checkout_id text,
  provider_order_id text,
  checkout_url text,
  reconcile_token uuid,
  reconcile_lease_until timestamptz,
  last_error_code text,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mode, provider_checkout_id)
);
create unique index purchase_intents_in_progress_uidx
  on public.purchase_intents (grave_id, mode)
  where status in ('creating', 'checkout_open', 'unknown', 'review_required');
create index purchase_intents_grave_idx on public.purchase_intents (grave_id, created_at desc);
create index purchase_intents_owner_idx on public.purchase_intents (owner_at_creation, created_at desc);
create index purchase_intents_reconcile_idx
  on public.purchase_intents (mode, status, reconcile_lease_until, updated_at)
  where status in ('creating', 'checkout_open', 'unknown', 'review_required');

create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('sandbox', 'live')),
  provider_order_id text not null,
  purchase_intent_id uuid not null references public.purchase_intents(id) on delete restrict,
  provider_status text not null,
  provider_product_id text,
  provider_organization_id text,
  subtotal_amount integer not null default 0 check (subtotal_amount >= 0),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  net_amount integer not null check (net_amount >= 0),
  total_amount integer not null check (total_amount >= 0),
  refunded_amount integer not null default 0 check (refunded_amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  needs_review boolean not null default false,
  review_reason text,
  reconcile_token uuid,
  reconcile_lease_until timestamptz,
  snapshot_revision bigint not null default 0 check (snapshot_revision >= 0),
  provider_modified_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mode, provider_order_id)
);
create index payment_orders_intent_idx on public.payment_orders (purchase_intent_id);
create index payment_orders_review_idx on public.payment_orders (needs_review, updated_at)
  where needs_review = true;
create index payment_orders_reconcile_idx on public.payment_orders (mode, reconcile_lease_until, last_synced_at);

create table public.grave_entitlements (
  grave_id uuid not null references public.graves(id) on delete restrict,
  mode text not null check (mode in ('sandbox', 'live')),
  source_order_id uuid not null references public.payment_orders(id) on delete restrict,
  status text not null check (status in ('active', 'revoked', 'suspended')),
  reason text,
  updated_at timestamptz not null default now(),
  primary key (grave_id, mode)
);
create index grave_entitlements_source_order_idx on public.grave_entitlements (source_order_id);
create index grave_entitlements_status_idx on public.grave_entitlements (mode, status, updated_at);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('sandbox', 'live')),
  provider_event_id text not null,
  type text not null,
  provider_order_id text,
  minimal_payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received' check (
    processing_status in ('received', 'processing', 'processed', 'failed')
  ),
  processing_token uuid,
  lease_until timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (mode, provider_event_id)
);
create index webhook_events_processing_idx
  on public.webhook_events (mode, processing_status, lease_until, received_at)
  where processing_status in ('received', 'processing', 'failed');

create table public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  grave_id uuid references public.graves(id) on delete restrict,
  action text not null check (action in (
    'hide', 'republish', 'delete', 'suspend_entitlement', 'restore_entitlement',
    'resolve_report', 'dismiss_report', 'reconcile_payment'
  )),
  reason text not null check (btrim(reason) <> ''),
  created_at timestamptz not null default now()
);
create index moderation_log_admin_created_idx on public.moderation_log (admin_user_id, created_at desc);
create index moderation_log_grave_created_idx on public.moderation_log (grave_id, created_at desc);

create table public.api_idempotency (
  actor_id uuid not null,
  operation text not null,
  key text not null check (char_length(key) between 8 and 200),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  resource_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  primary key (actor_id, operation, key)
);
create index api_idempotency_expires_idx on public.api_idempotency (expires_at);

create table public.rate_limit_buckets (
  action text not null,
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  expires_at timestamptz not null,
  primary key (action, subject_hash, window_start)
);
create index rate_limit_buckets_expires_idx on public.rate_limit_buckets (expires_at);

create table public.daily_metrics (
  date date not null,
  metric text not null check (metric in (
    'grave_created', 'flower_left', 'checkout_started', 'purchase_paid',
    'purchase_refunded', 'grave_hidden', 'payment_review_required'
  )),
  value bigint not null default 0 check (value >= 0),
  primary key (date, metric)
);

-- RLS is defense-in-depth. No anon/authenticated policies are created.
alter table public.gardens enable row level security;
alter table public.graves enable row level security;
alter table public.grave_recovery enable row level security;
alter table public.flowers enable row level security;
alter table public.reports enable row level security;
alter table public.purchase_intents enable row level security;
alter table public.payment_orders enable row level security;
alter table public.grave_entitlements enable row level security;
alter table public.webhook_events enable row level security;
alter table public.moderation_log enable row level security;
alter table public.api_idempotency enable row level security;
alter table public.rate_limit_buckets enable row level security;
alter table public.daily_metrics enable row level security;

revoke all on table
  public.gardens, public.graves, public.grave_recovery, public.flowers,
  public.reports, public.purchase_intents, public.payment_orders,
  public.grave_entitlements, public.webhook_events, public.moderation_log,
  public.api_idempotency, public.rate_limit_buckets, public.daily_metrics
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.gardens, public.graves, public.grave_recovery, public.flowers,
  public.reports, public.purchase_intents, public.payment_orders,
  public.grave_entitlements, public.webhook_events, public.moderation_log,
  public.api_idempotency, public.rate_limit_buckets, public.daily_metrics
to service_role;

create or replace function public.increment_metric(p_metric text, p_amount bigint default 1)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_metric not in (
    'grave_created', 'flower_left', 'checkout_started', 'purchase_paid',
    'purchase_refunded', 'grave_hidden', 'payment_review_required'
  ) or p_amount < 0 then
    raise exception using errcode = '22023', message = 'INVALID_METRIC';
  end if;
  insert into public.daily_metrics(date, metric, value)
  values ((now() at time zone 'utc')::date, p_metric, p_amount)
  on conflict (date, metric) do update
  set value = public.daily_metrics.value + excluded.value;
end;
$$;

create or replace function public.consume_rate_limit(
  p_action text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_limit <= 0 or p_window_seconds <= 0 or p_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_RATE_LIMIT';
  end if;
  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );
  insert into public.rate_limit_buckets(action, subject_hash, window_start, count, expires_at)
  values (
    p_action, p_subject_hash, v_window_start, 1,
    v_window_start + make_interval(secs => p_window_seconds * 2)
  )
  on conflict (action, subject_hash, window_start) do update
  set count = public.rate_limit_buckets.count + 1,
      expires_at = excluded.expires_at
  where public.rate_limit_buckets.count < p_limit
  returning count into v_count;
  return found;
end;
$$;

create or replace function public.create_grave(
  p_owner_user_id uuid,
  p_garden_id uuid,
  p_plot_index integer,
  p_title text,
  p_epitaph text,
  p_started_year integer,
  p_style text,
  p_accent text,
  p_recovery_token_hash text,
  p_idempotency_key text,
  p_payload_hash text
)
returns table(grave_id uuid, grave_version integer, replayed boolean)
language plpgsql
set search_path = ''
as $$
declare
  v_existing public.api_idempotency%rowtype;
  v_grave_id uuid;
  v_version integer;
  v_capacity integer;
  v_latest_id uuid;
  v_latest_ordinal integer;
  v_occupied integer;
begin
  if p_owner_user_id is null
     or p_title is null or btrim(p_title) = ''
     or p_plot_index not between 0 and 99
     or p_started_year is not null and p_started_year not between 1900 and extract(year from current_date)::integer
     or p_recovery_token_hash !~ '^[0-9a-f]{64}$'
     or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;

  select * into v_existing
  from public.api_idempotency
  where actor_id = p_owner_user_id and operation = 'create_grave' and key = p_idempotency_key
  for update;
  if found then
    if v_existing.payload_hash <> p_payload_hash then
      raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    select g.version into v_version from public.graves g where g.id = v_existing.resource_id;
    return query select v_existing.resource_id, coalesce(v_version, 1), true;
    return;
  end if;

  select capacity into v_capacity from public.gardens where id = p_garden_id for update;
  if not found or p_plot_index >= v_capacity then
    raise exception using errcode = '22023', message = 'INVALID_PLOT';
  end if;

  begin
    insert into public.graves(
      garden_id, plot_index, owner_user_id, title, epitaph, started_year,
      selected_style, accent, status, is_example
    ) values (
      p_garden_id, p_plot_index, p_owner_user_id, p_title, nullif(p_epitaph, ''),
      p_started_year, p_style, p_accent, 'published', false
    ) returning id, version into v_grave_id, v_version;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'PLOT_TAKEN';
  end;

  insert into public.grave_recovery(grave_id, token_hash)
  values (v_grave_id, p_recovery_token_hash);
  insert into public.api_idempotency(actor_id, operation, key, payload_hash, resource_id)
  values (p_owner_user_id, 'create_grave', p_idempotency_key, p_payload_hash, v_grave_id);
  perform public.increment_metric('grave_created', 1);

  select id, ordinal into v_latest_id, v_latest_ordinal
  from public.gardens order by ordinal desc limit 1 for update;
  select count(*) into v_occupied
  from public.graves where garden_id = v_latest_id and status in ('published', 'hidden');
  if v_occupied >= 80 then
    insert into public.gardens(ordinal, capacity, layout_version)
    values (v_latest_ordinal + 1, 100, 1)
    on conflict (ordinal) do nothing;
  end if;

  return query select v_grave_id, v_version, false;
end;
$$;

create or replace function public.update_grave(
  p_grave_id uuid,
  p_owner_user_id uuid,
  p_expected_version integer,
  p_title text,
  p_epitaph text,
  p_started_year integer,
  p_style text,
  p_accent text,
  p_entitlement_mode text
)
returns integer
language plpgsql
set search_path = ''
as $$
declare v_version integer;
begin
  if p_title is null or btrim(p_title) = ''
     or p_started_year is not null and p_started_year not between 1900 and extract(year from current_date)::integer then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;
  if p_style <> 'classic' and not exists (
    select 1 from public.grave_entitlements e
    where e.grave_id = p_grave_id and e.mode = p_entitlement_mode and e.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'ENTITLEMENT_REQUIRED';
  end if;
  update public.graves
  set title = p_title, epitaph = nullif(p_epitaph, ''), started_year = p_started_year,
      selected_style = p_style, accent = p_accent, version = version + 1, updated_at = now()
  where id = p_grave_id and owner_user_id = p_owner_user_id
    and version = p_expected_version and status in ('published', 'hidden') and is_example = false
  returning version into v_version;
  if found then return v_version; end if;
  if exists (
    select 1 from public.graves
    where id = p_grave_id and owner_user_id = p_owner_user_id and status in ('published', 'hidden')
  ) then
    raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
  end if;
  raise exception using errcode = '42501', message = 'FORBIDDEN';
end;
$$;

create or replace function public.delete_grave_and_scrub(
  p_grave_id uuid,
  p_owner_user_id uuid,
  p_expected_version integer
)
returns integer
language plpgsql
set search_path = ''
as $$
declare v_version integer;
begin
  update public.graves
  set owner_user_id = null, title = null, epitaph = null, started_year = null,
      selected_style = 'classic', accent = 'stone', status = 'deleted', flower_count = 0,
      version = version + 1, updated_at = now(), deleted_at = now()
  where id = p_grave_id and owner_user_id = p_owner_user_id
    and version = p_expected_version and status in ('published', 'hidden') and is_example = false
  returning version into v_version;
  if not found then
    if exists (
      select 1 from public.graves
      where id = p_grave_id and owner_user_id = p_owner_user_id and status in ('published', 'hidden')
    ) then
      raise exception using errcode = 'P0001', message = 'VERSION_CONFLICT';
    end if;
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  delete from public.grave_recovery where grave_id = p_grave_id;
  delete from public.flowers where grave_id = p_grave_id;
  return v_version;
end;
$$;

create or replace function public.rotate_recovery_token(
  p_grave_id uuid,
  p_owner_user_id uuid,
  p_new_token_hash text
)
returns integer
language plpgsql
set search_path = ''
as $$
declare v_version integer;
begin
  if p_new_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;
  select version into v_version from public.graves
  where id = p_grave_id and owner_user_id = p_owner_user_id
    and status in ('published', 'hidden') and is_example = false
  for update;
  if not found then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;
  update public.grave_recovery set token_hash = p_new_token_hash, rotated_at = now()
  where grave_id = p_grave_id;
  if not found then raise exception using errcode = 'P0001', message = 'RECOVERY_UNAVAILABLE'; end if;
  update public.graves set version = version + 1, updated_at = now()
  where id = p_grave_id returning version into v_version;
  return v_version;
end;
$$;

create or replace function public.restore_grave_ownership(
  p_grave_id uuid,
  p_old_token_hash text,
  p_new_owner_user_id uuid,
  p_new_token_hash text
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_current_hash text;
  v_version integer;
begin
  if p_old_token_hash !~ '^[0-9a-f]{64}$' or p_new_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_RECOVERY_TOKEN';
  end if;
  perform 1 from public.graves
  where id = p_grave_id and status in ('published', 'hidden') and is_example = false
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'RECOVERY_INVALID'; end if;
  select token_hash into v_current_hash from public.grave_recovery
  where grave_id = p_grave_id for update;
  if not found or v_current_hash <> p_old_token_hash then
    raise exception using errcode = 'P0001', message = 'RECOVERY_INVALID';
  end if;
  update public.graves
  set owner_user_id = p_new_owner_user_id, version = version + 1, updated_at = now()
  where id = p_grave_id returning version into v_version;
  update public.grave_recovery set token_hash = p_new_token_hash, rotated_at = now()
  where grave_id = p_grave_id;
  return v_version;
end;
$$;

create or replace function public.leave_flower(p_grave_id uuid, p_visitor_hash text)
returns table(flower_count integer, added boolean)
language plpgsql
set search_path = ''
as $$
declare
  v_inserted uuid;
  v_count integer;
begin
  if p_visitor_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'INVALID_VISITOR';
  end if;
  select g.flower_count into v_count from public.graves g
  where g.id = p_grave_id and g.status = 'published' and g.is_example = false
  for update;
  if not found then raise exception using errcode = 'P0001', message = 'GRAVE_UNAVAILABLE'; end if;
  insert into public.flowers(grave_id, visitor_hash) values (p_grave_id, p_visitor_hash)
  on conflict (grave_id, visitor_hash) do nothing returning id into v_inserted;
  if v_inserted is not null then
    update public.graves set flower_count = public.graves.flower_count + 1, updated_at = now()
    where id = p_grave_id returning public.graves.flower_count into v_count;
    perform public.increment_metric('flower_left', 1);
    return query select v_count, true;
  end if;
  return query select v_count, false;
end;
$$;

create or replace function public.create_report(
  p_grave_id uuid,
  p_reporter_hash text,
  p_reason text,
  p_details text,
  p_rate_subject_hash text
)
returns table(report_id uuid, replayed boolean)
language plpgsql
set search_path = ''
as $$
declare v_id uuid;
begin
  if p_reporter_hash !~ '^[0-9a-f]{64}$'
     or p_rate_subject_hash !~ '^[0-9a-f]{64}$'
     or p_reason not in ('spam', 'harassment', 'personal_information', 'real_person', 'other')
     -- The API enforces 500 graphemes with Intl.Segmenter. This wider DB guard
     -- avoids rejecting valid combining sequences while still bounding input.
     or coalesce(char_length(p_details), 0) > 2000 then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;
  if not exists (
    select 1 from public.graves where id = p_grave_id and status = 'published' and is_example = false
  ) then
    raise exception using errcode = 'P0001', message = 'GRAVE_UNAVAILABLE';
  end if;
  if not public.consume_rate_limit('report', p_rate_subject_hash, 5, 3600) then
    raise exception using errcode = 'P0001', message = 'RATE_LIMITED';
  end if;
  insert into public.reports(grave_id, reporter_hash, reason, details)
  values (p_grave_id, p_reporter_hash, p_reason, nullif(p_details, ''))
  on conflict (grave_id, reporter_hash) where status = 'open' do nothing
  returning id into v_id;
  if v_id is not null then return query select v_id, false; return; end if;
  select id into v_id from public.reports
  where grave_id = p_grave_id and reporter_hash = p_reporter_hash and status = 'open';
  return query select v_id, true;
end;
$$;

create or replace function public.moderate_grave(
  p_admin_user_id uuid,
  p_grave_id uuid,
  p_action text,
  p_reason text,
  p_mode text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_changed boolean := false;
  v_status text;
  v_entitlement_status text;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception using errcode = '22023', message = 'REASON_REQUIRED';
  end if;
  perform 1 from public.graves where id = p_grave_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'GRAVE_UNAVAILABLE'; end if;
  case p_action
    when 'hide' then
      update public.graves set status = 'hidden', version = version + 1, updated_at = now()
      where id = p_grave_id and status = 'published' returning status into v_status;
      v_changed := found;
      if v_changed then perform public.increment_metric('grave_hidden', 1); end if;
    when 'republish' then
      update public.graves set status = 'published', version = version + 1, updated_at = now()
      where id = p_grave_id and status = 'hidden' returning status into v_status;
      v_changed := found;
    when 'delete' then
      update public.graves
      set owner_user_id = null, title = null, epitaph = null, started_year = null,
          selected_style = 'classic', accent = 'stone', status = 'deleted', flower_count = 0,
          version = version + 1, updated_at = now(), deleted_at = now()
      where id = p_grave_id and status in ('published', 'hidden') returning status into v_status;
      v_changed := found;
      if v_changed then
        delete from public.grave_recovery where grave_id = p_grave_id;
        delete from public.flowers where grave_id = p_grave_id;
      end if;
    when 'suspend_entitlement' then
      update public.grave_entitlements
      set status = 'suspended', reason = p_reason, updated_at = now()
      where grave_id = p_grave_id and mode = p_mode and status = 'active'
      returning status into v_entitlement_status;
      v_changed := found;
    when 'restore_entitlement' then
      update public.grave_entitlements
      set status = 'active', reason = p_reason, updated_at = now()
      where grave_id = p_grave_id and mode = p_mode and status = 'suspended'
      returning status into v_entitlement_status;
      v_changed := found;
    else
      raise exception using errcode = '22023', message = 'INVALID_MODERATION_ACTION';
  end case;
  if not v_changed then raise exception using errcode = 'P0001', message = 'NO_STATE_CHANGE'; end if;
  insert into public.moderation_log(admin_user_id, grave_id, action, reason)
  values (p_admin_user_id, p_grave_id, p_action, p_reason);
  return jsonb_build_object(
    'graveStatus', coalesce(v_status, (select status from public.graves where id = p_grave_id)),
    'entitlementStatus', v_entitlement_status
  );
end;
$$;

create or replace function public.get_random_published_grave()
returns table(grave_id uuid)
language sql
volatile
set search_path = ''
as $$
  select id from public.graves
  where status = 'published' and is_example = false
  order by random()
  limit 1;
$$;

create or replace function public.moderate_report(
  p_admin_user_id uuid,
  p_report_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_grave_id uuid;
  v_status text;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception using errcode = '22023', message = 'REASON_REQUIRED';
  end if;
  if p_action not in ('resolve_report', 'dismiss_report') then
    raise exception using errcode = '22023', message = 'INVALID_MODERATION_ACTION';
  end if;
  select grave_id into v_grave_id from public.reports
  where id = p_report_id and status = 'open'
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'NO_STATE_CHANGE';
  end if;
  v_status := case when p_action = 'resolve_report' then 'resolved' else 'dismissed' end;
  update public.reports set status = v_status, resolved_at = now() where id = p_report_id;
  insert into public.moderation_log(admin_user_id, grave_id, action, reason)
  values (p_admin_user_id, v_grave_id, p_action, p_reason);
  return jsonb_build_object('reportStatus', v_status, 'graveId', v_grave_id);
end;
$$;

create or replace function public.begin_purchase_intent(
  p_grave_id uuid,
  p_owner_user_id uuid,
  p_mode text
)
returns table(intent_id uuid, intent_status text, checkout_url text, reused boolean)
language plpgsql
set search_path = ''
as $$
declare
  v_existing public.purchase_intents%rowtype;
  v_id uuid;
begin
  if p_mode not in ('sandbox', 'live') then
    raise exception using errcode = '22023', message = 'INVALID_PAYMENT_MODE';
  end if;
  perform 1 from public.graves
  where id = p_grave_id and owner_user_id = p_owner_user_id
    and status = 'published' and is_example = false
  for update;
  if not found then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;
  if exists (
    select 1 from public.grave_entitlements
    where grave_id = p_grave_id and mode = p_mode and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'ALREADY_ENTITLED';
  end if;
  select * into v_existing from public.purchase_intents
  where grave_id = p_grave_id and mode = p_mode
    and status in ('creating', 'checkout_open', 'unknown', 'review_required')
  for update;
  if found then
    if v_existing.owner_at_creation <> p_owner_user_id then
      update public.purchase_intents
      set status = 'review_required', checkout_url = null,
          review_reason = 'OWNER_CHANGED', last_error_code = 'OWNER_CHANGED', updated_at = now()
      where id = v_existing.id;
      perform public.increment_metric('payment_review_required', 1);
      raise exception using errcode = 'P0001', message = 'PURCHASE_REVIEW_REQUIRED';
    end if;
    return query select v_existing.id, v_existing.status, v_existing.checkout_url, true;
    return;
  end if;
  insert into public.purchase_intents(grave_id, owner_at_creation, mode)
  values (p_grave_id, p_owner_user_id, p_mode) returning id into v_id;
  perform public.increment_metric('checkout_started', 1);
  return query select v_id, 'creating'::text, null::text, false;
end;
$$;

create or replace function public.finish_checkout_creation(
  p_intent_id uuid,
  p_owner_user_id uuid,
  p_provider_checkout_id text,
  p_checkout_url text,
  p_status text,
  p_error_code text default null
)
returns text
language plpgsql
set search_path = ''
as $$
declare v_status text;
begin
  if p_status not in ('checkout_open', 'unknown', 'failed') then
    raise exception using errcode = '22023', message = 'INVALID_PURCHASE_STATUS';
  end if;
  update public.purchase_intents
  set provider_checkout_id = coalesce(p_provider_checkout_id, provider_checkout_id),
      checkout_url = case when p_status = 'checkout_open' then p_checkout_url else null end,
      status = p_status, last_error_code = p_error_code,
      reconcile_token = null, reconcile_lease_until = null, updated_at = now()
  where id = p_intent_id and owner_at_creation = p_owner_user_id and status = 'creating'
  returning status into v_status;
  if not found then raise exception using errcode = 'P0001', message = 'PURCHASE_STATE_CONFLICT'; end if;
  return v_status;
end;
$$;

create or replace function public.record_webhook_event(
  p_mode text,
  p_provider_event_id text,
  p_type text,
  p_provider_order_id text,
  p_minimal_payload jsonb
)
returns table(event_id uuid, replayed boolean)
language plpgsql
set search_path = ''
as $$
declare v_id uuid;
begin
  if p_mode not in ('sandbox', 'live') or p_provider_event_id is null or p_type is null then
    raise exception using errcode = '22023', message = 'INVALID_WEBHOOK';
  end if;
  insert into public.webhook_events(mode, provider_event_id, type, provider_order_id, minimal_payload)
  values (p_mode, p_provider_event_id, p_type, p_provider_order_id, coalesce(p_minimal_payload, '{}'::jsonb))
  on conflict (mode, provider_event_id) do nothing returning id into v_id;
  if v_id is not null then return query select v_id, false; return; end if;
  select id into v_id from public.webhook_events
  where mode = p_mode and provider_event_id = p_provider_event_id;
  return query select v_id, true;
end;
$$;

create or replace function public.claim_webhook_event(
  p_mode text,
  p_event_id uuid,
  p_token uuid,
  p_lease_seconds integer default 60
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  update public.webhook_events
  set processing_status = 'processing', processing_token = p_token,
      lease_until = now() + make_interval(secs => greatest(10, least(p_lease_seconds, 600))),
      attempts = attempts + 1, last_error_code = null
  where id = p_event_id and mode = p_mode
    and (
      processing_status in ('received', 'failed')
      or (processing_status = 'processing' and lease_until < now())
    );
  return found;
end;
$$;

create or replace function public.finish_webhook_event(
  p_mode text,
  p_event_id uuid,
  p_token uuid,
  p_success boolean,
  p_error_code text default null
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  update public.webhook_events
  set processing_status = case when p_success then 'processed' else 'failed' end,
      processed_at = case when p_success then now() else null end,
      last_error_code = case when p_success then null else p_error_code end,
      processing_token = null, lease_until = null
  where id = p_event_id and mode = p_mode
    and processing_token = p_token and processing_status = 'processing';
  return found;
end;
$$;

create or replace function public.claim_purchase_intent_reconciliation(
  p_intent_id uuid,
  p_mode text,
  p_token uuid,
  p_lease_seconds integer default 60
)
returns setof public.purchase_intents
language sql
set search_path = ''
as $$
  update public.purchase_intents
  set reconcile_token = p_token,
      reconcile_lease_until = now() + make_interval(secs => greatest(10, least(p_lease_seconds, 600)))
  where id = p_intent_id and mode = p_mode
    and status in ('creating', 'checkout_open', 'unknown', 'review_required')
    and (reconcile_lease_until is null or reconcile_lease_until < now())
  returning *;
$$;

create or replace function public.claim_payment_reconciliation_jobs(
  p_mode text,
  p_token uuid,
  p_limit integer default 20,
  p_lease_seconds integer default 60
)
returns setof public.purchase_intents
language sql
set search_path = ''
as $$
  with candidates as (
    select id from public.purchase_intents
    where mode = p_mode
      and status in ('creating', 'checkout_open', 'unknown', 'review_required')
      and updated_at < now() - interval '1 minute'
      and (reconcile_lease_until is null or reconcile_lease_until < now())
    order by updated_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  update public.purchase_intents i
  set reconcile_token = p_token,
      reconcile_lease_until = now() + make_interval(secs => greatest(10, least(p_lease_seconds, 600)))
  from candidates c
  where i.id = c.id
  returning i.*;
$$;

create or replace function public.claim_payment_order_reconciliation_jobs(
  p_mode text,
  p_token uuid,
  p_limit integer default 20,
  p_lease_seconds integer default 60
)
returns setof public.payment_orders
language sql
set search_path = ''
as $$
  with candidates as (
    select id from public.payment_orders
    where mode = p_mode
      and (last_synced_at is null or last_synced_at < now() - interval '24 hours' or needs_review)
      and (reconcile_lease_until is null or reconcile_lease_until < now())
    order by coalesce(last_synced_at, '-infinity'::timestamptz), created_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  update public.payment_orders o
  set reconcile_token = p_token,
      reconcile_lease_until = now() + make_interval(secs => greatest(10, least(p_lease_seconds, 600)))
  from candidates c
  where o.id = c.id
  returning o.*;
$$;

create or replace function public.finish_purchase_intent_reconciliation(
  p_intent_id uuid,
  p_mode text,
  p_token uuid,
  p_status text,
  p_error_code text default null,
  p_provider_checkout_id text default null,
  p_provider_order_id text default null,
  p_checkout_url text default null,
  p_review_reason text default null
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  if p_status not in ('creating', 'checkout_open', 'unknown', 'paid', 'expired', 'failed', 'review_required') then
    raise exception using errcode = '22023', message = 'INVALID_PURCHASE_STATUS';
  end if;
  update public.purchase_intents
  set status = p_status, last_error_code = p_error_code,
      provider_checkout_id = coalesce(p_provider_checkout_id, provider_checkout_id),
      provider_order_id = coalesce(p_provider_order_id, provider_order_id),
      checkout_url = case when p_status = 'checkout_open' then coalesce(p_checkout_url, checkout_url) else null end,
      review_reason = p_review_reason, reconcile_token = null, reconcile_lease_until = null,
      updated_at = now()
  where id = p_intent_id and mode = p_mode and reconcile_token = p_token;
  return found;
end;
$$;

create or replace function public.apply_payment_order_state(
  p_intent_id uuid,
  p_mode text,
  p_reconcile_token uuid,
  p_order_reconcile_token uuid,
  p_provider_order_id text,
  p_provider_status text,
  p_provider_product_id text,
  p_provider_organization_id text,
  p_subtotal_amount integer,
  p_discount_amount integer,
  p_net_amount integer,
  p_total_amount integer,
  p_refunded_amount integer,
  p_currency text,
  p_provider_modified_at timestamptz,
  p_intent_status text,
  p_entitlement_status text,
  p_needs_review boolean,
  p_review_reason text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_intent public.purchase_intents%rowtype;
  v_order public.payment_orders%rowtype;
  v_existing_order public.payment_orders%rowtype;
  v_grave_status text;
  v_old_entitlement_status text;
  v_effective_review boolean := coalesce(p_needs_review, false);
  v_effective_review_reason text := p_review_reason;
  v_effective_refunded integer;
begin
  if p_mode not in ('sandbox', 'live')
     or p_intent_status not in ('creating', 'checkout_open', 'unknown', 'paid', 'expired', 'failed', 'review_required')
     or (p_entitlement_status is not null and p_entitlement_status not in ('active', 'revoked', 'suspended'))
     or p_currency !~ '^[A-Z]{3}$'
     or least(p_subtotal_amount, p_discount_amount, p_net_amount, p_total_amount, p_refunded_amount) < 0 then
    raise exception using errcode = '22023', message = 'INVALID_PAYMENT_STATE';
  end if;

  select * into v_intent from public.purchase_intents
  where id = p_intent_id and mode = p_mode for update;
  if not found then raise exception using errcode = 'P0001', message = 'PURCHASE_INTENT_NOT_FOUND'; end if;
  if p_reconcile_token is not null and (
    v_intent.reconcile_token is distinct from p_reconcile_token
    or v_intent.reconcile_lease_until is null
    or v_intent.reconcile_lease_until < now()
  ) then
    raise exception using errcode = 'P0001', message = 'RECONCILIATION_LEASE_LOST';
  end if;

  select status into v_grave_status from public.graves
  where id = v_intent.grave_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'GRAVE_UNAVAILABLE'; end if;
  if v_grave_status = 'deleted' and p_entitlement_status = 'active' then
    v_effective_review := true;
    v_effective_review_reason := 'GRAVE_DELETED';
  elsif v_grave_status = 'hidden' and p_entitlement_status = 'active' and not exists (
    select 1
    from public.grave_entitlements e
    join public.payment_orders o on o.id = e.source_order_id
    where e.grave_id = v_intent.grave_id
      and e.mode = p_mode
      and e.status = 'active'
      and o.mode = p_mode
      and o.provider_order_id = p_provider_order_id
  ) then
    v_effective_review := true;
    v_effective_review_reason := 'GRAVE_HIDDEN';
  end if;

  select * into v_existing_order from public.payment_orders
  where mode = p_mode and provider_order_id = p_provider_order_id for update;
  if found then
    if p_order_reconcile_token is not null and (
      v_existing_order.reconcile_token is distinct from p_order_reconcile_token
      or v_existing_order.reconcile_lease_until is null
      or v_existing_order.reconcile_lease_until < now()
    ) then
      raise exception using errcode = 'P0001', message = 'RECONCILIATION_LEASE_LOST';
    end if;
    if v_existing_order.purchase_intent_id <> p_intent_id then
      raise exception using errcode = 'P0001', message = 'ORDER_INTENT_MISMATCH';
    end if;
    if v_existing_order.provider_modified_at is not null
       and (p_provider_modified_at is null
         or p_provider_modified_at < v_existing_order.provider_modified_at) then
      if p_order_reconcile_token is not null then
        update public.payment_orders
        set reconcile_token = null, reconcile_lease_until = null,
            last_synced_at = now(), updated_at = now()
        where id = v_existing_order.id and reconcile_token = p_order_reconcile_token;
      end if;
      return jsonb_build_object(
        'status', 'stale', 'orderId', v_existing_order.id,
        'needsReview', v_existing_order.needs_review
      );
    end if;
    v_effective_refunded := greatest(v_existing_order.refunded_amount, p_refunded_amount);
  else
    if p_order_reconcile_token is not null then
      raise exception using errcode = 'P0001', message = 'RECONCILIATION_LEASE_LOST';
    end if;
    v_effective_refunded := p_refunded_amount;
  end if;

  insert into public.payment_orders(
    mode, provider_order_id, purchase_intent_id, provider_status,
    provider_product_id, provider_organization_id,
    subtotal_amount, discount_amount, net_amount, total_amount, refunded_amount,
    currency, needs_review, review_reason, provider_modified_at, last_synced_at
  ) values (
    p_mode, p_provider_order_id, p_intent_id, p_provider_status,
    p_provider_product_id, p_provider_organization_id,
    p_subtotal_amount, p_discount_amount, p_net_amount, p_total_amount, v_effective_refunded,
    upper(p_currency), v_effective_review, v_effective_review_reason, p_provider_modified_at, now()
  )
  on conflict (mode, provider_order_id) do update
  set provider_status = excluded.provider_status,
      provider_product_id = excluded.provider_product_id,
      provider_organization_id = excluded.provider_organization_id,
      subtotal_amount = excluded.subtotal_amount,
      discount_amount = excluded.discount_amount,
      net_amount = excluded.net_amount,
      total_amount = excluded.total_amount,
      refunded_amount = greatest(public.payment_orders.refunded_amount, excluded.refunded_amount),
      currency = excluded.currency,
      needs_review = excluded.needs_review,
      review_reason = excluded.review_reason,
      provider_modified_at = excluded.provider_modified_at,
      last_synced_at = now(), updated_at = now(),
      reconcile_token = null, reconcile_lease_until = null
  where public.payment_orders.provider_modified_at is null
     or (
       excluded.provider_modified_at is not null
       and excluded.provider_modified_at >= public.payment_orders.provider_modified_at
     )
  returning * into v_order;

  update public.purchase_intents
  set provider_order_id = p_provider_order_id,
      status = case when v_effective_review then 'review_required' else p_intent_status end,
      review_reason = v_effective_review_reason,
      checkout_url = case
        when (case when v_effective_review then 'review_required' else p_intent_status end) = 'checkout_open'
          then checkout_url
        else null
      end,
      reconcile_token = null, reconcile_lease_until = null, updated_at = now()
  where id = p_intent_id;

  select status into v_old_entitlement_status from public.grave_entitlements
  where grave_id = v_intent.grave_id and mode = p_mode;

  if p_entitlement_status = 'active'
     and coalesce(v_effective_review_reason, '') not in ('GRAVE_DELETED', 'GRAVE_HIDDEN') then
    if exists (
      select 1 from public.grave_entitlements
      where grave_id = v_intent.grave_id and mode = p_mode
        and status = 'active' and source_order_id <> v_order.id
    ) then
      update public.payment_orders
      set needs_review = true, review_reason = 'DUPLICATE_ORDER', updated_at = now()
      where id = v_order.id;
      update public.purchase_intents
      set status = 'review_required', review_reason = 'DUPLICATE_ORDER', updated_at = now()
      where id = p_intent_id;
      perform public.increment_metric('payment_review_required', 1);
    else
      insert into public.grave_entitlements(grave_id, mode, source_order_id, status, reason)
      values (v_intent.grave_id, p_mode, v_order.id, 'active', 'ORDER_PAID')
      on conflict (grave_id, mode) do update
      set source_order_id = excluded.source_order_id,
          status = case when public.grave_entitlements.status = 'suspended' then 'suspended' else 'active' end,
          reason = case
            when public.grave_entitlements.status = 'suspended' then public.grave_entitlements.reason
            else 'ORDER_PAID'
          end,
          updated_at = now();
      if v_old_entitlement_status is distinct from 'active' then
        perform public.increment_metric('purchase_paid', 1);
      end if;
    end if;
  elsif p_entitlement_status = 'revoked' then
    update public.grave_entitlements
    set status = 'revoked', reason = coalesce(p_review_reason, 'FULL_REFUND'), updated_at = now()
    where grave_id = v_intent.grave_id and mode = p_mode and source_order_id = v_order.id;
    if found then
      update public.graves set selected_style = 'classic', accent = 'stone', updated_at = now()
      where id = v_intent.grave_id;
      if v_old_entitlement_status is distinct from 'revoked' then
        perform public.increment_metric('purchase_refunded', v_effective_refunded);
      end if;
    end if;
  elsif p_entitlement_status = 'suspended' then
    update public.grave_entitlements
    set status = 'suspended', reason = coalesce(p_review_reason, 'PROVIDER_DISPUTE'), updated_at = now()
    where grave_id = v_intent.grave_id and mode = p_mode;
  end if;

  if v_effective_review and not coalesce(v_existing_order.needs_review, false) then
    perform public.increment_metric('payment_review_required', 1);
  end if;

  return jsonb_build_object(
    'orderId', v_order.id,
    'graveId', v_intent.grave_id,
    'needsReview', (select needs_review from public.payment_orders where id = v_order.id),
    'entitlementStatus', (
      select status from public.grave_entitlements
      where grave_id = v_intent.grave_id and mode = p_mode
    )
  );
end;
$$;

-- PostgreSQL grants EXECUTE to PUBLIC by default. These are server-only RPCs.
revoke execute on function public.increment_metric(text, bigint) from public, anon, authenticated;
revoke execute on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.create_grave(uuid, uuid, integer, text, text, integer, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.update_grave(uuid, uuid, integer, text, text, integer, text, text, text) from public, anon, authenticated;
revoke execute on function public.delete_grave_and_scrub(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.rotate_recovery_token(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.restore_grave_ownership(uuid, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.leave_flower(uuid, text) from public, anon, authenticated;
revoke execute on function public.create_report(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.moderate_grave(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.get_random_published_grave() from public, anon, authenticated;
revoke execute on function public.moderate_report(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.begin_purchase_intent(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.finish_checkout_creation(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.record_webhook_event(text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.claim_webhook_event(text, uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function public.finish_webhook_event(text, uuid, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.claim_purchase_intent_reconciliation(uuid, text, uuid, integer) from public, anon, authenticated;
revoke execute on function public.claim_payment_reconciliation_jobs(text, uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.claim_payment_order_reconciliation_jobs(text, uuid, integer, integer) from public, anon, authenticated;
revoke execute on function public.finish_purchase_intent_reconciliation(uuid, text, uuid, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.apply_payment_order_state(uuid, text, uuid, uuid, text, text, text, text, integer, integer, integer, integer, integer, text, timestamptz, text, text, boolean, text) from public, anon, authenticated;

grant execute on function public.increment_metric(text, bigint) to service_role;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.create_grave(uuid, uuid, integer, text, text, integer, text, text, text, text, text) to service_role;
grant execute on function public.update_grave(uuid, uuid, integer, text, text, integer, text, text, text) to service_role;
grant execute on function public.delete_grave_and_scrub(uuid, uuid, integer) to service_role;
grant execute on function public.rotate_recovery_token(uuid, uuid, text) to service_role;
grant execute on function public.restore_grave_ownership(uuid, text, uuid, text) to service_role;
grant execute on function public.leave_flower(uuid, text) to service_role;
grant execute on function public.create_report(uuid, text, text, text, text) to service_role;
grant execute on function public.moderate_grave(uuid, uuid, text, text, text) to service_role;
grant execute on function public.get_random_published_grave() to service_role;
grant execute on function public.moderate_report(uuid, uuid, text, text) to service_role;
grant execute on function public.begin_purchase_intent(uuid, uuid, text) to service_role;
grant execute on function public.finish_checkout_creation(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.record_webhook_event(text, text, text, text, jsonb) to service_role;
grant execute on function public.claim_webhook_event(text, uuid, uuid, integer) to service_role;
grant execute on function public.finish_webhook_event(text, uuid, uuid, boolean, text) to service_role;
grant execute on function public.claim_purchase_intent_reconciliation(uuid, text, uuid, integer) to service_role;
grant execute on function public.claim_payment_reconciliation_jobs(text, uuid, integer, integer) to service_role;
grant execute on function public.claim_payment_order_reconciliation_jobs(text, uuid, integer, integer) to service_role;
grant execute on function public.finish_purchase_intent_reconciliation(uuid, text, uuid, text, text, text, text, text, text) to service_role;
grant execute on function public.apply_payment_order_state(uuid, text, uuid, uuid, text, text, text, text, integer, integer, integer, integer, integer, text, timestamptz, text, text, boolean, text) to service_role;



