-- Keep stock levels consistent + auto audit logs
-- - On sale insert: decrement stock.current_qty + add stock_movements row
-- - On restock insert: increment stock.current_qty + add stock_movements row
-- - On sale delete (is_deleted false->true): restore stock + add stock_movements + write sale_deletions

create or replace function public.ensure_stock_row(p_product_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.stock (product_id, opening_qty, current_qty)
  values (p_product_id, 0, 0)
  on conflict (product_id) do nothing;
end;
$$;

create or replace function public.tg_sales_after_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.ensure_stock_row(new.product_id);

  update public.stock
    set current_qty = greatest(0, current_qty - new.qty)
    where product_id = new.product_id;

  insert into public.stock_movements (movement_date, product_id, qty_change, movement, ref, notes, actor_id)
  values (new.date, new.product_id, -new.qty, 'sale', new.ref, new.notes, coalesce(new.created_by, auth.uid()));

  return new;
end;
$$;

drop trigger if exists sales_after_insert_stock on public.sales;
create trigger sales_after_insert_stock
after insert on public.sales
for each row
execute function public.tg_sales_after_insert();

create or replace function public.tg_restocks_after_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.ensure_stock_row(new.product_id);

  update public.stock
    set current_qty = current_qty + new.qty
    where product_id = new.product_id;

  insert into public.stock_movements (movement_date, product_id, qty_change, movement, ref, notes, actor_id)
  values (new.date, new.product_id, new.qty, 'restock', null, new.notes, coalesce(new.created_by, auth.uid()));

  return new;
end;
$$;

drop trigger if exists restocks_after_insert_stock on public.restocks;
create trigger restocks_after_insert_stock
after insert on public.restocks
for each row
execute function public.tg_restocks_after_insert();

create or replace function public.tg_sales_after_update()
returns trigger
language plpgsql
security definer
as $$
declare
  v_prod_name text;
  v_channel_name text;
  v_deleted_by uuid;
begin
  -- Only act when is_deleted flips to true.
  if (old.is_deleted is distinct from true) and (new.is_deleted = true) then
    perform public.ensure_stock_row(old.product_id);

    update public.stock
      set current_qty = current_qty + old.qty
      where product_id = old.product_id;

    insert into public.stock_movements (movement_date, product_id, qty_change, movement, ref, notes, actor_id)
    values (old.date, old.product_id, old.qty, 'sale_delete', old.ref, old.notes, auth.uid());

    select name into v_prod_name from public.products where id = old.product_id;
    select name into v_channel_name from public.channels where id = old.channel_id;
    v_deleted_by := auth.uid();

    insert into public.sale_deletions (
      sale_id,
      deleted_by,
      sale_date,
      ref,
      product_name,
      qty,
      channel_name,
      customer,
      amount
    ) values (
      old.id,
      coalesce(v_deleted_by, old.created_by),
      old.date,
      old.ref,
      coalesce(v_prod_name, ''),
      old.qty,
      v_channel_name,
      old.customer,
      coalesce(old.final_price, 0)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists sales_after_update_stock on public.sales;
create trigger sales_after_update_stock
after update on public.sales
for each row
execute function public.tg_sales_after_update();

-- One-time reconciliation (safe to re-run)
-- Recompute current_qty from opening + restocks - non-deleted sales
update public.stock s
set current_qty = greatest(
  0,
  coalesce(s.opening_qty, 0)
  + coalesce((select sum(r.qty) from public.restocks r where r.product_id = s.product_id), 0)
  - coalesce((select sum(sa.qty) from public.sales sa where sa.product_id = s.product_id and sa.is_deleted = false), 0)
);
