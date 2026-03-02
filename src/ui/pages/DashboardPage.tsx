import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Channel, City, Product, Sale, SaleStatus, StockRow } from '../../lib/db';
import { num, pkr, todayISO } from '../../lib/format';
import { useNotif } from '../../context/NotifContext';

type Period = 'today' | 'week' | 'month' | 'all' | 'custom';

type SaleJoined = Sale & {
  products?: { name: string } | null;
  channels?: { name: string } | null;
  cities?: { name: string } | null;
};

function statusBadge(s: SaleStatus) {
  if (s === 'Paid') return <span className="badge b-green">Paid</span>;
  if (s === 'Pending') return <span className="badge b-amber">Pending</span>;
  return <span className="badge b-blue">Free</span>;
}

function startOfWeekISO(d: Date): string {
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // days since Monday
  const out = new Date(d);
  out.setDate(d.getDate() - diff);
  return out.toISOString().slice(0, 10);
}

function monthStartISO(d: Date): string {
  const out = new Date(d.getFullYear(), d.getMonth(), 1);
  return out.toISOString().slice(0, 10);
}

function niceDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function DashboardPage({ active }: { active: boolean }) {
  const className = useMemo(() => (active ? 'page active' : 'page'), [active]);
  const notify = useNotif();

  const [products, setProducts] = useState<Product[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [sales, setSales] = useState<SaleJoined[]>([]);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<Period>('all');
  const [customFrom, setCustomFrom] = useState(todayISO());
  const [customTo, setCustomTo] = useState(todayISO());

  const range = useMemo(() => {
    const now = new Date();
    const today = todayISO();
    if (period === 'today') return { from: today, to: today, label: 'Today' };
    if (period === 'week') return { from: startOfWeekISO(now), to: today, label: 'This week' };
    if (period === 'month') return { from: monthStartISO(now), to: today, label: 'This month' };
    if (period === 'custom') {
      const from = customFrom || today;
      const to = customTo || from;
      return { from, to, label: `${from} → ${to}` };
    }
    return { from: '', to: '', label: 'All time' };
  }, [customFrom, customTo, period]);

  async function refreshConfig() {
    const [p, ch, ci, st] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('channels').select('*').order('name'),
      supabase.from('cities').select('*').order('name'),
      supabase.from('stock').select('*'),
    ]);
    if (p.error) notify(p.error.message);
    if (ch.error) notify(ch.error.message);
    if (ci.error) notify(ci.error.message);
    if (st.error) notify(st.error.message);
    setProducts((p.data as Product[]) ?? []);
    setChannels((ch.data as Channel[]) ?? []);
    setCities((ci.data as City[]) ?? []);
    setStock((st.data as StockRow[]) ?? []);
  }

  async function refreshSales() {
    setLoading(true);
    let q = supabase
      .from('sales')
      .select('*, products(name), channels(name), cities(name)')
      .eq('is_deleted', false)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (range.from) q = q.gte('date', range.from);
    if (range.to) q = q.lte('date', range.to);

    const { data, error } = await q;
    if (error) {
      // Fallback if PostgREST relationships are not defined.
      let fq = supabase
        .from('sales')
        .select('*')
        .eq('is_deleted', false)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (range.from) fq = fq.gte('date', range.from);
      if (range.to) fq = fq.lte('date', range.to);
      const fb = await fq;
      if (fb.error) {
        notify(fb.error.message);
        setSales([]);
      } else {
        setSales((fb.data as SaleJoined[]) ?? []);
      }
    } else {
      setSales((data as SaleJoined[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refreshConfig();
    void refreshSales();

    const ch = supabase
      .channel('dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void refreshConfig())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, () => void refreshConfig())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => void refreshSales())
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refreshSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const lowOutCount = useMemo(() => {
    const stockByProduct = new Map<string, StockRow>();
    for (const r of stock) stockByProduct.set(r.product_id, r);
    return products
      .filter((p) => p.is_active)
      .filter((p) => {
        const cur = Number(stockByProduct.get(p.id)?.current_qty ?? 0);
        const reorderAt = Number(p.reorder_at ?? 0);
        return cur <= 0 || cur <= reorderAt;
      }).length;
  }, [products, stock]);

  const productNameById = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);
  const channelNameById = useMemo(() => new Map(channels.map((c) => [c.id, c.name])), [channels]);
  const cityNameById = useMemo(() => new Map(cities.map((c) => [c.id, c.name])), [cities]);

  function getProductName(s: SaleJoined): string {
    return s.products?.name ?? productNameById.get(s.product_id) ?? '—';
  }

  function getChannelName(s: SaleJoined): string {
    return s.channels?.name ?? (s.channel_id ? channelNameById.get(s.channel_id) : null) ?? '—';
  }

  function getCityName(s: SaleJoined): string {
    return s.cities?.name ?? (s.city_id ? cityNameById.get(s.city_id) : null) ?? '—';
  }

  const paidSales = useMemo(() => sales.filter((s) => s.status === 'Paid'), [sales]);
  const pendingSales = useMemo(() => sales.filter((s) => s.status === 'Pending'), [sales]);
  const freeSales = useMemo(() => sales.filter((s) => s.status === 'Free'), [sales]);

  const totalRevenue = useMemo(() => paidSales.reduce((a, s) => a + Number(s.final_price || 0), 0), [paidSales]);
  const pendingAmount = useMemo(
    () => pendingSales.reduce((a, s) => a + Number(s.final_price || 0), 0),
    [pendingSales],
  );
  const unitsSold = useMemo(() => sales.reduce((a, s) => a + Number(s.qty || 0), 0), [sales]);

  const revenueByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of paidSales) {
      const name = getProductName(s);
      map.set(name, (map.get(name) ?? 0) + Number(s.final_price || 0));
    }
    const arr = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    arr.sort((a, b) => b.value - a.value);
    const max = Math.max(...arr.map((x) => x.value), 0);
    return arr.slice(0, 3).map((x) => ({ ...x, pct: max > 0 ? x.value / max : 0 }));
  }, [paidSales, productNameById]);

  const revenueByChannel = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of paidSales) {
      const name = getChannelName(s);
      map.set(name, (map.get(name) ?? 0) + Number(s.final_price || 0));
    }
    const arr = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    arr.sort((a, b) => b.value - a.value);
    const max = Math.max(...arr.map((x) => x.value), 0);
    return arr.slice(0, 4).map((x) => ({ ...x, pct: max > 0 ? x.value / max : 0 }));
  }, [paidSales, channelNameById]);

  const salesByCity = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of paidSales) {
      const name = getCityName(s);
      map.set(name, (map.get(name) ?? 0) + Number(s.final_price || 0));
    }
    const arr = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    arr.sort((a, b) => b.value - a.value);
    const max = Math.max(...arr.map((x) => x.value), 0);
    return arr.slice(0, 2).map((x) => ({ ...x, pct: max > 0 ? x.value / max : 0 }));
  }, [paidSales, cityNameById]);

  const paymentStatus = useMemo(() => {
    const totalOrders = sales.length || 1;
    const paid = { count: paidSales.length, amt: totalRevenue, pct: paidSales.length / totalOrders };
    const pending = { count: pendingSales.length, amt: pendingAmount, pct: pendingSales.length / totalOrders };
    const free = {
      count: freeSales.length,
      amt: freeSales.reduce((a, s) => a + Number(s.final_price || 0), 0),
      pct: freeSales.length / totalOrders,
    };
    return { paid, pending, free };
  }, [freeSales, paidSales, pendingAmount, pendingSales.length, sales.length, totalRevenue]);

  const nowLabel = useMemo(() => niceDate(new Date()), []);

  return (
    <div className={className} id="page-dashboard">
      <div className="ph">
        <div>
          <h1>Dashboard</h1>
          <p>Real-time overview of MSK Aesthetics inventory &amp; sales</p>
        </div>
        <div style={{ color: 'var(--text3)', fontFamily: "'DM Mono','Fira Code','Courier New',monospace", fontSize: '12px' }}>
          {nowLabel}
        </div>
      </div>

      <div className="date-filter-bar">
        <div className="filter-label">PERIOD:</div>
        <button className={period === 'today' ? 'dfbtn active' : 'dfbtn'} onClick={() => setPeriod('today')} type="button">
          Today
        </button>
        <button className={period === 'week' ? 'dfbtn active' : 'dfbtn'} onClick={() => setPeriod('week')} type="button">
          This Week
        </button>
        <button className={period === 'month' ? 'dfbtn active' : 'dfbtn'} onClick={() => setPeriod('month')} type="button">
          This Month
        </button>
        <button className={period === 'all' ? 'dfbtn active' : 'dfbtn'} onClick={() => setPeriod('all')} type="button">
          All Time
        </button>
        <button className={period === 'custom' ? 'dfbtn active' : 'dfbtn'} onClick={() => setPeriod('custom')} type="button">
          Custom
        </button>
        <div className={period === 'custom' ? 'date-custom show' : 'date-custom'}>
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <span style={{ color: 'var(--text3)' }}>to</span>
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
        <div className="date-range-label">{range.label.toLowerCase() === 'all time' ? 'All time' : range.label}</div>
      </div>

      <div className="kpi-grid">
        <div className="kpi gold">
          <div className="kpi-label">Total Revenue</div>
          <div className="kpi-val">{loading ? '—' : pkr(totalRevenue)}</div>
          <div className="kpi-sub">{paidSales.length} paid orders</div>
        </div>
        <div className="kpi green">
          <div className="kpi-label">Units Sold</div>
          <div className="kpi-val">{loading ? '—' : num(unitsSold)}</div>
          <div className="kpi-sub">Across all channels</div>
        </div>
        <div className="kpi amber">
          <div className="kpi-label">Pending</div>
          <div className="kpi-val">{loading ? '—' : pkr(pendingAmount)}</div>
          <div className="kpi-sub">{pendingSales.length} pending orders</div>
        </div>
        <div className="kpi red">
          <div className="kpi-label">Low / Out of Stock</div>
          <div className="kpi-val">{loading ? '—' : num(lowOutCount)}</div>
          <div className="kpi-sub">{lowOutCount === 0 ? 'All products OK' : 'Needs attention'}</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="card">
          <div className="card-title">Revenue by Product</div>
          {revenueByProduct.length === 0 ? (
            <div className="act-empty">No paid sales in this period</div>
          ) : (
            <div className="bar-list">
              {revenueByProduct.map((x) => (
                <div className="bar-item" key={x.name}>
                  <div className="bar-meta">
                    <div className="name">{x.name}</div>
                    <div className="val">{pkr(x.value)}</div>
                  </div>
                  <div className="prog">
                    <div className="prog-fill" style={{ width: `${Math.round(x.pct * 100)}%`, background: 'var(--gold)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Revenue by Channel</div>
          {revenueByChannel.length === 0 ? (
            <div className="act-empty">No paid sales in this period</div>
          ) : (
            <div className="bar-list">
              {revenueByChannel.map((x) => (
                <div className="bar-item" key={x.name}>
                  <div className="bar-meta">
                    <div className="name">{x.name}</div>
                    <div className="val">{pkr(x.value)}</div>
                  </div>
                  <div className="prog">
                    <div className="prog-fill" style={{ width: `${Math.round(x.pct * 100)}%`, background: 'var(--blue)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="charts-grid">
        <div className="card">
          <div className="card-title">Sales by City</div>
          {salesByCity.length === 0 ? (
            <div className="act-empty">No paid sales in this period</div>
          ) : (
            <div className="bar-list">
              {salesByCity.map((x) => (
                <div className="bar-item" key={x.name}>
                  <div className="bar-meta">
                    <div className="name">{x.name}</div>
                    <div className="val">{pkr(x.value)}</div>
                  </div>
                  <div className="prog">
                    <div className="prog-fill" style={{ width: `${Math.round(x.pct * 100)}%`, background: 'var(--green)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Payment Status</div>

          <div className="bar-list">
            <div className="bar-item">
              <div className="bar-meta" style={{ alignItems: 'center' }}>
                <div className="name" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="badge b-green">Paid</span>
                </div>
                <div className="val">
                  {paymentStatus.paid.count} orders · {pkr(paymentStatus.paid.amt)}
                </div>
              </div>
              <div className="prog">
                <div className="prog-fill" style={{ width: `${Math.round(paymentStatus.paid.pct * 100)}%`, background: 'var(--green)' }} />
              </div>
            </div>

            <div className="bar-item">
              <div className="bar-meta" style={{ alignItems: 'center' }}>
                <div className="name" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="badge b-amber">Pending</span>
                </div>
                <div className="val">
                  {paymentStatus.pending.count} orders · {pkr(paymentStatus.pending.amt)}
                </div>
              </div>
              <div className="prog">
                <div
                  className="prog-fill"
                  style={{ width: `${Math.round(paymentStatus.pending.pct * 100)}%`, background: 'var(--amber)' }}
                />
              </div>
            </div>

            <div className="bar-item">
              <div className="bar-meta" style={{ alignItems: 'center' }}>
                <div className="name" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="badge b-blue">Free</span>
                </div>
                <div className="val">
                  {paymentStatus.free.count} orders · {pkr(paymentStatus.free.amt)}
                </div>
              </div>
              <div className="prog">
                <div className="prog-fill" style={{ width: `${Math.round(paymentStatus.free.pct * 100)}%`, background: 'var(--blue)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          Recent Sales
          <span>Last 8 transactions</span>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Ref</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Channel</th>
                <th>Final (PKR)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 8).map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.date}</td>
                  <td className="mono">{s.ref}</td>
                  <td style={{ fontWeight: 600 }}>{getProductName(s)}</td>
                  <td className="mono">{num(s.qty)}</td>
                  <td>
                    <span className="badge b-gray">{getChannelName(s)}</span>
                  </td>
                  <td className="mono" style={{ color: 'var(--gold)', fontWeight: 700 }}>
                    {pkr(s.final_price)}
                  </td>
                  <td>{statusBadge(s.status)}</td>
                </tr>
              ))}
              {sales.length === 0 && !loading ? (
                <tr>
                  <td className="muted" colSpan={7}>
                    No sales found for this period
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
