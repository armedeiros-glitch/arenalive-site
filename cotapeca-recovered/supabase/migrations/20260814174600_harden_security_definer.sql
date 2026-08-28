-- Sprint 0 security hardening: keep SECURITY DEFINER helpers out of the exposed public API schema.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create or replace function private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.profiles
  where auth_user_id = auth.uid()
    and deleted_at is null
  limit 1;
$$;

create or replace function private.current_profile_role()
returns public.profile_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where auth_user_id = auth.uid()
    and status = 'active'
    and deleted_at is null
  limit 1;
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_profile_role() = 'admin'::public.profile_role, false);
$$;

revoke all on function private.current_profile_id() from public, anon;
revoke all on function private.current_profile_role() from public, anon;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.current_profile_id() to authenticated, service_role;
grant execute on function private.current_profile_role() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (auth_user_id, role, email)
  values (new.id, 'buyer'::public.profile_role, new.email)
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated, service_role;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (auth_user_id = auth.uid() or private.is_admin());

drop policy if exists system_settings_admin_read on public.system_settings;
create policy system_settings_admin_read
on public.system_settings
for select
to authenticated
using (private.is_admin());

drop policy if exists feature_flags_admin_read on public.feature_flags;
create policy feature_flags_admin_read
on public.feature_flags
for select
to authenticated
using (private.is_admin());

drop policy if exists analytics_events_admin_read on public.analytics_events;
create policy analytics_events_admin_read
on public.analytics_events
for select
to authenticated
using (private.is_admin());

drop policy if exists app_logs_admin_read on public.app_logs;
create policy app_logs_admin_read
on public.app_logs
for select
to authenticated
using (private.is_admin());

drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read
on public.audit_logs
for select
to authenticated
using (private.is_admin());

drop function if exists public.current_profile_id();
drop function if exists public.is_admin();
drop function if exists public.current_profile_role();
drop function if exists public.handle_new_auth_user();