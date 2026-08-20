create or replace function private.log_supplier_notified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.analytics_events(event_name,supplier_id,quote_id,opportunity_id,metadata)
  values('opportunity_created',new.supplier_id,new.quote_id,new.id,jsonb_build_object('distance_km',new.distance_km));
  return new;
end;
$$;
