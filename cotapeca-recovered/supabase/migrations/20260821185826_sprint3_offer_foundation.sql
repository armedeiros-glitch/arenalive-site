-- Sprint 3 — Proposal foundation. WhatsApp and buyer comparison are intentionally out of scope.

create type public.offer_status as enum ('submitted', 'withdrawn');

create table public.offers (
  id uuid primary key default extensions.gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete restrict,
  quote_id uuid not null references public.quotes(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  status public.offer_status not null default 'submitted',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint offers_one_per_opportunity unique (opportunity_id)
);

create table public.offer_items (
  id uuid primary key default extensions.gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  quote_item_id uuid not null references public.quote_items(id) on delete restrict,
  price_cents integer not null check (price_cents > 0),
  condition public.part_condition not null,
  brand_name text not null check (length(btrim(brand_name)) between 1 and 80),
  availability_days smallint not null default 0 check (availability_days between 0 and 365),
  delivery_method text not null default 'pickup' check (delivery_method in ('pickup','shipping','both')),
  delivery_days smallint check (delivery_days is null or delivery_days between 0 and 365),
  warranty_days smallint check (warranty_days is null or warranty_days between 0 and 3650),
  notes text,
  created_at timestamptz not null default now(),
  constraint offer_items_one_per_quote_item unique (offer_id, quote_item_id)
);

create table public.offer_item_photos (
  id uuid primary key default extensions.gen_random_uuid(),
  offer_item_id uuid not null references public.offer_items(id) on delete cascade,
  storage_key text not null,
  sort_order smallint not null default 0 check (sort_order between 0 and 9),
  created_at timestamptz not null default now(),
  constraint offer_item_photos_storage_key_unique unique (storage_key)
);

create index offers_supplier_created_idx on public.offers(supplier_id, created_at desc) where deleted_at is null;
create index offers_quote_idx on public.offers(quote_id) where deleted_at is null;
create index offer_items_offer_idx on public.offer_items(offer_id);
create index offer_item_photos_item_idx on public.offer_item_photos(offer_item_id, sort_order);

alter table public.offers enable row level security;
alter table public.offer_items enable row level security;
alter table public.offer_item_photos enable row level security;

create policy offers_supplier_read_own
on public.offers for select to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.suppliers s
    where s.id = offers.supplier_id
      and s.owner_profile_id = private.current_profile_id()
      and s.deleted_at is null
  )
);

create policy offer_items_supplier_read_own
on public.offer_items for select to authenticated
using (
  exists (
    select 1
    from public.offers o
    join public.suppliers s on s.id = o.supplier_id
    where o.id = offer_items.offer_id
      and o.deleted_at is null
      and s.owner_profile_id = private.current_profile_id()
      and s.deleted_at is null
  )
);

