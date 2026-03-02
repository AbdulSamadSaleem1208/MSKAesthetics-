import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Product, Restock, Sale, StockRow } from '../lib/db';

export type StockComputed = {
  product: Product;
  opening: number;
  restocked: number;
  total: number;
  sold: number;
  current: number;
  reorderAt: number;
  pct: number;
  status: 'OK' | 'Low' | 'Out';
  estDaysLeft: number | null;
};

export function useStockData(products: Product[]) {
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [restocks, setRestocks] = useState<Restock[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const [st, sa, rs] = await Promise.all([
      supabase.from('stock').select('*'),
      supabase.from('sales').select('*').eq('is_deleted', false),
      supabase.from('restocks').select('*'),
    ]);

    if (!st.error && st.data) setStockRows(st.data as StockRow[]);
    if (!sa.error && sa.data) setSales(sa.data as Sale[]);
    if (!rs.error && rs.data) setRestocks(rs.data as Restock[]);

    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    const ch = supabase
      .channel('stock-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restocks' }, () => void refresh())
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computed = useMemo<StockComputed[]>(() => {
    const restockedByProduct = new Map<string, number>();
    const soldByProduct = new Map<string, number>();

    for (const r of restocks) {
      restockedByProduct.set(r.product_id, (restockedByProduct.get(r.product_id) ?? 0) + Number(r.qty || 0));
    }
    for (const s of sales) {
      soldByProduct.set(s.product_id, (soldByProduct.get(s.product_id) ?? 0) + Number(s.qty || 0));
    }

    const stockByProduct = new Map<string, StockRow>();
    for (const row of stockRows) stockByProduct.set(row.product_id, row);

    return products
      .filter((p) => p.is_active)
      .map((p) => {
        const st = stockByProduct.get(p.id);
        const opening = Number(st?.opening_qty ?? 0);
        const restocked = Number(restockedByProduct.get(p.id) ?? 0);
        const total = opening + restocked;
        const sold = Number(soldByProduct.get(p.id) ?? 0);
        const current = Number(st?.current_qty ?? Math.max(0, total - sold));
        const reorderAt = Number(p.reorder_at ?? 0);
        const pct = total > 0 ? Math.max(0, Math.min(1, current / total)) : 0;
        const status = current <= 0 ? 'Out' : current <= reorderAt ? 'Low' : 'OK';

        // rough estimate days left: average daily sold in last 30 days
        const now = new Date();
        const last30 = new Date(now);
        last30.setDate(now.getDate() - 30);
        const soldLast30 = sales
          .filter((s) => s.product_id === p.id)
          .filter((s) => new Date(s.date) >= last30)
          .reduce((a, s) => a + Number(s.qty || 0), 0);
        const avgPerDay = soldLast30 / 30;
        const estDaysLeft = avgPerDay > 0 ? Math.round(current / avgPerDay) : null;

        return {
          product: p,
          opening,
          restocked,
          total,
          sold,
          current,
          reorderAt,
          pct,
          status,
          estDaysLeft,
        };
      });
  }, [products, restocks, sales, stockRows]);

  const lowCount = computed.filter((c) => c.status !== 'OK').length;

  return { computed, lowCount, loading, refresh };
}
