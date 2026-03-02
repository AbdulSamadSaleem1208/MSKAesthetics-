-- Quotes / invoices schema

-- Enums
do $$ begin
  create type public.quote_status as enum ('Draft', 'Sent', 'Accepted', 'Rejected');
exception
  when duplicate_object then null;
end $$;

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Quotes
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  date date not null default current_date,
  valid_until date null,
  client_name text not null,
  contact text null,
  city_id uuid null references public.cities(id),
  address text null,
  overall_discount_id uuid null references public.discounts(id),
  overall_discount_label text null,
  overall_discount_pct numeric not null default 0,
  notes text null,
  status public.quote_status not null default 'Draft',
  subtotal numeric not null default 0,
  discount_amt numeric not null default 0,
  total numeric not null default 0,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotes_discount_pct_range check (overall_discount_pct >= 0 and overall_discount_pct <= 1),
  constraint quotes_amounts_nonnegative check (subtotal >= 0 and discount_amt >= 0 and total >= 0)
);

create index if not exists quotes_date_idx on public.quotes(date desc);
create index if not exists quotes_status_idx on public.quotes(status);

drop trigger if exists quotes_set_updated_at on public.quotes;
create trigger quotes_set_updated_at
before update on public.quotes
for each row
execute function public.set_updated_at();

-- Quote items
create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid null references public.products(id),
  product_name text not null,
  qty integer not null,
  unit_price numeric not null default 0,
  line_total numeric not null default 0,
  created_at timestamptz not null default now(),
  constraint quote_items_qty_positive check (qty > 0),
  constraint quote_items_amounts_nonnegative check (unit_price >= 0 and line_total >= 0)
);

create index if not exists quote_items_quote_idx on public.quote_items(quote_id);
