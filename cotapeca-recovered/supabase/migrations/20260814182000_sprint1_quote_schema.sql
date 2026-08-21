-- CotaPeça V1 - Sprint 1: buyer + quote
-- Scope: buyer flow only. No matching, supplier opportunities, offers or WhatsApp supplier contact.

create type public.quote_status as enum ('active', 'expired', 'cancelled');
create type public.part_condition as enum (
  'new_original',
  'new_aftermarket',
  'used_original',
  'reconditioned'
);

create sequence public.quote_public_code_seq start with 1 increment by 1 no minvalue no maxvalue cache 1;

create table public.buyer_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  whatsapp_e164 text not null check (whatsapp_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger buyer_profiles_set_updated_at
before update on public.buyer_profiles
for each row execute function public.set_updated_at();

create table public.vehicle_brands (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null unique,
  normalized_name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.piece_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  key text not null unique,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.piece_category_keywords (
  id bigint generated always as identity primary key,
  category_id uuid not null references public.piece_categories(id) on delete cascade,
  keyword text not null,
  unique (category_id, keyword)
);

create table public.vehicles (
  id uuid primary key,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  plate_normalized text,
  brand_id uuid references public.vehicle_brands(id) on delete set null,
  brand_name text not null,
  model text not null,
  year smallint not null,
  version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (plate_normalized is null or plate_normalized ~ '^[A-Z0-9]{5,10}$'),
  check (char_length(brand_name) between 1 and 80),
  check (char_length(model) between 1 and 120),
  check (char_length(version) between 1 and 160),
  check (year between 1950 and 2200)
);

create index vehicles_buyer_idx on public.vehicles(buyer_id, created_at desc) where deleted_at is null;

create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

create table public.quotes (
  id uuid primary key,
  public_code text not null unique default ('CP-' || lpad(nextval('public.quote_public_code_seq')::text, 6, '0')),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  status public.quote_status not null default 'active',
  city text not null,
  state char(2) not null,
  location extensions.geography(Point, 4326),
  radius_km smallint not null check (radius_km in (30, 60, 100)),
  accepts_shipping boolean not null default false,
  anonymous_session_id uuid not null,
  draft_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  first_offer_at timestamptz,
  deleted_at timestamptz,
  check (char_length(city) between 2 and 120),
  check (state ~ '^[A-Z]{2}$'),
  unique (buyer_id, draft_id)
);

create index quotes_buyer_created_idx on public.quotes(buyer_id, created_at desc) where deleted_at is null;
create index quotes_status_expiry_idx on public.quotes(status, expires_at) where deleted_at is null;
create index quotes_location_gix on public.quotes using gist(location) where location is not null;

create table public.quote_conditions (
  quote_id uuid not null references public.quotes(id) on delete cascade,
  condition public.part_condition not null,
  created_at timestamptz not null default now(),
  primary key (quote_id, condition)
);

create table public.quote_items (
  id uuid primary key,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  piece_name text not null,
  side text,
  notes text,
  category_id uuid references public.piece_categories(id) on delete set null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (char_length(piece_name) between 2 and 160),
  check (side is null or char_length(side) <= 80),
  check (notes is null or char_length(notes) <= 800)
);

create index quote_items_quote_idx on public.quote_items(quote_id, sort_order, created_at) where deleted_at is null;

create trigger quote_items_set_updated_at
before update on public.quote_items
for each row execute function public.set_updated_at();

create table public.quote_item_photos (
  id uuid primary key default extensions.gen_random_uuid(),
  quote_item_id uuid not null references public.quote_items(id) on delete cascade,
  storage_key text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 6291456),
  width integer,
  height integer,
  sort_order smallint not null default 0 check (sort_order between 0 and 2),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index quote_item_photos_item_idx on public.quote_item_photos(quote_item_id, sort_order) where deleted_at is null;

create table public.event_ingest (
  event_name text not null check (event_name in ('quote_started', 'vehicle_added')),
  anonymous_session_id uuid not null,
  draft_id uuid not null,
  metadata jsonb not null default '{}'::jsonb
);