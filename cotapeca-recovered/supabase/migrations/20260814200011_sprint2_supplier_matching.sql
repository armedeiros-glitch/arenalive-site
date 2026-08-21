-- CotaPeça V1 - Sprint 2: supplier + matching + opportunities.
-- Explicitly excludes proposals/offers, prices, buyer/supplier contact and automated WhatsApp.

create type public.supplier_verification_status as enum ('pending', 'verified', 'rejected', 'blocked');
create type public.opportunity_status as enum ('sent', 'viewed', 'declined', 'expired');

create table public.suppliers (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_profile_id uuid not null unique references public.profiles(id) on delete restrict,
  legal_name text not null,
  trade_name text not null,
  cnpj_normalized text not null unique check (cnpj_normalized ~ '^[0-9]{14}$'),
  responsible_name text not null,
  phone_e164 text not null check (phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  whatsapp_e164 text not null check (whatsapp_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  email extensions.citext not null,
  city text not null,
  state char(2) not null check (state ~ '^[A-Z]{2}$'),
  location extensions.geography(Point, 4326),
  service_radius_km smallint not null check (service_radius_km in (30, 60, 100)),
  accepts_shipping boolean not null default false,
  all_brands boolean not null default false,
  verification_status public.supplier_verification_status not null default 'pending',
  verified_at timestamptz,
  rejected_at timestamptz,
  blocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (char_length(legal_name) between 2 and 180),
  check (char_length(trade_name) between 2 and 180),
  check (char_length(responsible_name) between 2 and 160),
  check (char_length(city) between 2 and 120)
);
create index suppliers_status_idx on public.suppliers(verification_status, state, city) where deleted_at is null;
create index suppliers_location_gix on public.suppliers using gist(location) where location is not null;
create trigger suppliers_set_updated_at before update on public.suppliers for each row execute function public.set_updated_at();

create table public.supplier_conditions (supplier_id uuid not null references public.suppliers(id) on delete cascade, condition public.part_condition not null, created_at timestamptz not null default now(), primary key (supplier_id, condition));
create table public.supplier_brands (supplier_id uuid not null references public.suppliers(id) on delete cascade, brand_id uuid not null references public.vehicle_brands(id) on delete cascade, created_at timestamptz not null default now(), primary key (supplier_id, brand_id));
create table public.supplier_categories (supplier_id uuid not null references public.suppliers(id) on delete cascade, category_id uuid not null references public.piece_categories(id) on delete cascade, created_at timestamptz not null default now(), primary key (supplier_id, category_id));

create table public.opportunities (
  id uuid primary key default extensions.gen_random_uuid(), quote_id uuid not null references public.quotes(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade, status public.opportunity_status not null default 'sent',
  distance_km numeric(8,2), matching_context jsonb not null default '{}'::jsonb, sent_at timestamptz not null default now(),
  viewed_at timestamptz, declined_at timestamptz, expires_at timestamptz not null, created_at timestamptz not null default now(),
  unique (quote_id, supplier_id)
);
create index opportunities_supplier_status_idx on public.opportunities(supplier_id, status, sent_at desc);
create index opportunities_quote_idx on public.opportunities(quote_id, created_at);

create or replace function public.register_supplier(payload jsonb) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_profile_id uuid; v_supplier_id uuid; v_condition text; v_brand uuid; v_category uuid; v_all_brands boolean := coalesce((payload->>'all_brands')::boolean, false);
begin
  select id into v_profile_id from public.profiles where auth_user_id = auth.uid() and status = 'active' and deleted_at is null;
  if v_profile_id is null then raise exception 'authentication required' using errcode='42501'; end if;
  if exists(select 1 from public.suppliers where owner_profile_id=v_profile_id and deleted_at is null) then raise exception 'supplier already registered' using errcode='23505'; end if;
  if coalesce(payload->>'cnpj','') !~ '^[0-9]{14}$' then raise exception 'invalid CNPJ' using errcode='22023'; end if;
  if jsonb_array_length(coalesce(payload->'conditions','[]'::jsonb)) < 1 then raise exception 'at least one condition is required' using errcode='22023'; end if;
  if not v_all_brands and jsonb_array_length(coalesce(payload->'brand_ids','[]'::jsonb)) < 1 then raise exception 'select brands or all brands' using errcode='22023'; end if;
  update public.profiles set role='supplier', name=btrim(payload->>'responsible_name'), email=nullif(btrim(payload->>'email'), '')::extensions.citext, phone_e164=btrim(payload->>'phone_e164') where id=v_profile_id;
  insert into public.suppliers(owner_profile_id, legal_name, trade_name, cnpj_normalized, responsible_name, phone_e164, whatsapp_e164, email, city, state, location, service_radius_km, accepts_shipping, all_brands)
  values (v_profile_id,btrim(payload->>'legal_name'),btrim(payload->>'trade_name'),payload->>'cnpj',btrim(payload->>'responsible_name'),payload->>'phone_e164',payload->>'whatsapp_e164',btrim(payload->>'email')::extensions.citext,btrim(payload->>'city'),upper(payload->>'state'),case when payload ? 'latitude' and payload ? 'longitude' then extensions.st_setsrid(extensions.st_makepoint((payload->>'longitude')::double precision,(payload->>'latitude')::double precision),4326)::extensions.geography else null end,(payload->>'service_radius_km')::smallint,coalesce((payload->>'accepts_shipping')::boolean,false),v_all_brands)
  returning id into v_supplier_id;
  for v_condition in select jsonb_array_elements_text(payload->'conditions') loop insert into public.supplier_conditions values (v_supplier_id,v_condition::public.part_condition,now()); end loop;
  if not v_all_brands then for v_brand in select (jsonb_array_elements_text(payload->'brand_ids'))::uuid loop insert into public.supplier_brands(supplier_id,brand_id) values(v_supplier_id,v_brand); end loop; end if;
  for v_category in select (jsonb_array_elements_text(coalesce(payload->'category_ids','[]'::jsonb)))::uuid loop insert into public.supplier_categories(supplier_id,category_id) values(v_supplier_id,v_category); end loop;
  return v_supplier_id;
end; $$;
revoke all on function public.register_supplier(jsonb) from public, anon; grant execute on function public.register_supplier(jsonb) to authenticated;

create or replace function public.admin_set_supplier_status(p_supplier_id uuid, p_status public.supplier_verification_status) returns void language plpgsql security definer set search_path = '' as $$
declare v_before jsonb; v_after jsonb;
begin
  if not private.is_admin() then raise exception 'admin required' using errcode='42501'; end if;
  select to_jsonb(s) into v_before from public.suppliers s where id=p_supplier_id and deleted_at is null for update;
  if v_before is null then raise exception 'supplier not found' using errcode='P0002'; end if;
  update public.suppliers set verification_status=p_status, verified_at=case when p_status='verified' then now() else verified_at end, rejected_at=case when p_status='rejected' then now() else rejected_at end, blocked_at=case when p_status='blocked' then now() else null end where id=p_supplier_id;
  select to_jsonb(s) into v_after from public.suppliers s where id=p_supplier_id;
  insert into public.audit_logs(actor_user_id, actor_role, action, entity_type, entity_id, before_data, after_data) values(auth.uid(),'admin','supplier_status_changed','supplier',p_supplier_id,v_before,v_after);
end; $$;
revoke all on function public.admin_set_supplier_status(uuid, public.supplier_verification_status) from public, anon; grant execute on function public.admin_set_supplier_status(uuid, public.supplier_verification_status) to authenticated;

create or replace function private.run_quote_matching_internal(p_quote_id uuid) returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer := 0;
begin
  with q as (select q.*,v.brand_id,v.brand_name from public.quotes q join public.vehicles v on v.id=q.vehicle_id where q.id=p_quote_id and q.status='active' and q.deleted_at is null and q.expires_at>now()),
  candidates as (
    select s.id supplier_id, case when q.location is not null and s.location is not null then round((extensions.st_distance(q.location,s.location)/1000.0)::numeric,2) else null end distance_km, q.expires_at,
      jsonb_build_object('condition_match',true,'brand_mode',case when q.brand_id is null then 'unknown_permissive' when s.all_brands then 'all_brands' else 'configured_match' end,'category_mode',case when exists(select 1 from public.quote_items qi where qi.quote_id=q.id and qi.deleted_at is null and qi.category_id is null) then 'unknown_permissive' when not exists(select 1 from public.supplier_categories sc where sc.supplier_id=s.id) then 'supplier_unconfigured_permissive' else 'configured_match' end,'location_mode',case when q.location is not null and s.location is not null then 'coordinates' when lower(q.city)=lower(s.city) and q.state=s.state then 'city_state_fallback' else 'shipping' end,'shipping_used',case when q.location is not null and s.location is not null then extensions.st_distance(q.location,s.location)/1000.0 > least(q.radius_km,s.service_radius_km) when lower(q.city)=lower(s.city) and q.state=s.state then false else true end) context
    from q cross join public.suppliers s
    where s.verification_status='verified' and s.deleted_at is null
      and exists(select 1 from public.supplier_conditions sc join public.quote_conditions qc on qc.condition=sc.condition where sc.supplier_id=s.id and qc.quote_id=q.id)
      and (q.brand_id is null or s.all_brands or exists(select 1 from public.supplier_brands sb where sb.supplier_id=s.id and sb.brand_id=q.brand_id))
      and (exists(select 1 from public.quote_items qi where qi.quote_id=q.id and qi.deleted_at is null and qi.category_id is null) or not exists(select 1 from public.supplier_categories sc where sc.supplier_id=s.id) or exists(select 1 from public.quote_items qi join public.supplier_categories sc on sc.category_id=qi.category_id and sc.supplier_id=s.id where qi.quote_id=q.id and qi.deleted_at is null))
      and ((q.location is not null and s.location is not null and extensions.st_distance(q.location,s.location)/1000.0 <= least(q.radius_km,s.service_radius_km)) or ((q.location is null or s.location is null) and lower(q.city)=lower(s.city) and q.state=s.state) or (q.accepts_shipping and s.accepts_shipping))
  ), ins as (insert into public.opportunities(quote_id,supplier_id,distance_km,matching_context,expires_at) select p_quote_id,c.supplier_id,c.distance_km,c.context,c.expires_at from candidates c on conflict (quote_id,supplier_id) do nothing returning 1)
  select count(*) into v_count from ins; return v_count;
end; $$;
revoke all on function private.run_quote_matching_internal(uuid) from public, anon, authenticated; grant execute on function private.run_quote_matching_internal(uuid) to service_role;

create or replace function public.run_quote_matching(p_quote_id uuid) returns integer language plpgsql security definer set search_path='' as $$ begin if not private.is_admin() then raise exception 'admin required' using errcode='42501'; end if; return private.run_quote_matching_internal(p_quote_id); end; $$;
revoke all on function public.run_quote_matching(uuid) from public, anon; grant execute on function public.run_quote_matching(uuid) to authenticated;

create or replace function private.log_supplier_notified() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.analytics_events(event_name,supplier_id,quote_id,opportunity_id,metadata) values('supplier_notified',new.supplier_id,new.quote_id,new.id,jsonb_build_object('distance_km',new.distance_km)); return new; end; $$;
revoke all on function private.log_supplier_notified() from public,anon,authenticated,service_role;
create trigger opportunity_notified_after_insert after insert on public.opportunities for each row execute function private.log_supplier_notified();

create or replace function public.view_opportunity(p_opportunity_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_supplier uuid;
begin select s.id into v_supplier from public.suppliers s where s.owner_profile_id=private.current_profile_id() and s.verification_status='verified' and s.deleted_at is null;
  update public.opportunities set status='viewed',viewed_at=coalesce(viewed_at,now()) where id=p_opportunity_id and supplier_id=v_supplier and status='sent' and expires_at>now();
  if not found then if exists(select 1 from public.opportunities where id=p_opportunity_id and supplier_id=v_supplier and status='viewed') then return; end if; raise exception 'opportunity unavailable' using errcode='42501'; end if;
  insert into public.analytics_events(event_name,actor_user_id,actor_role,supplier_id,quote_id,opportunity_id) select 'opportunity_viewed',auth.uid(),'supplier',o.supplier_id,o.quote_id,o.id from public.opportunities o where o.id=p_opportunity_id;
end; $$;
revoke all on function public.view_opportunity(uuid) from public,anon; grant execute on function public.view_opportunity(uuid) to authenticated;

create or replace function public.decline_opportunity(p_opportunity_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare v_supplier uuid;
begin select s.id into v_supplier from public.suppliers s where s.owner_profile_id=private.current_profile_id() and s.verification_status='verified' and s.deleted_at is null;
  update public.opportunities set status='declined',declined_at=now(),viewed_at=coalesce(viewed_at,now()) where id=p_opportunity_id and supplier_id=v_supplier and status in ('sent','viewed') and expires_at>now(); if not found then raise exception 'opportunity unavailable' using errcode='42501'; end if;
  insert into public.analytics_events(event_name,actor_user_id,actor_role,supplier_id,quote_id,opportunity_id) select 'opportunity_declined',auth.uid(),'supplier',o.supplier_id,o.quote_id,o.id from public.opportunities o where o.id=p_opportunity_id;
end; $$;
revoke all on function public.decline_opportunity(uuid) from public,anon; grant execute on function public.decline_opportunity(uuid) to authenticated;

alter table public.suppliers enable row level security; alter table public.suppliers force row level security;
alter table public.supplier_conditions enable row level security; alter table public.supplier_conditions force row level security;
alter table public.supplier_brands enable row level security; alter table public.supplier_brands force row level security;
alter table public.supplier_categories enable row level security; alter table public.supplier_categories force row level security;
alter table public.opportunities enable row level security; alter table public.opportunities force row level security;
revoke all on public.suppliers,public.supplier_conditions,public.supplier_brands,public.supplier_categories,public.opportunities from anon,authenticated;
grant select on public.suppliers,public.supplier_conditions,public.supplier_brands,public.supplier_categories,public.opportunities to authenticated;
create policy suppliers_self_or_admin_select on public.suppliers for select to authenticated using(owner_profile_id=private.current_profile_id() or private.is_admin());
create policy supplier_conditions_self_or_admin on public.supplier_conditions for select to authenticated using(exists(select 1 from public.suppliers s where s.id=supplier_id and (s.owner_profile_id=private.current_profile_id() or private.is_admin())));
create policy supplier_brands_self_or_admin on public.supplier_brands for select to authenticated using(exists(select 1 from public.suppliers s where s.id=supplier_id and (s.owner_profile_id=private.current_profile_id() or private.is_admin())));
create policy supplier_categories_self_or_admin on public.supplier_categories for select to authenticated using(exists(select 1 from public.suppliers s where s.id=supplier_id and (s.owner_profile_id=private.current_profile_id() or private.is_admin())));
create policy opportunities_supplier_or_admin_select on public.opportunities for select to authenticated using(private.is_admin() or exists(select 1 from public.suppliers s where s.id=supplier_id and s.owner_profile_id=private.current_profile_id() and s.verification_status='verified' and s.deleted_at is null));
create policy quotes_assigned_supplier_select on public.quotes for select to authenticated using(exists(select 1 from public.opportunities o join public.suppliers s on s.id=o.supplier_id where o.quote_id=quotes.id and s.owner_profile_id=private.current_profile_id() and s.verification_status='verified' and o.status in('sent','viewed') and o.expires_at>now()));
create policy vehicles_assigned_supplier_select on public.vehicles for select to authenticated using(exists(select 1 from public.quotes q join public.opportunities o on o.quote_id=q.id join public.suppliers s on s.id=o.supplier_id where q.vehicle_id=vehicles.id and s.owner_profile_id=private.current_profile_id() and s.verification_status='verified' and o.status in('sent','viewed') and o.expires_at>now()));
create policy quote_conditions_assigned_supplier_select on public.quote_conditions for select to authenticated using(exists(select 1 from public.opportunities o join public.suppliers s on s.id=o.supplier_id where o.quote_id=quote_conditions.quote_id and s.owner_profile_id=private.current_profile_id() and s.verification_status='verified' and o.status in('sent','viewed') and o.expires_at>now()));
create policy quote_items_assigned_supplier_select on public.quote_items for select to authenticated using(deleted_at is null and exists(select 1 from public.opportunities o join public.suppliers s on s.id=o.supplier_id where o.quote_id=quote_items.quote_id and s.owner_profile_id=private.current_profile_id() and s.verification_status='verified' and o.status in('sent','viewed') and o.expires_at>now()));
create policy quote_item_photos_assigned_supplier_select on public.quote_item_photos for select to authenticated using(deleted_at is null and exists(select 1 from public.quote_items qi join public.opportunities o on o.quote_id=qi.quote_id join public.suppliers s on s.id=o.supplier_id where qi.id=quote_item_photos.quote_item_id and s.owner_profile_id=private.current_profile_id() and s.verification_status='verified' and o.status in('sent','viewed') and o.expires_at>now()));
create policy quote_photos_assigned_supplier_select on storage.objects for select to authenticated using(bucket_id='quote-photos' and exists(select 1 from public.quote_item_photos qp join public.quote_items qi on qi.id=qp.quote_item_id join public.opportunities o on o.quote_id=qi.quote_id join public.suppliers s on s.id=o.supplier_id where qp.storage_key=storage.objects.name and s.owner_profile_id=private.current_profile_id() and s.verification_status='verified' and o.status in('sent','viewed') and o.expires_at>now()));
do $$ begin alter publication supabase_realtime add table public.opportunities; exception when duplicate_object then null; end $$;