-- Sprint 4 — Buyer quote list and proposal comparison. Selection/contact/WhatsApp remain out of scope.

create or replace function private.list_buyer_quotes()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_id uuid := private.current_profile_id();
  v_result jsonb;
begin
  if v_buyer_id is null or private.current_profile_role() <> 'buyer' then
    raise exception 'buyer_required';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'public_code', q.public_code,
      'status', q.status,
      'city', q.city,
      'state', btrim(q.state::text),
      'created_at', q.created_at,
      'expires_at', q.expires_at,
      'vehicle', jsonb_build_object(
        'brand_name', v.brand_name,
        'model', v.model,
        'year', v.year,
        'version', v.version
      ),
      'item_count', (select count(*) from public.quote_items qi where qi.quote_id=q.id and qi.deleted_at is null),
      'offer_count', (select count(*) from public.offers o where o.quote_id=q.id and o.status='submitted' and o.deleted_at is null),
      'last_offer_at', (select max(o.created_at) from public.offers o where o.quote_id=q.id and o.status='submitted' and o.deleted_at is null)
    ) order by q.created_at desc
  ), '[]'::jsonb)
  into v_result
  from public.quotes q
  join public.vehicles v on v.id=q.vehicle_id and v.deleted_at is null
  where q.buyer_id=v_buyer_id and q.deleted_at is null;

  return v_result;
end;
$$;

create or replace function private.get_quote_comparison(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_id uuid := private.current_profile_id();
  v_result jsonb;
  v_exists boolean;
begin
  if v_buyer_id is null or private.current_profile_role() <> 'buyer' then
    raise exception 'buyer_required';
  end if;

  select exists(
    select 1 from public.quotes q
    where q.id=p_quote_id and q.buyer_id=v_buyer_id and q.deleted_at is null
  ) into v_exists;

  if not v_exists then
    raise exception 'quote_unavailable';
  end if;

  insert into public.analytics_events(event_name, actor_user_id, actor_role, buyer_id, quote_id)
  values ('comparison_viewed', auth.uid(), 'buyer', v_buyer_id, p_quote_id);

  select jsonb_build_object(
    'quote', jsonb_build_object(
      'id', q.id,
      'public_code', q.public_code,
      'status', q.status,
      'city', q.city,
      'state', btrim(q.state::text),
      'created_at', q.created_at,
      'expires_at', q.expires_at
    ),
    'vehicle', jsonb_build_object(
      'brand_name', v.brand_name,
      'model', v.model,
      'year', v.year,
      'version', v.version
    ),
    'item_count', (select count(*) from public.quote_items qi where qi.quote_id=q.id and qi.deleted_at is null),
    'offer_count', (select count(*) from public.offers o where o.quote_id=q.id and o.status='submitted' and o.deleted_at is null),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', qi.id,
          'piece_name', qi.piece_name,
          'side', qi.side,
          'notes', qi.notes,
          'offers', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'offer_id', o.id,
                'supplier_id', o.supplier_id,
                'supplier_name', s.trade_name,
                'offer_created_at', o.created_at,
                'price_cents', oi.price_cents,
                'condition', oi.condition,
                'brand_name', oi.brand_name,
                'availability_days', oi.availability_days,
                'delivery_method', oi.delivery_method,
                'delivery_days', oi.delivery_days,
                'warranty_days', oi.warranty_days,
                'notes', oi.notes,
                'photo_storage_keys', coalesce((
                  select jsonb_agg(oip.storage_key order by oip.sort_order)
                  from public.offer_item_photos oip
                  where oip.offer_item_id=oi.id
                ), '[]'::jsonb)
              ) order by oi.price_cents asc, o.created_at asc
            )
            from public.offer_items oi
            join public.offers o on o.id=oi.offer_id and o.quote_id=q.id and o.status='submitted' and o.deleted_at is null
            join public.suppliers s on s.id=o.supplier_id and s.deleted_at is null and s.verification_status='verified'
            where oi.quote_item_id=qi.id
          ), '[]'::jsonb)
        ) order by qi.sort_order, qi.created_at
      )
      from public.quote_items qi
      where qi.quote_id=q.id and qi.deleted_at is null
    ), '[]'::jsonb)
  ) into v_result
  from public.quotes q
  join public.vehicles v on v.id=q.vehicle_id and v.deleted_at is null
  where q.id=p_quote_id and q.buyer_id=v_buyer_id and q.deleted_at is null;

  return v_result;
end;
$$;

revoke all on function private.list_buyer_quotes() from public, anon;
revoke all on function private.get_quote_comparison(uuid) from public, anon;
grant execute on function private.list_buyer_quotes() to authenticated;
grant execute on function private.get_quote_comparison(uuid) to authenticated;

create function public.list_buyer_quotes()
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.list_buyer_quotes(); $$;

create function public.get_quote_comparison(p_quote_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.get_quote_comparison(p_quote_id); $$;

revoke all on function public.list_buyer_quotes() from public, anon;
revoke all on function public.get_quote_comparison(uuid) from public, anon;
grant execute on function public.list_buyer_quotes() to authenticated;
grant execute on function public.get_quote_comparison(uuid) to authenticated;

create policy offer_photos_buyer_select
on storage.objects for select to authenticated
using (
  bucket_id='offer-photos'
  and exists (
    select 1
    from public.offer_item_photos oip
    join public.offer_items oi on oi.id=oip.offer_item_id
    join public.offers o on o.id=oi.offer_id and o.status='submitted' and o.deleted_at is null
    join public.quotes q on q.id=o.quote_id and q.deleted_at is null
    where oip.storage_key=storage.objects.name
      and q.buyer_id=private.current_profile_id()
  )
);