create policy offer_item_photos_supplier_read_own
on public.offer_item_photos for select to authenticated
using (
  exists (
    select 1
    from public.offer_items oi
    join public.offers o on o.id = oi.offer_id
    join public.suppliers s on s.id = o.supplier_id
    where oi.id = offer_item_photos.offer_item_id
      and o.deleted_at is null
      and s.owner_profile_id = private.current_profile_id()
      and s.deleted_at is null
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('offer-photos', 'offer-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy offer_photos_supplier_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'offer-photos'
  and exists (
    select 1
    from public.suppliers s
    join public.opportunities o on o.supplier_id = s.id
    where s.owner_profile_id = private.current_profile_id()
      and s.deleted_at is null
      and s.verification_status = 'verified'
      and s.id::text = (storage.foldername(name))[1]
      and o.id::text = (storage.foldername(name))[2]
      and o.status in ('sent','viewed')
      and o.expires_at > now()
  )
);

create policy offer_photos_supplier_select
on storage.objects for select to authenticated
using (
  bucket_id = 'offer-photos'
  and exists (
    select 1 from public.suppliers s
    where s.owner_profile_id = private.current_profile_id()
      and s.deleted_at is null
      and s.id::text = (storage.foldername(name))[1]
  )
);

create policy offer_photos_supplier_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'offer-photos'
  and exists (
    select 1 from public.suppliers s
    where s.owner_profile_id = private.current_profile_id()
      and s.deleted_at is null
      and s.id::text = (storage.foldername(name))[1]
  )
);

create or replace function private.start_offer(p_opportunity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplier_id uuid;
  v_quote_id uuid;
  v_buyer_id uuid;
begin
  select o.supplier_id, o.quote_id, q.buyer_id
    into v_supplier_id, v_quote_id, v_buyer_id
  from public.opportunities o
  join public.suppliers s on s.id = o.supplier_id
  join public.quotes q on q.id = o.quote_id
  where o.id = p_opportunity_id
    and o.status in ('sent','viewed')
    and o.expires_at > now()
    and q.deleted_at is null
    and q.expires_at > now()
    and s.verification_status = 'verified'
    and s.deleted_at is null
    and s.owner_profile_id = private.current_profile_id();

  if v_supplier_id is null then
    raise exception 'opportunity_unavailable';
  end if;

  if exists (select 1 from public.offers where opportunity_id = p_opportunity_id and deleted_at is null) then
    return;
  end if;

  insert into public.analytics_events(event_name, actor_user_id, actor_role, buyer_id, supplier_id, quote_id, opportunity_id)
  values ('offer_started', auth.uid(), 'supplier', v_buyer_id, v_supplier_id, v_quote_id, p_opportunity_id);
end;
$$;

create or replace function private.create_offer(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_opportunity_id uuid := (payload->>'opportunity_id')::uuid;
  v_supplier_id uuid;
  v_quote_id uuid;
  v_buyer_id uuid;
  v_accepts_shipping boolean;
  v_offer_id uuid;
  v_item jsonb;
  v_offer_item_id uuid;
  v_quote_item_id uuid;
  v_condition public.part_condition;
  v_delivery_method text;
  v_photo text;
  v_item_count integer;
  v_photo_index integer;
begin
  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') < 1 then
    raise exception 'offer_items_required';
  end if;

  select o.supplier_id, o.quote_id, q.buyer_id, q.accepts_shipping
    into v_supplier_id, v_quote_id, v_buyer_id, v_accepts_shipping
  from public.opportunities o
  join public.suppliers s on s.id = o.supplier_id
  join public.quotes q on q.id = o.quote_id
  where o.id = v_opportunity_id
    and o.status in ('sent','viewed')
    and o.expires_at > now()
    and q.deleted_at is null
    and q.expires_at > now()
    and s.verification_status = 'verified'
    and s.deleted_at is null
    and s.owner_profile_id = private.current_profile_id();

  if v_supplier_id is null then
    raise exception 'opportunity_unavailable';
  end if;

  if exists (select 1 from public.offers where opportunity_id = v_opportunity_id and deleted_at is null) then
    raise exception 'offer_already_exists';
  end if;

  select count(*) into v_item_count
  from (
    select distinct (x->>'quote_item_id')::uuid
    from jsonb_array_elements(payload->'items') x
  ) d;
  if v_item_count <> jsonb_array_length(payload->'items') then
    raise exception 'duplicate_offer_item';
  end if;

  insert into public.offers(opportunity_id, quote_id, supplier_id, notes)
  values (v_opportunity_id, v_quote_id, v_supplier_id, nullif(btrim(payload->>'notes'), ''))
  returning id into v_offer_id;

  for v_item in select value from jsonb_array_elements(payload->'items')
  loop
    v_quote_item_id := (v_item->>'quote_item_id')::uuid;
    v_condition := (v_item->>'condition')::public.part_condition;
    v_delivery_method := coalesce(nullif(v_item->>'delivery_method',''), 'pickup');

    if not exists (
      select 1 from public.quote_items qi
      where qi.id = v_quote_item_id and qi.quote_id = v_quote_id and qi.deleted_at is null
    ) then
      raise exception 'invalid_quote_item';
    end if;

    if not exists (
      select 1 from public.quote_conditions qc
      where qc.quote_id = v_quote_id and qc.condition = v_condition
    ) then
      raise exception 'condition_not_accepted';
    end if;

    if v_delivery_method not in ('pickup','shipping','both') then
      raise exception 'invalid_delivery_method';
    end if;
    if v_delivery_method in ('shipping','both') and not v_accepts_shipping then
      raise exception 'shipping_not_accepted';
    end if;

    insert into public.offer_items(
      offer_id, quote_item_id, price_cents, condition, brand_name,
      availability_days, delivery_method, delivery_days, warranty_days, notes
    ) values (
      v_offer_id,
      v_quote_item_id,
      (v_item->>'price_cents')::integer,
      v_condition,
      btrim(v_item->>'brand_name'),
      coalesce((v_item->>'availability_days')::smallint, 0),
      v_delivery_method,
      nullif(v_item->>'delivery_days','')::smallint,
      nullif(v_item->>'warranty_days','')::smallint,
      nullif(btrim(v_item->>'notes'), '')
    ) returning id into v_offer_item_id;

    if jsonb_typeof(v_item->'photo_storage_keys') = 'array' then
      v_photo_index := 0;
      for v_photo in select jsonb_array_elements_text(v_item->'photo_storage_keys')
      loop
        if v_photo not like v_supplier_id::text || '/' || v_opportunity_id::text || '/%' then
          raise exception 'invalid_offer_photo_path';
        end if;
        if v_photo_index >= 5 then
          raise exception 'too_many_offer_photos';
        end if;
        insert into public.offer_item_photos(offer_item_id, storage_key, sort_order)
        values (v_offer_item_id, v_photo, v_photo_index);
        v_photo_index := v_photo_index + 1;
      end loop;
    end if;
  end loop;

  insert into public.analytics_events(
    event_name, actor_user_id, actor_role, buyer_id, supplier_id, quote_id, opportunity_id, offer_id,
    metadata
  ) values (
    'offer_created', auth.uid(), 'supplier', v_buyer_id, v_supplier_id, v_quote_id, v_opportunity_id, v_offer_id,
    jsonb_build_object('item_count', jsonb_array_length(payload->'items'))
  );

  return v_offer_id;
end;
$$;

revoke all on function private.start_offer(uuid) from public, anon;
revoke all on function private.create_offer(jsonb) from public, anon;
grant execute on function private.start_offer(uuid) to authenticated;
grant execute on function private.create_offer(jsonb) to authenticated;

create function public.start_offer(p_opportunity_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.start_offer(p_opportunity_id); $$;

create function public.create_offer(payload jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.create_offer(payload); $$;

revoke all on function public.start_offer(uuid) from public, anon;
revoke all on function public.create_offer(jsonb) from public, anon;
grant execute on function public.start_offer(uuid) to authenticated;
grant execute on function public.create_offer(jsonb) to authenticated;

revoke insert, update, delete on public.offers from anon, authenticated;
revoke insert, update, delete on public.offer_items from anon, authenticated;
revoke insert, update, delete on public.offer_item_photos from anon, authenticated;
grant select on public.offers, public.offer_items, public.offer_item_photos to authenticated;

alter table public.analytics_events
  add constraint analytics_events_offer_id_fkey
  foreign key (offer_id) references public.offers(id) on delete set null;
