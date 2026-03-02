import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Sale } from '../../lib/db';
import { num, pkr } from '../../lib/format';
import { useNotif } from '../../context/NotifContext';

type SaleJoined = Sale & {
  products?: { name: string } | null;
  channels?: { name: string } | null;
  cities?: { name: string } | null;
};

type Ranked = {
  name: string;
  units: number;
  revenue: number;
};

function monthKey(dateStr: string): string {
  // dateStr is YYYY-MM-DD
  return String(dateStr).slice(0, 7);
}

function drawLineChart(canvas: HTMLCanvasElement, values: number[]) {
  const css = getComputedStyle(document.documentElement);
  const gold = css.getPropertyValue('--gold').trim() || '#b8860b';
  const border = css.getPropertyValue('--border').trim() || '#e2e5eb';
  const text3 = css.getPropertyValue('--text3').trim() || '#9098ae';
  const bg = css.getPropertyValue('--surface').trim() || '#ffffff';

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  if (w <= 0) return;
  const h = 200;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 18;

  // grid
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = padT + ((h - padT - padB) * i) / gridLines;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
  }

  const max = Math.max(...values, 0);
  const safeMax = max <= 0 ? 1 : max;

  // y labels
  ctx.fillStyle = text3;
  ctx.font = '11px DM Mono, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= gridLines; i++) {
    const y = padT + ((h - padT - padB) * i) / gridLines;
    const v = Math.round(safeMax * (1 - i / gridLines));
    ctx.fillText(v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(v), padL - 8, y);
  }

  const x0 = padL;
  const x1 = w - padR;
  const y0 = h - padB;
  const y1 = padT;
  const dx = values.length <= 1 ? 0 : (x1 - x0) / (values.length - 1);

  const pts = values.map((v, i) => {
    const x = values.length <= 1 ? (x0 + x1) / 2 : x0 + i * dx;
    const y = y0 - (Number(v) / safeMax) * (y0 - y1);
    return { x, y };
  });

  if (pts.length === 0) return;

  if (pts.length === 1) {
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // line
  ctx.strokeStyle = gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  // points
  ctx.fillStyle = gold;
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function AnalyticsPage({ active }: { active: boolean }) {
  const className = useMemo(() => (active ? 'page active' : 'page'), [active]);
  const notify = useNotif();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [rows, setRows] = useState<SaleJoined[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select('*, products(name), channels(name), cities(name)')
      .eq('is_deleted', false)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      notify(error.message);
      setRows([]);
    } else {
      setRows((data as SaleJoined[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    const ch = supabase
      .channel('analytics-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => void refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paid = useMemo(() => rows.filter((r) => r.status === 'Paid'), [rows]);

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of paid) {
      const k = monthKey(s.date);
      map.set(k, (map.get(k) ?? 0) + Number(s.final_price || 0));
    }
    const keys = Array.from(map.keys()).sort();
    const values = keys.map((k) => Math.round(map.get(k) ?? 0));
    return { keys, values };
  }, [paid]);

  const rangeLabel = useMemo(() => {
    if (monthly.keys.length === 0) return '—';
    return `${monthly.keys[0]} → ${monthly.keys[monthly.keys.length - 1]}`;
  }, [monthly.keys]);

  const totalRevenue = useMemo(() => paid.reduce((a, s) => a + Number(s.final_price || 0), 0), [paid]);

  const topProducts = useMemo<Ranked[]>(() => {
    const map = new Map<string, Ranked>();
    for (const s of paid) {
      const name = s.products?.name ?? '—';
      const cur = map.get(name) ?? { name, units: 0, revenue: 0 };
      cur.units += Number(s.qty || 0);
      cur.revenue += Number(s.final_price || 0);
      map.set(name, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 3);
  }, [paid]);

  const topChannels = useMemo<Ranked[]>(() => {
    const map = new Map<string, Ranked>();
    for (const s of paid) {
      const name = s.channels?.name ?? '—';
      const cur = map.get(name) ?? { name, units: 0, revenue: 0 };
      cur.units += Number(s.qty || 0);
      cur.revenue += Number(s.final_price || 0);
      map.set(name, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 4);
  }, [paid]);

  const topCities = useMemo<Ranked[]>(() => {
    const map = new Map<string, Ranked>();
    for (const s of paid) {
      const name = s.cities?.name ?? '—';
      const cur = map.get(name) ?? { name, units: 0, revenue: 0 };
      cur.units += Number(s.qty || 0);
      cur.revenue += Number(s.final_price || 0);
      map.set(name, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 2);
  }, [paid]);

  const discountStats = useMemo(() => {
    const gross = paid.reduce((a, s) => a + Number(s.unit_price || 0) * Number(s.qty || 0), 0);
    const disc = paid.reduce((a, s) => a + Number(s.discount_amt || 0), 0);
    const discountedOrders = paid.filter((s) => Number(s.discount_pct || 0) > 0 && s.status !== 'Free').length;
    const freeOrders = rows.filter((s) => s.status === 'Free').length;
    const effective = gross > 0 ? disc / gross : 0;
    return {
      gross,
      disc,
      effective,
      discountedOrders,
      freeOrders,
    };
  }, [paid, rows]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    let raf = 0;
    const draw = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => drawLineChart(el, monthly.values));
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);

    return () => {
      ro.disconnect();
      window.cancelAnimationFrame(raf);
    };
  }, [monthly.values]);

  function exportCSV() {
    const headers = ['Month', 'Revenue (PKR)'];
    const lines = monthly.keys.map((k, i) => [k, monthly.values[i]].join(','));
    const csv = [headers.join(','), ...lines, '', `Total,${Math.round(totalRevenue)}`].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `MSK_Aesthetics_Analytics_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    notify('CSV exported successfully!');
  }

  function exportPDF() {
    const win = window.open('', '_blank');
    if (!win) return;

    const prodRows = topProducts
      .map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.units}</td><td>PKR ${Math.round(p.revenue).toLocaleString()}</td></tr>`)
      .join('');
    const chRows = topChannels
      .map((c, i) => `<tr><td>${i + 1}</td><td>${c.name}</td><td>${c.units}</td><td>PKR ${Math.round(c.revenue).toLocaleString()}</td></tr>`)
      .join('');
    const monthRows = monthly.keys
      .map((k, i) => `<tr><td>${k}</td><td>PKR ${Math.round(monthly.values[i]).toLocaleString()}</td></tr>`)
      .join('');

    win.document.write(`<!doctype html><html><head><title>Analytics Report</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:24px;}
        h1{font-size:20px;margin-bottom:4px;}
        .sub{color:#666;font-size:12px;margin-bottom:18px;}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
        .card{border:1px solid #e2e5eb;border-radius:10px;padding:14px;}
        table{width:100%;border-collapse:collapse;font-size:11px;}
        th{background:#f7f8fa;color:#555;padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;}
        td{padding:7px 8px;border-bottom:1px solid #eee;}
        .kpi{display:flex;gap:20px;margin:14px 0 18px;}
        .k{background:#f7f8fa;border:1px solid #e2e5eb;border-radius:10px;padding:10px 12px;min-width:160px;}
        .kl{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.5px;}
        .kv{font-size:18px;font-weight:bold;margin-top:3px;}
        @media print{body{padding:0;}}
      </style>
    </head><body>
      <h1>MSK Aesthetics — Analytics</h1>
      <div class="sub">Range: ${rangeLabel} · Generated: ${new Date().toLocaleString('en-PK')}</div>
      <div class="kpi">
        <div class="k"><div class="kl">Total Revenue (Paid)</div><div class="kv">PKR ${Math.round(totalRevenue).toLocaleString()}</div></div>
        <div class="k"><div class="kl">Total Discount Given</div><div class="kv">PKR ${Math.round(discountStats.disc).toLocaleString()}</div></div>
        <div class="k"><div class="kl">Effective Discount Rate</div><div class="kv">${(discountStats.effective * 100).toFixed(1)}%</div></div>
      </div>
      <div class="grid">
        <div class="card"><h3>Monthly Revenue</h3><table><thead><tr><th>Month</th><th>Revenue</th></tr></thead><tbody>${monthRows}</tbody></table></div>
        <div class="card"><h3>Top Products</h3><table><thead><tr><th>#</th><th>Product</th><th>Units</th><th>Revenue</th></tr></thead><tbody>${prodRows}</tbody></table></div>
        <div class="card"><h3>Top Channels</h3><table><thead><tr><th>#</th><th>Channel</th><th>Units</th><th>Revenue</th></tr></thead><tbody>${chRows}</tbody></table></div>
        <div class="card"><h3>Discount Summary</h3>
          <div>Total discounted orders: <b>${discountStats.discountedOrders}</b></div>
          <div>Free / complimentary: <b>${discountStats.freeOrders}</b></div>
        </div>
      </div>
      <script>window.onload=()=>window.print();</script>
    </body></html>`);
    win.document.close();
    notify('PDF report opened — use Print to save as PDF');
  }

  return (
    <div className={className} id="page-analytics">
      <div className="ph">
        <div>
          <h1>Analytics</h1>
          <p>Revenue trends, top performers &amp; insights</p>
        </div>
        <div className="export-row">
          <button className="btn-export" onClick={exportCSV} type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
          <button className="btn-export" onClick={exportPDF} type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          📈 Monthly Revenue Trend
          <span className="date-range-label">{rangeLabel}</span>
        </div>
        {loading ? (
          <div className="chart-empty">Loading…</div>
        ) : monthly.values.length === 0 ? (
          <div className="chart-empty">No sales yet</div>
        ) : (
          <div className="line-chart-wrap">
            <canvas ref={canvasRef} />
          </div>
        )}
      </div>

      <div className="top-grid">
        <div className="card">
          <div className="card-title">
            🏆 Top Products <span>Total: {pkr(totalRevenue)}</span>
          </div>
          <div className="rank-list">
            {topProducts.map((p, idx) => {
              const share = totalRevenue > 0 ? Math.round((p.revenue / totalRevenue) * 100) : 0;
              const rClass = idx === 0 ? 'r1' : idx === 1 ? 'r2' : 'r3';
              return (
                <div className="rank-item" key={p.name}>
                  <div className={`rank-num ${rClass}`}>{idx + 1}</div>
                  <div className="rank-info">
                    <div className="rank-name">{p.name}</div>
                    <div className="rank-sub">
                      {num(p.units)} units · {share}% of revenue
                    </div>
                  </div>
                  <div className="rank-val">{pkr(p.revenue)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            🔥 Top Channels <span>Total: {pkr(totalRevenue)}</span>
          </div>
          <div className="rank-list">
            {topChannels.map((c, idx) => {
              const share = totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 100) : 0;
              const rClass = idx === 0 ? 'r1' : idx === 1 ? 'r2' : idx === 2 ? 'r3' : '';
              return (
                <div className="rank-item" key={c.name}>
                  <div className={`rank-num ${rClass}`}>{idx + 1}</div>
                  <div className="rank-info">
                    <div className="rank-name">{c.name}</div>
                    <div className="rank-sub">
                      {num(c.units)} units · {share}% share
                    </div>
                  </div>
                  <div className="rank-val">{pkr(c.revenue)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="top-grid">
        <div className="card">
          <div className="card-title">
            🏙️ Top Cities
          </div>
          <div className="rank-list">
            {topCities.map((c, idx) => {
              const rClass = idx === 0 ? 'r1' : 'r2';
              return (
                <div className="rank-item" key={c.name}>
                  <div className={`rank-num ${rClass}`}>{idx + 1}</div>
                  <div className="rank-info">
                    <div className="rank-name">{c.name}</div>
                    <div className="rank-sub">{num(c.units)} units sold</div>
                  </div>
                  <div className="rank-val">{pkr(c.revenue)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-title">💳 Discount Analysis</div>
          <div className="rank-list">
            <div className="rank-item">
              <div className="rank-info">
                <div className="rank-name">Total Discount Given</div>
                <div className="rank-sub">Across all orders</div>
              </div>
              <div className="rank-val" style={{ color: 'var(--red)' }}>
                {pkr(discountStats.disc)}
              </div>
            </div>
            <div className="rank-item">
              <div className="rank-info">
                <div className="rank-name">Effective Discount Rate</div>
                <div className="rank-sub">Discount / Gross revenue</div>
              </div>
              <div className="rank-val" style={{ color: 'var(--amber)' }}>
                {(discountStats.effective * 100).toFixed(1)}%
              </div>
            </div>
            <div className="rank-item">
              <div className="rank-info">
                <div className="rank-name">Discounted Orders</div>
                <div className="rank-sub">Orders with any discount</div>
              </div>
              <div className="rank-val" style={{ color: 'var(--text2)' }}>{discountStats.discountedOrders}</div>
            </div>
            <div className="rank-item">
              <div className="rank-info">
                <div className="rank-name">Free / Complimentary</div>
                <div className="rank-sub">Orders marked as Free</div>
              </div>
              <div className="rank-val" style={{ color: 'var(--blue)' }}>{discountStats.freeOrders}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
