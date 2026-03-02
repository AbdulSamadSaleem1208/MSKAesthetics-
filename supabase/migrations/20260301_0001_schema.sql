-- MSK Aesthetics Inventory Management
-- Schema (tables, indexes, enums)

-- Extensions
create extension if not exists pgcrypto;

-- Enums
do $$ begin
  create type public.sale_status as enum ('Paid', 'Pending', 'Free');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.activity_type as enum ('add', 'del', 'edit', 'auth', 'pw');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.movement_type as enum ('sale', 'restock', 'sale_delete');
exception
  when duplicate_object then null;
end $$;

-- Core config tables
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_price numeric not null default 0,
  reorder_at integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.platforms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.discounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  pct numeric not null default 0, -- fraction (0.10 = 10%)
  created_at timestamptz not null default now(),
  constraint discounts_pct_range check (pct >= 0 and pct <= 1)
);

-- App users (for display name + optional DB role tracking)
create table if not exists public.app_users (
  id uuid primary key, -- auth.users.id
  name text not null default '',
  email text not null default '',
  role text not null default 'manager',
  created_at timestamptz not null default now(),
  constraint app_users_role check (role in ('admin', 'manager'))
);

-- Inventory snapshot per product
create table if not exists public.stock (
  product_id uuid primary key references public.products(id) on delete cascade,
  opening_qty integer not null default 0,
  current_qty integer not null default 0,
  created_at timestamptz not null default now(),
  constraint stock_nonnegative check (opening_qty >= 0 and current_qty >= 0)
);

-- Transactions
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  ref text not null,
  product_id uuid not null references public.products(id),
  qty integer not null,
  channel_id uuid null references public.channels(id),
  city_id uuid null references public.cities(id),
  platform_id uuid null references public.platforms(id),
  customer text null,
  sale_type text not null default 'Full Price',
  unit_price numeric not null default 0,
  discount_id uuid null references public.discounts(id),
  discount_label text null,
  discount_pct numeric not null default 0,
  discount_amt numeric not null default 0,
  final_price numeric not null default 0,
  status public.sale_status not null default 'Paid',
  notes text null,
  is_deleted boolean not null default false,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint sales_qty_positive check (qty > 0),
  constraint sales_discount_pct_range check (discount_pct >= 0 and discount_pct <= 1)
);

create index if not exists sales_date_idx on public.sales(date desc);
create index if not exists sales_is_deleted_idx on public.sales(is_deleted);
create index if not exists sales_product_idx on public.sales(product_id);

create table if not exists public.restocks (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  product_id uuid not null references public.products(id),
  qty integer not null,
  supplier text null,
  notes text null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint restocks_qty_positive check (qty > 0)
);

create index if not exists restocks_date_idx on public.restocks(date desc);
create index if not exists restocks_product_idx on public.restocks(product_id);

-- Auditing
create table if not exists public.stock_movements (
  id bigserial primary key,
  movement_date date not null,
  product_id uuid not null references public.products(id),
  qty_change integer not null,
  movement public.movement_type not null,
  ref text null,
  notes text null,
  actor_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_product_idx on public.stock_movements(product_id);
create index if not exists stock_movements_date_idx on public.stock_movements(movement_date desc);

create table if not exists public.activity_logs (
  id bigserial primary key,
  type public.activity_type not null,
  message text not null,
  actor_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);

-- Deleted sales log (admin-only)
create table if not exists public.sale_deletions (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid not null,
  sale_date date not null,
  ref text not null,
  product_name text not null,
  qty integer not null,
  channel_name text null,
  customer text null,
  amount numeric not null default 0
);

create index if not exists sale_deletions_deleted_at_idx on public.sale_deletions(deleted_at desc);
