import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Sale, SaleDeletion, SaleStatus } from '../../lib/db';
import { num, pkr } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useNotif } from '../../context/NotifContext';

type SaleJoined = Sale & {
  products?: { name: string } | null;
  channels?: { name: string } | null;
  cities?: { name: string } | null;
};

function statusBadge(s: SaleStatus) {
  if (s === 'Paid') return <span className="badge b-green">Paid</span>;
  if (s === 'Pending') return <span className="badge b-amber">Pending</span>;
  return <span className="badge b-gray">Free</span>;
}

export function SalesPage({ active }: { active: boolean }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const notify = useNotif();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [rows, setRows] = useState<SaleJoined[]>([]);
  const [deletions, setDeletions] = useState<SaleDeletion[]>([]);

  async function refresh() {
    const q = supabase
      .from('sales')
      .select('*, products(name), channels(name), cities(name)')
      .eq('is_deleted', false)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    const { data } = await q;
    setRows((data as SaleJoined[]) ?? []);

    if (isAdmin) {
      const { data: del } = await supabase.from('sale_deletions').select('*').order('deleted_at', { ascending: false });
      setDeletions((del as SaleDeletion[]) ?? []);
    } else {
      setDeletions([]);
    }
  }

  useEffect(() => {
    void refresh();
    const ch = supabase
      .channel('sales-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_deletions' }, () => void refresh())
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (!s) return true;
      const prod = r.products?.name ?? '';
      const ch = r.channels?.name ?? '';
      const city = r.cities?.name ?? '';
      const customer = r.customer ?? '';
      return [prod, ch, city, customer, r.ref].some((x) => String(x).toLowerCase().includes(s));
    });
  }, [rows, search, status]);

  async function deleteSale(id: string) {
    if (!isAdmin) return;
    const { error } = await supabase.from('sales').update({ is_deleted: true }).eq('id', id);
    if (error) {
      notify(error.message);
      return;
    }
    notify('Sale deleted');
  }

  async function clearDeleteLog() {
    if (!isAdmin) return;
    const { error } = await supabase.from('sale_deletions').delete().neq('id', '');
    if (error) {
      notify(error.message);
      return;
    }
    notify('Deleted sales log cleared');
  }

  function exportCSV() {
    const headers = [
      'Date',
      'Ref',
      'Product',
      'Qty',
      'Channel',
      'Sale Type',
      'City',
      'Platform',
      'Customer',
      'Unit Price',
      'Discount %',
      'Discount Amt',
      'Final Price',
      'Payment Status',
      'Notes',
    ];

    const lines = filtered.map((s) => {
      const cols = [
        s.date,
        s.ref,
        s.products?.name ?? '',
        s.qty,
        s.channels?.name ?? '',
        '',
        s.cities?.name ?? '',
        '',
        s.customer ?? '',
        s.unit_price,
        s.discount_label ?? '0%',
        s.discount_amt,
        s.final_price,
        s.status,
        s.notes ?? '',
      ];
      return cols.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const d = new Date().toISOString().split('T')[0];
    a.download = `MSK_Aesthetics_Sales_${d}.csv`;
    a.click();
    notify('CSV exported successfully!');
  }

  function exportPDF() {
    const htmlRows = filtered
      .map(
        (s) => `
    <tr>
      <td>${s.date}</td><td>${s.ref}</td><td>${(s.products?.name ?? '').replace(/</g, '&lt;')}</td><td>${s.qty}</td>
      <td>${(s.channels?.name ?? '').replace(/</g, '&lt;')}</td><td>${(s.customer ?? '—').replace(/</g, '&lt;')}</td><td>${(s.cities?.name ?? '—').replace(/</g, '&lt;')}</td>
      <td>PKR ${Number(s.unit_price).toLocaleString()}</td><td>${s.discount_label ?? '0%'}</td>
      <td><b>PKR ${Number(s.final_price).toLocaleString()}</b></td><td>${s.status}</td>
    </tr>`,
      )
      .join('');

    const totalRev = filtered.filter((s) => s.status === 'Paid').reduce((a, s) => a + Number(s.final_price || 0), 0);
    const totalUnits = filtered.reduce((a, s) => a + Number(s.qty || 0), 0);

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
    <title>MSK Aesthetics – Sales Report</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:24px;}
      h1{font-size:20px;margin-bottom:4px;} .sub{color:#666;font-size:12px;margin-bottom:20px;}
      .kpis{display:flex;gap:24px;margin-bottom:20px;}
      .kpi{background:#f5f5f5;padding:12px 18px;border-radius:8px;}
      .kpi-label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888;}
      .kpi-val{font-size:20px;font-weight:bold;margin-top:2px;}
      table{width:100%;border-collapse:collapse;font-size:11px;}
      th{background:#1f3864;color:#fff;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px;}
      td{padding:7px 10px;border-bottom:1px solid #eee;}
      tr:nth-child(even) td{background:#f9f9f9;}
      .footer{margin-top:20px;font-size:10px;color:#999;}
      @media print{body{padding:0;}}
    </style></head><body>
    <h1>MSK Aesthetics – Sales Report</h1>
    <div class="sub">Generated: ${new Date().toLocaleString('en-PK')} · Total records: ${filtered.length}</div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Total Revenue (Paid)</div><div class="kpi-val">PKR ${Number(totalRev).toLocaleString()}</div></div>
      <div class="kpi"><div class="kpi-label">Total Units Sold</div><div class="kpi-val">${totalUnits}</div></div>
      <div class="kpi"><div class="kpi-label">Total Orders</div><div class="kpi-val">${filtered.length}</div></div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Ref</th><th>Product</th><th>Qty</th><th>Channel</th><th>Customer</th><th>City</th><th>Unit Price</th><th>Disc%</th><th>Final</th><th>Status</th></tr></thead>
      <tbody>${htmlRows}</tbody>
    </table>
    <div class="footer">MSK Aesthetics Inventory Management · Confidential</div>
    <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`);
    win.document.close();
    notify('PDF report opened — use Print to save as PDF');
  }

  const className = active ? 'page active' : 'page';

  return (
    <div className={className} id="page-sales">
      <div className="ph">
        <div>
          <h1>Sales Log</h1>
          <p>All outgoing stock transactions</p>
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
      <div className="search-row">
        <input
          type="text"
          id="s-search"
          placeholder="Search product, customer, channel, ref…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select id="s-filter" value={status} onChange={(e) => setStatus(e.target.value)} style={{ minWidth: '130px' }}>
          <option value="">All statuses</option>
          <option>Paid</option>
          <option>Pending</option>
          <option>Free</option>
        </select>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Ref</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Channel</th>
                <th>Customer</th>
                <th>City</th>
                <th>Original</th>
                <th>Disc%</th>
                <th>Final</th>
                <th>Status</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="sales-tbl">
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.date}</td>
                  <td className="mono">{s.ref}</td>
                  <td>{s.products?.name ?? ''}</td>
                  <td className="mono">{num(s.qty)}</td>
                  <td>{s.channels?.name ?? ''}</td>
                  <td>{s.customer ?? ''}</td>
                  <td>{s.cities?.name ?? ''}</td>
                  <td className="mono">{pkr(Number(s.unit_price) * Number(s.qty))}</td>
                  <td className="mono">{s.discount_label ?? '0%'}</td>
                  <td className="mono">
                    <b>{pkr(s.final_price)}</b>
                  </td>
                  <td>{statusBadge(s.status)}</td>
                  <td className="muted">{s.notes ?? ''}</td>
                  <td>
                    {isAdmin ? (
                      <button className="btn btn-danger btn-sm" onClick={() => void deleteSale(s.id)} type="button">
                        Delete
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className="card"
        id="deleted-sales-card"
        style={{
          borderColor: 'rgba(192,57,43,0.25)',
          marginTop: 0,
          display: isAdmin ? '' : 'none',
        }}
      >
        <div className="card-title" style={{ color: 'var(--red)' }}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="16"
            height="16"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
          Deleted Sales Log
          <span id="del-log-count" style={{ color: 'var(--text3)', fontWeight: 400, fontSize: '12px' }}>
            {deletions.length} entries
          </span>
          <button
            className="btn btn-danger btn-sm"
            style={{ marginLeft: 'auto', fontSize: '11px' }}
            onClick={() => void clearDeleteLog()}
            type="button"
          >
            Clear Log
          </button>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ color: 'var(--red)' }}>Deleted At</th>
                <th style={{ color: 'var(--red)' }}>Deleted By</th>
                <th>Sale Date</th>
                <th>Ref</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Channel</th>
                <th>Customer</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody id="del-log-tbl">
              {deletions.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{new Date(d.deleted_at).toISOString().replace('T', ' ').slice(0, 16)}</td>
                  <td>{d.deleted_by}</td>
                  <td className="mono">{d.sale_date}</td>
                  <td className="mono">{d.ref}</td>
                  <td>{d.product_name}</td>
                  <td className="mono">{num(d.qty)}</td>
                  <td>{d.channel_name ?? ''}</td>
                  <td>{d.customer ?? ''}</td>
                  <td className="mono">{pkr(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
