alter table public.profiles
  drop constraint if exists profiles_phone_e164_check;

alter table public.profiles
  add constraint profiles_phone_e164_check
  check (phone_e164 is null or phone_e164 ~ '^[+][1-9][0-9]{7,14}$');

alter table public.buyer_profiles
  drop constraint if exists buyer_profiles_whatsapp_e164_check;

alter table public.buyer_profiles
  add constraint buyer_profiles_whatsapp_e164_check
  check (whatsapp_e164 ~ '^[+][1-9][0-9]{7,14}$');
