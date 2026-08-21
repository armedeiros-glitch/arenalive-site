create or replace function public.submit_quote(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_quote_id uuid;
  v_vehicle_id uuid;
  v_draft_id uuid;
  v_anonymous_session_id uuid;
  v_public_code text;
  v_buyer_name text;
  v_whatsapp text;
  v_supplied_email text;
  v_jwt_email text;
  v_vehicle jsonb;
  v_location jsonb;
  v_conditions jsonb;
  v_items jsonb;
  v_item jsonb;
  v_photo jsonb;
  v_item_id uuid;
  v_storage_key text;
  v_expected_prefix text;
  v_category_id uuid;
  v_expires_hours integer;
  v_latitude double precision;
  v_longitude double precision;
  v_item_count integer;
  v_photo_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  v_profile_id := private.current_profile_id();
  if v_profile_id is null then raise exception 'buyer profile not found' using errcode = 'P0001'; end if;
  if private.current_profile_role() <> 'buyer'::public.profile_role then raise exception 'buyer role required' using errcode = '42501'; end if;
  perform set_config('app.quote_submission', '1', true);
  v_quote_id := (payload->>'quote_id')::uuid;
  v_vehicle_id := (payload->>'vehicle_id')::uuid;
  v_draft_id := (payload->>'draft_id')::uuid;
  v_anonymous_session_id := (payload->>'anonymous_session_id')::uuid;
  v_buyer_name := btrim(coalesce(payload->>'buyer_name', ''));
  v_whatsapp := coalesce(payload->>'whatsapp_e164', '');
  v_supplied_email := lower(btrim(coalesce(payload->>'email', '')));
  v_jwt_email := lower(coalesce(auth.jwt()->>'email', ''));
  v_vehicle := payload->'vehicle';
  v_location := payload->'location';
  v_conditions := payload->'conditions';
  v_items := payload->'items';
  if char_length(v_buyer_name) < 2 or char_length(v_buyer_name) > 120 then raise exception 'invalid buyer name' using errcode = '22023'; end if;
  if v_whatsapp !~ '^\\+[1-9][0-9]{7,14}$' then raise exception 'invalid whatsapp' using errcode = '22023'; end if;
  if v_supplied_email = '' or v_supplied_email <> v_jwt_email then raise exception 'authenticated email mismatch' using errcode = '22023'; end if;
  if v_vehicle is null or char_length(btrim(coalesce(v_vehicle->>'brand_name', ''))) < 1 or char_length(btrim(coalesce(v_vehicle->>'model', ''))) < 1 or char_length(btrim(coalesce(v_vehicle->>'version', ''))) < 1 then raise exception 'invalid vehicle' using errcode = '22023'; end if;
  if (v_vehicle->>'year')::integer < 1950 or (v_vehicle->>'year')::integer > extract(year from current_date)::integer + 1 then raise exception 'invalid vehicle year' using errcode = '22023'; end if;
  if v_location is null or char_length(btrim(coalesce(v_location->>'city', ''))) < 2 or coalesce(v_location->>'state', '') !~ '^[A-Z]{2}$' or coalesce((v_location->>'radius_km')::integer, 0) not in (30, 60, 100) then raise exception 'invalid location' using errcode = '22023'; end if;
  if jsonb_typeof(v_conditions) <> 'array' or jsonb_array_length(v_conditions) < 1 then raise exception 'at least one condition is required' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_array_elements_text(v_conditions) c(value) where value not in ('new_original', 'new_aftermarket', 'used_original', 'reconditioned')) then raise exception 'invalid condition' using errcode = '22023'; end if;
  if jsonb_typeof(v_items) <> 'array' then raise exception 'items are required' using errcode = '22023'; end if;
  v_item_count := jsonb_array_length(v_items);
  if v_item_count < 1 or v_item_count > 25 then raise exception 'invalid item count' using errcode = '22023'; end if;
  update public.profiles set name = v_buyer_name, phone_e164 = v_whatsapp where id = v_profile_id;
  insert into public.buyer_profiles (profile_id, whatsapp_e164) values (v_profile_id, v_whatsapp)
  on conflict (profile_id) do update set whatsapp_e164 = excluded.whatsapp_e164, updated_at = now();
  insert into public.vehicles (id, buyer_id, plate_normalized, brand_name, model, year, version)
  values (v_vehicle_id, v_profile_id, nullif(upper(regexp_replace(coalesce(v_vehicle->>'plate', ''), '[^A-Za-z0-9]', '', 'g')), ''), btrim(v_vehicle->>'brand_name'), btrim(v_vehicle->>'model'), (v_vehicle->>'year')::smallint, btrim(v_vehicle->>'version'));
  v_latitude := nullif(v_location->>'latitude', '')::double precision;
  v_longitude := nullif(v_location->>'longitude', '')::double precision;
  if v_latitude is not null and (v_latitude < -90 or v_latitude > 90) then raise exception 'invalid latitude' using errcode = '22023'; end if;
  if v_longitude is not null and (v_longitude < -180 or v_longitude > 180) then raise exception 'invalid longitude' using errcode = '22023'; end if;
  v_expires_hours := private.quote_expiration_hours();
  insert into public.quotes (id, buyer_id, vehicle_id, status, city, state, location, radius_km, accepts_shipping, anonymous_session_id, draft_id, expires_at)
  values (v_quote_id, v_profile_id, v_vehicle_id, 'active'::public.quote_status, btrim(v_location->>'city'), upper(v_location->>'state'), case when v_latitude is not null and v_longitude is not null then extensions.st_setsrid(extensions.st_makepoint(v_longitude, v_latitude), 4326)::extensions.geography else null end, (v_location->>'radius_km')::smallint, coalesce((v_location->>'accepts_shipping')::boolean, false), v_anonymous_session_id, v_draft_id, now() + make_interval(hours => v_expires_hours))
  returning public_code into v_public_code;
  insert into public.quote_conditions (quote_id, condition)
  select v_quote_id, value::public.part_condition from jsonb_array_elements_text(v_conditions) c(value);
  for v_item in select value from jsonb_array_elements(v_items) loop
    v_item_id := (v_item->>'id')::uuid;
    if char_length(btrim(coalesce(v_item->>'piece_name', ''))) < 2 or char_length(btrim(coalesce(v_item->>'piece_name', ''))) > 160 then raise exception 'invalid piece name' using errcode = '22023'; end if;
    v_photo_count := coalesce(jsonb_array_length(coalesce(v_item->'photos', '[]'::jsonb)), 0);
    if v_photo_count > 3 then raise exception 'maximum 3 photos per item' using errcode = '22023'; end if;
    v_category_id := private.classify_piece_category(v_item->>'piece_name');
    insert into public.quote_items (id, quote_id, piece_name, side, notes, category_id, sort_order)
    values (v_item_id, v_quote_id, btrim(v_item->>'piece_name'), nullif(btrim(coalesce(v_item->>'side', '')), ''), nullif(btrim(coalesce(v_item->>'notes', '')), ''), v_category_id, coalesce((v_item->>'sort_order')::smallint, 0));
    v_expected_prefix := auth.uid()::text || '/' || v_quote_id::text || '/' || v_item_id::text || '/';
    for v_photo in select value from jsonb_array_elements(coalesce(v_item->'photos', '[]'::jsonb)) loop
      v_storage_key := v_photo->>'storage_key';
      if v_storage_key is null or left(v_storage_key, char_length(v_expected_prefix)) <> v_expected_prefix then raise exception 'invalid photo storage path' using errcode = '22023'; end if;
      if coalesce(v_photo->>'mime_type', '') not in ('image/jpeg', 'image/png', 'image/webp') then raise exception 'invalid photo type' using errcode = '22023'; end if;
      if (v_photo->>'size_bytes')::integer <= 0 or (v_photo->>'size_bytes')::integer > 6291456 then raise exception 'invalid photo size' using errcode = '22023'; end if;
      if not exists (select 1 from storage.objects where bucket_id = 'quote-photos' and name = v_storage_key) then raise exception 'uploaded photo not found' using errcode = '22023'; end if;
      insert into public.quote_item_photos (quote_item_id, storage_key, mime_type, size_bytes, width, height, sort_order)
      values (v_item_id, v_storage_key, v_photo->>'mime_type', (v_photo->>'size_bytes')::integer, nullif(v_photo->>'width', '')::integer, nullif(v_photo->>'height', '')::integer, coalesce((v_photo->>'sort_order')::smallint, 0));
    end loop;
  end loop;
  return jsonb_build_object('quote_id', v_quote_id, 'public_code', v_public_code);
end;
$$;
revoke all on function public.submit_quote(jsonb) from public, anon;
grant execute on function public.submit_quote(jsonb) to authenticated;