create or replace function private.quote_submission_context_enabled()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select current_setting('app.quote_submission', true) = '1';
$$;

create or replace function private.quote_expiration_hours()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((value #>> '{}')::integer, 48)
  from public.system_settings
  where key = 'quote_expiration_hours'
  limit 1;
$$;

create or replace function private.classify_piece_category(piece text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pck.category_id
  from public.piece_category_keywords pck
  join public.piece_categories pc on pc.id = pck.category_id and pc.active
  where position(lower(pck.keyword) in lower(piece)) > 0
  order by char_length(pck.keyword) desc, pck.id
  limit 1;
$$;

create or replace function private.ingest_public_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role public.profile_role;
begin
  select role into current_role
  from public.profiles
  where auth_user_id = auth.uid()
    and status = 'active'
    and deleted_at is null
  limit 1;

  insert into public.analytics_events (
    event_name,
    anonymous_session_id,
    actor_user_id,
    actor_role,
    metadata
  ) values (
    new.event_name,
    new.anonymous_session_id,
    auth.uid(),
    current_role,
    coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object('draft_id', new.draft_id)
  );

  return null;
end;
$$;

revoke all on function private.quote_submission_context_enabled() from public, anon;
revoke all on function private.quote_expiration_hours() from public, anon;
revoke all on function private.classify_piece_category(text) from public, anon;
revoke all on function private.ingest_public_event() from public, anon, authenticated, service_role;
grant execute on function private.quote_submission_context_enabled() to authenticated, service_role;
grant execute on function private.quote_expiration_hours() to authenticated, service_role;
grant execute on function private.classify_piece_category(text) to authenticated, service_role;

create trigger event_ingest_before_insert
before insert on public.event_ingest
for each row execute function private.ingest_public_event();

create or replace function private.enforce_quote_submission_context()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.quote_submission_context_enabled() then
    raise exception 'direct quote writes are not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_quote_submission_context() from public, anon;
grant execute on function private.enforce_quote_submission_context() to authenticated, service_role;

create trigger buyer_profiles_submission_guard before insert or update on public.buyer_profiles
for each row execute function private.enforce_quote_submission_context();
create trigger vehicles_submission_guard before insert or update on public.vehicles
for each row execute function private.enforce_quote_submission_context();
create trigger quotes_submission_guard before insert on public.quotes
for each row execute function private.enforce_quote_submission_context();
create trigger quote_items_submission_guard before insert or update on public.quote_items
for each row execute function private.enforce_quote_submission_context();
create trigger quote_conditions_submission_guard before insert on public.quote_conditions
for each row execute function private.enforce_quote_submission_context();
create trigger quote_item_photos_submission_guard before insert or update on public.quote_item_photos
for each row execute function private.enforce_quote_submission_context();

create or replace function private.track_quote_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_auth_user_id uuid;
begin
  select auth_user_id into owner_auth_user_id
  from public.profiles
  where id = new.buyer_id;

  insert into public.analytics_events (
    event_name,
    anonymous_session_id,
    actor_user_id,
    actor_role,
    buyer_id,
    quote_id,
    metadata,
    occurred_at
  ) values (
    'quote_created',
    new.anonymous_session_id,
    owner_auth_user_id,
    'buyer'::public.profile_role,
    new.buyer_id,
    new.id,
    jsonb_build_object('draft_id', new.draft_id, 'public_code', new.public_code),
    new.created_at
  );

  return new;
end;
$$;

revoke all on function private.track_quote_created() from public, anon, authenticated, service_role;

create trigger quotes_track_created
after insert on public.quotes
for each row execute function private.track_quote_created();