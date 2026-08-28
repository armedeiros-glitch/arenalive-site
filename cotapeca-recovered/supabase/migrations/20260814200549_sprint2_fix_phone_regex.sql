-- Fix E.164 validation without regex escape ambiguity.
alter table public.suppliers drop constraint suppliers_phone_e164_check;
alter table public.suppliers add constraint suppliers_phone_e164_check check (phone_e164 ~ '^[+][1-9][0-9]{7,14}$');
alter table public.suppliers drop constraint suppliers_whatsapp_e164_check;
alter table public.suppliers add constraint suppliers_whatsapp_e164_check check (whatsapp_e164 ~ '^[+][1-9][0-9]{7,14}$');