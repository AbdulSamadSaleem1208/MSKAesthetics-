import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotif } from '../../context/NotifContext';
import type { Restock } from '../../lib/db';
import { todayISO } from '../../lib/format';
import { supabase } from '../../lib/supabaseClient';
import { useConfigData } from '../../state/useConfigData';

type RestockJoined = Restock & { products?: { name: string } | null };

async function logActivity(type: 'add' | 'del' | 'edit', message: string, actorId: string | null) {
  if (!actorId) return;
  try {
    await supabase.from('activity_logs').insert({ type, message, actor_id: actorId });
  } catch {
    // ignore
  }
}

export function RestockPage({ active }: { active: boolean }) {
  const className = useMemo(() => (active ? 'page active' : 'page'), [active]);
  const cfg = useConfigData();
  const notify = useNotif();
  const { user } = useAuth();

  const [rows, setRows] = useState<RestockJoined[]>([]);
  const [loading, setLoading] = useState(true);

  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(10);
  const [date, setDate] = useState(todayISO());
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase
      .from('restocks')
      .select('*, products(name)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      notify(error.message);
      setRows([]);
    } else {
      setRows((data as RestockJoined[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    const ch = supabase
      .channel('restock-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restocks' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock' }, () => void refresh())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addStock() {
    if (!productId) {
      notify('Select a product');
      return;
    }
    const q = Math.max(1, Math.round(Number(qty || 0)));
    if (!q) {
      notify('Enter units to add');
      return;
    }

    const productName = cfg.products.find((p) => p.id === productId)?.name ?? 'product';

    const { error } = await supabase.from('restocks').insert({
      date,
      product_id: productId,
      qty: q,
      supplier: supplier.trim() || null,
      notes: notes.trim() || null,
    });
    if (error) {
      notify(error.message);
      return;
    }

    await logActivity('add', `Restocked ${productName} (+${q})`, user?.id ?? null);
    notify('Stock added');
    setProductId('');
    setQty(10);
    setSupplier('');
    setNotes('');
    setDate(todayISO());
    await refresh();
  }

  return (
    <div className={className} id="page-restock">
      <div className="ph">
        <div>
          <h1>Restock</h1>
          <p>Add stock to existing products</p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '380px 1fr',
          gap: '18px',
          alignItems: 'start',
        }}
      >
        <div className="card">
          <div className="card-title">Add Stock</div>
          <div className="pw-form">
            <div className="fg">
              <label>Product</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select product…</option>
                {cfg.products
                  .filter((p) => p.is_active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="fg">
              <label>Units to add</label>
              <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value || 1))} />
            </div>
            <div className="fg">
              <label>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="fg">
              <label>Supplier / Source</label>
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier name…" />
            </div>
            <div className="fg">
              <label>Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Batch, lot, etc." />
            </div>
            <div className="btn-row" style={{ marginTop: '8px' }}>
              <button className="btn btn-primary" onClick={() => void addStock()} type="button">
                Add Stock
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Restock History</div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Units Added</th>
                  <th>Supplier</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ color: 'var(--text3)' }}>
                      Loading…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ color: 'var(--text3)', textAlign: 'center', padding: '26px' }}>
                      No restock entries yet
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.date}</td>
                      <td>{r.products?.name ?? '—'}</td>
                      <td className="mono">{r.qty}</td>
                      <td className="muted">{r.supplier ?? '—'}</td>
                      <td className="muted">{r.notes ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
