-- Allow authenticated app users to work with quotes/invoices
-- Fixes: "new row violates row-level security policy for table \"quotes\""

-- Ensure RLS is enabled (safe if already enabled)
alter table if exists public.quotes enable row level security;
alter table if exists public.quote_items enable row level security;

-- QUOTES policies
-- We intentionally allow any authenticated user to read/write quotes.
-- The app enforces "allowed accounts" client-side; these policies just unblock the DB.
drop policy if exists quotes_select on public.quotes;
create policy quotes_select
on public.quotes
for select
to authenticated
using (true);

drop policy if exists quotes_insert on public.quotes;
create policy quotes_insert
on public.quotes
for insert
to authenticated
with check (true);

drop policy if exists quotes_update on public.quotes;
create policy quotes_update
on public.quotes
for update
to authenticated
using (true)
with check (true);

drop policy if exists quotes_delete on public.quotes;
create policy quotes_delete
on public.quotes
for delete
to authenticated
using (true);

-- QUOTE_ITEMS policies

drop policy if exists quote_items_select on public.quote_items;
create policy quote_items_select
on public.quote_items
for select
to authenticated
using (true);

drop policy if exists quote_items_insert on public.quote_items;
create policy quote_items_insert
on public.quote_items
for insert
to authenticated
with check (true);

drop policy if exists quote_items_update on public.quote_items;
create policy quote_items_update
on public.quote_items
for update
to authenticated
using (true)
with check (true);

drop policy if exists quote_items_delete on public.quote_items;
create policy quote_items_delete
on public.quote_items
for delete
to authenticated
using (true);
