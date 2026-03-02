import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Quote, QuoteItem, QuoteStatus } from '../../lib/db';
import { num, pkr, todayISO } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useNotif } from '../../context/NotifContext';
import { useConfigData } from '../../state/useConfigData';

type QuoteJoined = Quote & {
  cities?: { name: string } | null;
};

type DraftItem = {
  key: string;
  product_id: string | null;
  product_name: string;
  qty: number;
  unit_price: number;
};

function makeRef(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `Q-${y}${m}${day}-${rnd}`;
}

function statusBadge(s: QuoteStatus) {
  const cls =
    s === 'Draft' ? 'q-draft' : s === 'Sent' ? 'q-sent' : s === 'Accepted' ? 'q-accepted' : 'q-rejected';
  return <span className={`q-status-badge ${cls}`}>{s}</span>;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function QuotesPage({ active }: { active: boolean }) {
  const className = useMemo(() => (active ? 'page active' : 'page'), [active]);
  const { user } = useAuth();
  const notify = useNotif();
  const cfg = useConfigData();

  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<QuoteJoined[]>([]);
  const [search, setSearch] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [ref, setRef] = useState(makeRef());
  const [date, setDate] = useState(todayISO());
  const [validUntil, setValidUntil] = useState('');
  const [clientName, setClientName] = useState('');
  const [contact, setContact] = useState('');
  const [cityId, setCityId] = useState<string>('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<QuoteStatus>('Draft');
  const [overallDiscountId, setOverallDiscountId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([
    { key: crypto.randomUUID(), product_id: null, product_name: '', qty: 1, unit_price: 0 },
  ]);

  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfHtml, setPdfHtml] = useState('');

  const selectedDiscount = useMemo(() => {
    if (!overallDiscountId) return null;
    return cfg.discounts.find((d) => d.id === overallDiscountId) ?? null;
  }, [cfg.discounts, overallDiscountId]);

  const computed = useMemo(() => {
    const normalizedItems = items
      .map((it) => ({
        ...it,
        qty: Number(it.qty || 0),
        unit_price: Number(it.unit_price || 0),
      }))
      .filter((it) => it.product_name.trim() && it.qty > 0);
    const subtotal = normalizedItems.reduce((a, it) => a + it.qty * it.unit_price, 0);
    const discPct = Number(selectedDiscount?.pct || 0);
    const discAmt = subtotal * discPct;
    const total = subtotal - discAmt;
    return {
      normalizedItems,
      subtotal,
      discPct,
      discLabel: selectedDiscount?.label ?? null,
      discAmt,
      total,
    };
  }, [items, selectedDiscount]);

  async function refreshQuotes() {
    setLoading(true);
    const { data, error } = await supabase
      .from('quotes')
      .select('*, cities(name)')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      notify(error.message);
      setQuotes([]);
    } else {
      setQuotes((data as QuoteJoined[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void refreshQuotes();
    const ch = supabase
      .channel('quotes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => void refreshQuotes())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quote_items' }, () => void refreshQuotes())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return quotes;
    return quotes.filter((q) => {
      const hay = [q.ref, q.client_name, q.cities?.name ?? '', q.status]
        .map((x) => String(x).toLowerCase())
        .join(' ');
      return hay.includes(s);
    });
  }, [quotes, search]);

  function clearForm() {
    setEditingId(null);
    setRef(makeRef());
    setDate(todayISO());
    setValidUntil('');
    setClientName('');
    setContact('');
    setCityId('');
    setAddress('');
    setStatus('Draft');
    setOverallDiscountId('');
    setNotes('');
    setItems([{ key: crypto.randomUUID(), product_id: null, product_name: '', qty: 1, unit_price: 0 }]);
  }

  function addItem() {
    setItems((prev) => [...prev, { key: crypto.randomUUID(), product_id: null, product_name: '', qty: 1, unit_price: 0 }]);
  }

  function delItem(key: string) {
    setItems((prev) => prev.filter((x) => x.key !== key));
  }

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) =>
      prev.map((x) => {
        if (x.key !== key) return x;
        const next = { ...x, ...patch };

        const maybeName = (patch.product_name ?? next.product_name).trim();
        const match = cfg.products.find((p) => p.name.toLowerCase() === maybeName.toLowerCase());
        if (match) {
          next.product_id = match.id;
          next.product_name = match.name;
          if (patch.unit_price === undefined) next.unit_price = Number(match.default_price || 0);
        } else if (patch.product_name !== undefined) {
          next.product_id = null;
        }

        next.qty = Math.max(0, Number(next.qty || 0));
        next.unit_price = Math.max(0, Number(next.unit_price || 0));
        return next;
      }),
    );
  }

  async function loadQuote(q: QuoteJoined) {
    const { data, error } = await supabase.from('quote_items').select('*').eq('quote_id', q.id).order('created_at');
    if (error) {
      notify(error.message);
      return;
    }

    const its = ((data as QuoteItem[]) ?? []).map((it) => ({
      key: it.id,
      product_id: it.product_id,
      product_name: it.product_name,
      qty: Number(it.qty || 0),
      unit_price: Number(it.unit_price || 0),
    }));

    setEditingId(q.id);
    setRef(q.ref);
    setDate(q.date);
    setValidUntil(q.valid_until ?? '');
    setClientName(q.client_name);
    setContact(q.contact ?? '');
    setCityId(q.city_id ?? '');
    setAddress(q.address ?? '');
    setStatus(q.status);
    setOverallDiscountId(q.overall_discount_id ?? '');
    setNotes(q.notes ?? '');
    setItems(its.length ? its : [{ key: crypto.randomUUID(), product_id: null, product_name: '', qty: 1, unit_price: 0 }]);
  }

  async function saveQuote() {
    if (!user?.id) {
      notify('Please sign in');
      return;
    }
    if (!clientName.trim()) {
      notify('Client name is required');
      return;
    }
    if (computed.normalizedItems.length === 0) {
      notify('Add at least one item');
      return;
    }

    const payload = {
      ref,
      date,
      valid_until: validUntil || null,
      client_name: clientName.trim(),
      contact: contact.trim() || null,
      city_id: cityId || null,
      address: address.trim() || null,
      overall_discount_id: overallDiscountId || null,
      overall_discount_label: computed.discLabel,
      overall_discount_pct: computed.discPct,
      notes: notes.trim() || null,
      status,
      subtotal: computed.subtotal,
      discount_amt: computed.discAmt,
      total: computed.total,
    };

    if (editingId) {
      const { error: upErr } = await supabase.from('quotes').update(payload).eq('id', editingId);
      if (upErr) {
        notify(upErr.message);
        return;
      }
      const { error: delErr } = await supabase.from('quote_items').delete().eq('quote_id', editingId);
      if (delErr) {
        notify(delErr.message);
        return;
      }
      const toInsert = computed.normalizedItems.map((it) => ({
        quote_id: editingId,
        product_id: it.product_id,
        product_name: it.product_name.trim(),
        qty: it.qty,
        unit_price: it.unit_price,
        line_total: it.qty * it.unit_price,
      }));
      const { error: insErr } = await supabase.from('quote_items').insert(toInsert);
      if (insErr) {
        notify(insErr.message);
        return;
      }
      void supabase.from('activity_logs').insert({ type: 'edit', message: `Updated quote ${ref}`, actor_id: user.id });
      notify('Quote updated');
      return;
    }

    const { data: inserted, error } = await supabase.from('quotes').insert(payload).select('*').single();
    if (error) {
      notify(error.message);
      return;
    }

    const quoteId = (inserted as Quote).id;
    const toInsert = computed.normalizedItems.map((it) => ({
      quote_id: quoteId,
      product_id: it.product_id,
      product_name: it.product_name.trim(),
      qty: it.qty,
      unit_price: it.unit_price,
      line_total: it.qty * it.unit_price,
    }));
    const { error: insErr } = await supabase.from('quote_items').insert(toInsert);
    if (insErr) {
      notify(insErr.message);
      return;
    }

    void supabase.from('activity_logs').insert({ type: 'add', message: `Created quote ${ref}`, actor_id: user.id });
    notify('Quote saved');
    setEditingId(quoteId);
  }

  async function deleteQuote(id: string) {
    if (!user?.id) return;
    const q = quotes.find((x) => x.id === id);
    const { error } = await supabase.from('quotes').delete().eq('id', id);
    if (error) {
      notify(error.message);
      return;
    }
    void supabase.from('activity_logs').insert({ type: 'del', message: `Deleted quote ${q?.ref ?? ''}`.trim(), actor_id: user.id });
    if (editingId === id) clearForm();
    notify('Quote deleted');
  }

  function buildInvoiceHtml(): string {
    const cityName = cfg.cities.find((c) => c.id === cityId)?.name ?? '';
    const safeItems = computed.normalizedItems.map((it) => ({
      name: escapeHtml(it.product_name),
      qty: it.qty,
      unit: it.unit_price,
      total: it.qty * it.unit_price,
    }));

    const rows = safeItems
      .map(
        (it) => `
      <tr>
        <td>${it.name}</td>
        <td>${it.qty}</td>
        <td>PKR ${Math.round(it.unit).toLocaleString()}</td>
        <td>PKR ${Math.round(it.total).toLocaleString()}</td>
      </tr>`,
      )
      .join('');

    const discLine = computed.discPct > 0 ? `Discount (${Math.round(computed.discPct * 100)}%)` : 'Discount';

    return `
    <div class="inv-wrap">
      <div class="inv-header">
        <div>
          <div class="inv-brand">MSK <span>Aesthetics</span></div>
          <div class="inv-tagline">Quote / Invoice</div>
          ${validUntil ? `<div class="inv-validity">Valid until: ${escapeHtml(validUntil)}</div>` : ''}
        </div>
        <div class="inv-meta">
          <strong>${escapeHtml(ref)}</strong>
          Date: ${escapeHtml(date)}
        </div>
      </div>

      <hr class="inv-divider" />

      <div class="inv-parties">
        <div>
          <div class="inv-party-label">Billed To</div>
          <div class="inv-party-name">${escapeHtml(clientName || '—')}</div>
          <div class="inv-party-detail">
            ${escapeHtml(contact || '')}${contact ? '<br/>' : ''}
            ${escapeHtml(address || '')}${address ? '<br/>' : ''}
            ${escapeHtml(cityName || '')}
          </div>
        </div>
        <div>
          <div class="inv-party-label">Status</div>
          <div class="inv-party-name">${escapeHtml(status)}</div>
          <div class="inv-party-detail">Generated: ${escapeHtml(new Date().toLocaleString('en-PK'))}</div>
        </div>
      </div>

      <table class="inv-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td colspan="3">Subtotal</td><td>PKR ${Math.round(computed.subtotal).toLocaleString()}</td></tr>
          <tr><td colspan="3">${escapeHtml(discLine)}</td><td>PKR ${Math.round(computed.discAmt).toLocaleString()}</td></tr>
          <tr class="grand-total"><td colspan="3">Grand Total</td><td>PKR ${Math.round(computed.total).toLocaleString()}</td></tr>
        </tfoot>
      </table>

      ${notes.trim() ? `<div class="inv-notes"><b>Notes:</b> ${escapeHtml(notes)}</div>` : ''}

      <div class="inv-footer">
        MSK Aesthetics · Thank you for your business
      </div>
    </div>`;
  }

  function previewPDF() {
    const html = buildInvoiceHtml();
    setPdfHtml(html);
    setPdfOpen(true);
  }

  function printPDF() {
    const html = buildInvoiceHtml();
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>${escapeHtml(ref)}</title>
      <style>
        body{margin:0;background:#fff;}
        ${/* minimal subset of invoice styles for the print window */ ''}
        .inv-wrap{font-family:Georgia,'Times New Roman',serif;color:#1a1d24;padding:48px 52px;max-width:800px;margin:0 auto;background:#fff;min-height:100%;}
        .inv-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:40px;}
        .inv-brand{font-size:28px;font-weight:800;color:#b8860b;letter-spacing:-.5px;font-family:Georgia,serif;}
        .inv-brand span{color:#1a1d24;font-size:.7em;}
        .inv-tagline{font-size:11px;color:#9098ae;margin-top:3px;letter-spacing:.3px;}
        .inv-meta{text-align:right;font-size:12px;color:#5a6175;line-height:1.8;}
        .inv-meta strong{color:#1a1d24;font-size:14px;display:block;margin-bottom:2px;}
        .inv-divider{border:none;border-top:2px solid #b8860b;margin:0 0 28px;}
        .inv-parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;}
        .inv-party-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9098ae;margin-bottom:6px;}
        .inv-party-name{font-size:15px;font-weight:700;color:#1a1d24;margin-bottom:2px;}
        .inv-party-detail{font-size:12px;color:#5a6175;line-height:1.7;}
        .inv-table{width:100%;border-collapse:collapse;margin-bottom:28px;font-size:13px;}
        .inv-table thead tr{background:#b8860b;}
        .inv-table thead th{padding:10px 13px;text-align:left;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;}
        .inv-table tbody tr:nth-child(even){background:#faf8f4;}
        .inv-table tbody td{padding:10px 13px;border-bottom:1px solid #e8e4da;color:#1a1d24;vertical-align:top;}
        .inv-table tfoot td{padding:8px 13px;font-size:13px;color:#5a6175;}
        .inv-table tfoot tr.grand-total td{border-top:2px solid #b8860b;font-size:15px;font-weight:700;color:#1a1d24;padding-top:12px;}
        .inv-table tfoot tr.grand-total td:last-child{color:#b8860b;font-size:18px;}
        .inv-notes{background:#faf8f4;border-left:3px solid #b8860b;padding:12px 16px;font-size:12px;color:#5a6175;border-radius:0 6px 6px 0;margin-bottom:28px;}
        .inv-footer{text-align:center;font-size:11px;color:#9098ae;border-top:1px solid #e8e4da;padding-top:16px;line-height:1.8;}
        .inv-validity{display:inline-block;background:#fef3c7;color:#92400e;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;margin-top:10px;}
        @media print{.inv-wrap{padding:0 18px;}}
      </style>
    </head><body>${html}<script>window.onload=()=>window.print();<\/script></body></html>`);
    win.document.close();
  }

  return (
    <div className={className} id="page-quotes">
      <div className="ph">
        <div>
          <h1>Quotes / Invoices</h1>
          <p>Create and manage quotes, then export as PDF</p>
        </div>
      </div>

      <div className="quote-builder">
        <div>
          <div className="card">
            <div className="card-title">
              🧾 Quote Builder
              <span>{editingId ? 'Editing' : 'New'} · {ref}</span>
            </div>

            <div className="form-grid">
              <div className="fg">
                <label>Ref</label>
                <input value={ref} onChange={(e) => setRef(e.target.value)} />
              </div>
              <div className="fg">
                <label>Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="fg">
                <label>Valid Until</label>
                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>

              <div className="fg">
                <label>Client</label>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" />
              </div>
              <div className="fg">
                <label>Contact</label>
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone / WhatsApp" />
              </div>
              <div className="fg">
                <label>City</label>
                <select value={cityId} onChange={(e) => setCityId(e.target.value)}>
                  <option value="">Select city</option>
                  {cfg.cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="fg">
                <label>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as QuoteStatus)}>
                  <option>Draft</option>
                  <option>Sent</option>
                  <option>Accepted</option>
                  <option>Rejected</option>
                </select>
              </div>
              <div className="fg">
                <label>Overall Discount</label>
                <select value={overallDiscountId} onChange={(e) => setOverallDiscountId(e.target.value)}>
                  <option value="">No discount</option>
                  {cfg.discounts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label} ({Math.round(Number(d.pct || 0) * 100)}%)
                    </option>
                  ))}
                </select>
              </div>
              <div className="fg">
                <label>Address</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" />
              </div>

              <div className="fg full">
                <label>Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Extra notes…" rows={2} />
              </div>
            </div>

            <div className="card-title" style={{ marginTop: '18px' }}>
              🧴 Items
              <span>{num(computed.normalizedItems.length)} lines</span>
            </div>

            <datalist id="quote-products">
              {cfg.products.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>

            {items.map((it) => (
              <div className="qi-row" key={it.key}>
                <input
                  list="quote-products"
                  value={it.product_name}
                  onChange={(e) => updateItem(it.key, { product_name: e.target.value })}
                  placeholder="Product / Item name"
                />
                <input
                  type="number"
                  value={it.qty}
                  min={0}
                  onChange={(e) => updateItem(it.key, { qty: Number(e.target.value || 0) })}
                />
                <input
                  type="number"
                  value={it.unit_price}
                  min={0}
                  onChange={(e) => updateItem(it.key, { unit_price: Number(e.target.value || 0) })}
                />
                <button className="qi-del-btn" onClick={() => delItem(it.key)} type="button" title="Remove item">
                  ✕
                </button>
              </div>
            ))}

            <div className="btn-row" style={{ marginTop: '10px' }}>
              <button className="btn btn-secondary" onClick={addItem} type="button">
                + Add Item
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-title">
              Summary
              <span>{statusBadge(status)}</span>
            </div>
            <div className="quote-total-box">
              <div className="row">
                <div>Subtotal</div>
                <div className="val">{pkr(computed.subtotal)}</div>
              </div>
              <div className="row">
                <div>
                  Discount {computed.discPct > 0 ? `(${Math.round(computed.discPct * 100)}%)` : ''}
                </div>
                <div className="val">{pkr(computed.discAmt)}</div>
              </div>
              <div className="row total">
                <div>Total</div>
                <div className="val">{pkr(computed.total)}</div>
              </div>
            </div>

            <div className="btn-row">
              <button className="btn btn-primary" onClick={() => void saveQuote()} type="button">
                {editingId ? 'Update Quote' : 'Save Quote'}
              </button>
              <button className="btn btn-secondary" onClick={previewPDF} type="button">
                Preview PDF
              </button>
              <button className="btn btn-secondary" onClick={clearForm} type="button">
                New
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              Recent Quotes
              <span>{loading ? 'Loading…' : `${filtered.length}`}</span>
            </div>
            <div className="search-row">
              <input
                type="text"
                placeholder="Search ref, client, city, status…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 20).map((q) => (
                    <tr key={q.id}>
                      <td className="mono">{q.ref}</td>
                      <td>
                        {q.client_name}
                        <div className="muted">{q.cities?.name ?? '—'}</div>
                      </td>
                      <td className="mono">{q.date}</td>
                      <td className="mono">{pkr(q.total)}</td>
                      <td>{statusBadge(q.status)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => void loadQuote(q)} type="button">
                          Open
                        </button>{' '}
                        <button className="btn btn-danger btn-sm" onClick={() => void deleteQuote(q.id)} type="button">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && !loading ? (
                    <tr>
                      <td className="muted" colSpan={6}>
                        No quotes yet
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div id="pdf-overlay" className={pdfOpen ? 'show' : ''} onClick={() => setPdfOpen(false)}>
        <div id="pdf-modal" onClick={(e) => e.stopPropagation()}>
          <div id="pdf-modal-header">
            <h3>Invoice Preview</h3>
            <div id="pdf-modal-actions">
              <button className="btn btn-secondary" onClick={printPDF} type="button">
                Print / Save PDF
              </button>
              <button className="btn btn-secondary" onClick={() => setPdfOpen(false)} type="button">
                Close
              </button>
            </div>
          </div>
          <div id="pdf-frame">
            <div dangerouslySetInnerHTML={{ __html: pdfHtml }} />
          </div>
        </div>
      </div>
    </div>
  );
}
