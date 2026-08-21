-- CotaPeça V1 - Sprint 0 foundation
-- Source of truth order: PRD > architect decisions > architecture v1.0 > implementation.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists postgis with schema extensions;

create type public.profile_role as enum ('buyer', 'supplier', 'admin');
create type public.profile_status as enum ('active', 'blocked');

create table public.profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  role public.profile_role not null default 'buyer',
  name text,
  email extensions.citext,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  account_type text not null default 'launch',
  plan_code text not null default 'free_launch',
  status public.profile_status not null default 'active',
  is_test_account boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index profiles_role_status_idx on public.profiles(role, status) where deleted_at is null;

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.analytics_events (
  id uuid primary key default extensions.gen_random_uuid(),
  event_name text not null,
  anonymous_session_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role public.profile_role,
  buyer_id uuid,
  supplier_id uuid,
  quote_id uuid,
  opportunity_id uuid,
  offer_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  request_id uuid not null default extensions.gen_random_uuid()
);

create index analytics_events_name_time_idx on public.analytics_events(event_name, occurred_at desc);
create index analytics_events_quote_idx on public.analytics_events(quote_id, occurred_at) where quote_id is not null;

create table public.app_logs (
  id bigint generated always as identity primary key,
  level text not null check (level in ('debug', 'info', 'warn', 'error')),
  message text not null,
  context jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  request_id uuid not null default extensions.gen_random_uuid(),
  created_at timestamptz not null default now()
);

create index app_logs_created_at_idx on public.app_logs(created_at desc);
create index app_logs_request_id_idx on public.app_logs(request_id);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role public.profile_role,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  request_id uuid not null default extensions.gen_random_uuid(),
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger system_settings_set_updated_at
before update on public.system_settings
for each row execute function public.set_updated_at();

create trigger feature_flags_set_updated_at
before update on public.feature_flags
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (auth_user_id, role, email)
  values (new.id, 'buyer', new.email)
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where auth_user_id = auth.uid()
    and deleted_at is null
  limit 1;
$$;

create or replace function public.current_profile_role()
returns public.profile_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where auth_user_id = auth.uid()
    and status = 'active'
    and deleted_at is null
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_profile_role() = 'admin', false);
$$;

revoke all on function public.current_profile_id() from public;
revoke all on function public.current_profile_role() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.system_settings enable row level security;
alter table public.system_settings force row level security;
alter table public.feature_flags enable row level security;
alter table public.feature_flags force row level security;
alter table public.analytics_events enable row level security;
alter table public.analytics_events force row level security;
alter table public.app_logs enable row level security;
alter table public.app_logs force row level security;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.system_settings from anon, authenticated;
revoke all on public.feature_flags from anon, authenticated;
revoke all on public.analytics_events from anon, authenticated;
revoke all on public.app_logs from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (name, phone_e164) on public.profiles to authenticated;
grant select on public.system_settings to authenticated;
grant select on public.feature_flags to authenticated;
grant select on public.analytics_events to authenticated;
grant select on public.app_logs to authenticated;
grant select on public.audit_logs to authenticated;

create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (auth_user_id = auth.uid() or public.is_admin());

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (auth_user_id = auth.uid() and status = 'active' and deleted_at is null)
with check (auth_user_id = auth.uid() and status = 'active' and deleted_at is null);

create policy system_settings_admin_read
on public.system_settings
for select
to authenticated
using (public.is_admin());

create policy feature_flags_admin_read
on public.feature_flags
for select
to authenticated
using (public.is_admin());

create policy analytics_events_admin_read
on public.analytics_events
for select
to authenticated
using (public.is_admin());

create policy app_logs_admin_read
on public.app_logs
for select
to authenticated
using (public.is_admin());

create policy audit_logs_admin_read
on public.audit_logs
for select
to authenticated
using (public.is_admin());

insert into public.system_settings (key, value, description)
values
  ('launch_mode', 'true'::jsonb, 'V1 launch mode. Must not block buyer or supplier.'),
  ('monetization_enabled', 'false'::jsonb, 'Active monetization is forbidden in V1.'),
  ('quote_expiration_hours', '48'::jsonb, 'Default quote lifetime in hours.')
on conflict (key) do update
set value = excluded.value,
    description = excluded.description,
    updated_at = now();

insert into public.feature_flags (key, enabled, description)
values
  ('monetization', false, 'Reserved for future evolution; disabled during V1 launch.')
on conflict (key) do update
set enabled = excluded.enabled,
    description = excluded.description,
    updated_at = now();

comment on table public.analytics_events is 'Official operational event source for CotaPeca V1 analytics. Critical events are emitted server-side.';
comment on column public.profiles.role is 'Defaults to buyer. Supplier/admin elevation must occur through privileged server/admin workflows, never self-service SQL.';