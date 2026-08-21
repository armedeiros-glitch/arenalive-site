-- Supplier-facing catalog access and invisible brand normalization.
insert into public.vehicle_brands(name, normalized_name) values
 ('Honda','honda'),('Toyota','toyota'),('Volkswagen','volkswagen'),('Chevrolet','chevrolet'),('Fiat','fiat'),('Ford','ford'),('Renault','renault'),('Hyundai','hyundai'),('Nissan','nissan'),('Jeep','jeep'),('BMW','bmw'),('Mercedes-Benz','mercedes-benz'),('Audi','audi'),('Mitsubishi','mitsubishi'),('Peugeot','peugeot'),('Citroën','citroen'),('Kia','kia')
on conflict (normalized_name) do nothing;

grant select on public.vehicle_brands, public.piece_categories to authenticated;
create policy vehicle_brands_authenticated_read on public.vehicle_brands for select to authenticated using(active);
create policy piece_categories_authenticated_read on public.piece_categories for select to authenticated using(active);

create or replace function private.resolve_vehicle_brand_on_insert()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  select vb.id into new.brand_id from public.vehicle_brands vb
  where vb.active and (vb.normalized_name=lower(btrim(new.brand_name)) or lower(vb.name)=lower(btrim(new.brand_name))) limit 1;
  return new;
end; $$;
revoke all on function private.resolve_vehicle_brand_on_insert() from public,anon,authenticated,service_role;
drop trigger if exists vehicles_resolve_brand on public.vehicles;
create trigger vehicles_resolve_brand before insert or update of brand_name on public.vehicles for each row execute function private.resolve_vehicle_brand_on_insert();