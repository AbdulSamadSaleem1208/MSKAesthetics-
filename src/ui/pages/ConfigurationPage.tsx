import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Channel, City, Discount, Platform, Product } from '../../lib/db';
import { useNotif } from '../../context/NotifContext';
import { num } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useConfigData } from '../../state/useConfigData';

type DraftProduct = {
  default_price: string;
  reorder_at: string;
};

function pctLabelToFraction(raw: string): { label: string; pct: number } | null {
  const s = raw.trim();
  if (!s) return null;
  const cleaned = s.replace(/%/g, '').trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.max(0, Math.min(100, n));
  const pct = clamped / 100;
  const label = clamped === 100 ? '100% (Free)' : `${clamped}%`;
  return { label, pct };
}

async function logActivity(type: 'add' | 'del' | 'edit', message: string, actorId: string | null) {
  if (!actorId) return;
  try {
    await supabase.from('activity_logs').insert({ type, message, actor_id: actorId });
  } catch {
    // ignore
  }
}

export function ConfigurationPage({ active }: { active: boolean }) {
  const className = useMemo(() => (active ? 'page active' : 'page'), [active]);
  const notify = useNotif();
  const { user } = useAuth();
  const cfg = useConfigData();

  const activeProducts = useMemo(() => cfg.products.filter((p) => p.is_active), [cfg.products]);

  const [draft, setDraft] = useState<Record<string, DraftProduct>>({});
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductReorder, setNewProductReorder] = useState('');

  const [newChannel, setNewChannel] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newPlatform, setNewPlatform] = useState('');
  const [newDiscount, setNewDiscount] = useState('');

  useEffect(() => {
    const next: Record<string, DraftProduct> = {};
    for (const p of activeProducts) {
      next[p.id] = {
        default_price: String(p.default_price ?? 0),
        reorder_at: String(p.reorder_at ?? 0),
      };
    }
    setDraft(next);
  }, [activeProducts]);

  async function updateProduct(p: Product, patch: Partial<Pick<Product, 'default_price' | 'reorder_at'>>) {
    const { error } = await supabase.from('products').update(patch).eq('id', p.id);
    if (error) {
      notify(error.message);
      return;
    }
    await logActivity('edit', `Updated product: ${p.name}`, user?.id ?? null);
  }

  async function removeProduct(p: Product) {
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', p.id);
    if (error) {
      notify(error.message);
      return;
    }
    await logActivity('del', `Removed product: ${p.name}`, user?.id ?? null);
    notify('Product removed');
  }

  async function addProduct() {
    const name = newProductName.trim();
    const price = Number(newProductPrice || 0);
    const reorder = Math.max(0, Math.round(Number(newProductReorder || 0)));
    if (!name) {
      notify('Enter a product name');
      return;
    }

    const { data, error } = await supabase
      .from('products')
      .insert({ name, default_price: price, reorder_at: reorder, is_active: true })
      .select('*')
      .single();
    if (error) {
      notify(error.message);
      return;
    }

    const pid = (data as Product).id;
    // Ensure stock row exists
    try {
      await supabase.from('stock').upsert({ product_id: pid, opening_qty: 0, current_qty: 0 }, { onConflict: 'product_id' });
    } catch {
      // ignore
    }

    await logActivity('add', `Added product: ${name}`, user?.id ?? null);
    notify('Product added');
    setNewProductName('');
    setNewProductPrice('');
    setNewProductReorder('');
  }

  async function addNamedRow(table: 'channels' | 'cities' | 'platforms', name: string) {
    const n = name.trim();
    if (!n) return;
    const { error } = await supabase.from(table).insert({ name: n });
    if (error) {
      notify(error.message);
      return;
    }
    await logActivity('add', `Added ${table.slice(0, -1)}: ${n}`, user?.id ?? null);
    notify('Added');
  }

  async function updateNamedRow(table: 'channels' | 'cities' | 'platforms', id: string, name: string) {
    const n = name.trim();
    if (!n) return;
    const { error } = await supabase.from(table).update({ name: n }).eq('id', id);
    if (error) {
      notify(error.message);
      return;
    }
    await logActivity('edit', `Updated ${table.slice(0, -1)}: ${n}`, user?.id ?? null);
  }

  async function deleteNamedRow(table: 'channels' | 'cities' | 'platforms', id: string) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      notify(error.message);
      return;
    }
    await logActivity('del', `Removed ${table.slice(0, -1)}`, user?.id ?? null);
    notify('Removed');
  }

  async function addDiscount() {
    const parsed = pctLabelToFraction(newDiscount);
    if (!parsed) {
      notify('Enter a discount like 5%');
      return;
    }
    const { error } = await supabase.from('discounts').insert({ label: parsed.label, pct: parsed.pct });
    if (error) {
      notify(error.message);
      return;
    }
    await logActivity('add', `Added discount: ${parsed.label}`, user?.id ?? null);
    notify('Discount added');
    setNewDiscount('');
  }

  async function updateDiscountRow(d: Discount, raw: string) {
    const parsed = pctLabelToFraction(raw);
    if (!parsed) return;
    const { error } = await supabase.from('discounts').update({ label: parsed.label, pct: parsed.pct }).eq('id', d.id);
    if (error) {
      notify(error.message);
      return;
    }
    await logActivity('edit', `Updated discount: ${parsed.label}`, user?.id ?? null);
  }

  async function deleteDiscountRow(id: string) {
    const { error } = await supabase.from('discounts').delete().eq('id', id);
    if (error) {
      notify(error.message);
      return;
    }
    await logActivity('del', 'Removed discount', user?.id ?? null);
    notify('Removed');
  }

  return (
    <div className={className} id="page-config">
      <div className="ph">
        <div>
          <h1>Configuration</h1>
          <p>Manage products, pricing, channels &amp; dropdown lists</p>
        </div>
      </div>

      <div className="card">
        <div className="card-title">📦 Products &amp; Prices</div>
        <div style={{ color: 'var(--text3)', fontSize: '12.5px', marginBottom: '14px' }}>
          Edit product names, default prices, and reorder levels. Changes apply everywhere immediately.
        </div>

        {cfg.loading ? (
          <div style={{ color: 'var(--text3)', fontSize: '13px' }}>Loading…</div>
        ) : (
          <>
            {activeProducts.map((p) => {
              const d = draft[p.id] ?? { default_price: String(p.default_price ?? 0), reorder_at: String(p.reorder_at ?? 0) };
              return (
                <div className="cfg-row" key={p.id}>
                  <div className="cfg-row-name">{p.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="cfg-inp-label">PKR</div>
                    <input
                      className="cfg-inp"
                      value={d.default_price}
                      onChange={(e) => setDraft((s) => ({ ...s, [p.id]: { ...d, default_price: e.target.value } }))}
                      onBlur={() => {
                        const v = Number(d.default_price || 0);
                        if (Number(v) !== Number(p.default_price)) void updateProduct(p, { default_price: v });
                      }}
                      inputMode="numeric"
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="cfg-inp-label">REORDER</div>
                    <input
                      className="cfg-inp small"
                      value={d.reorder_at}
                      onChange={(e) => setDraft((s) => ({ ...s, [p.id]: { ...d, reorder_at: e.target.value } }))}
                      onBlur={() => {
                        const v = Math.max(0, Math.round(Number(d.reorder_at || 0)));
                        if (Number(v) !== Number(p.reorder_at)) void updateProduct(p, { reorder_at: v });
                      }}
                      inputMode="numeric"
                    />
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => void removeProduct(p)} type="button">
                    Remove
                  </button>
                </div>
              );
            })}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 90px', gap: '12px', marginTop: '16px' }}>
              <div className="fg" style={{ gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.6px' }}>
                  New Product Name
                </label>
                <input
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 11px' }}
                  placeholder="e.g. Face Serum 50ml"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                />
              </div>
              <div className="fg" style={{ gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.6px' }}>
                  Price (PKR)
                </label>
                <input
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 11px' }}
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div className="fg" style={{ gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.6px' }}>
                  Reorder At
                </label>
                <input
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 11px' }}
                  value={newProductReorder}
                  onChange={(e) => setNewProductReorder(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => void addProduct()} type="button">
                  + Add
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="cfg-sections">
        <div className="card">
          <div className="card-title">📣 Sales Channels</div>
          <div className="list-editor">
            {cfg.channels.map((c: Channel) => (
              <div className="list-item" key={c.id}>
                <input defaultValue={c.name} onBlur={(e) => void updateNamedRow('channels', c.id, e.target.value)} />
                <button className="del" onClick={() => void deleteNamedRow('channels', c.id)} type="button" aria-label="Delete">
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="add-list-item">
            <input placeholder="New channel…" value={newChannel} onChange={(e) => setNewChannel(e.target.value)} />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                void addNamedRow('channels', newChannel);
                setNewChannel('');
              }}
              type="button"
            >
              + Add
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">🏙️ Cities</div>
          <div className="list-editor">
            {cfg.cities.map((c: City) => (
              <div className="list-item" key={c.id}>
                <input defaultValue={c.name} onBlur={(e) => void updateNamedRow('cities', c.id, e.target.value)} />
                <button className="del" onClick={() => void deleteNamedRow('cities', c.id)} type="button" aria-label="Delete">
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="add-list-item">
            <input placeholder="New city…" value={newCity} onChange={(e) => setNewCity(e.target.value)} />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                void addNamedRow('cities', newCity);
                setNewCity('');
              }}
              type="button"
            >
              + Add
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">🧾 Platforms</div>
          <div className="list-editor">
            {cfg.platforms.map((p: Platform) => (
              <div className="list-item" key={p.id}>
                <input defaultValue={p.name} onBlur={(e) => void updateNamedRow('platforms', p.id, e.target.value)} />
                <button className="del" onClick={() => void deleteNamedRow('platforms', p.id)} type="button" aria-label="Delete">
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="add-list-item">
            <input placeholder="New platform…" value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)} />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                void addNamedRow('platforms', newPlatform);
                setNewPlatform('');
              }}
              type="button"
            >
              + Add
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">💸 Discount Options</div>
          <div className="list-editor">
            {cfg.discounts.map((d: Discount) => (
              <div className="list-item" key={d.id}>
                <input
                  defaultValue={d.label}
                  onBlur={(e) => void updateDiscountRow(d, e.target.value)}
                />
                <div style={{ color: 'var(--text3)', fontSize: '12px', fontFamily: "'DM Mono','Fira Code','Courier New',monospace" }}>
                  → {num(Math.round(Number(d.pct || 0) * 100))}%
                </div>
                <button className="del" onClick={() => void deleteDiscountRow(d.id)} type="button" aria-label="Delete">
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="add-list-item">
            <input placeholder="e.g. 45%" value={newDiscount} onChange={(e) => setNewDiscount(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={() => void addDiscount()} type="button">
              + Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
