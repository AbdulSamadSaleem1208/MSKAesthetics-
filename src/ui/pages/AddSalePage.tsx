import { useEffect, useMemo, useState } from 'react';
import type { Channel, City, Discount, Platform, Product } from '../../lib/db';
import { num, todayISO } from '../../lib/format';
import { supabase } from '../../lib/supabaseClient';
import { useNotif } from '../../context/NotifContext';

export function AddSalePage({
  active,
  products,
  channels,
  cities,
  platforms,
  discounts,
}: {
  active: boolean;
  products: Product[];
  channels: Channel[];
  cities: City[];
  platforms: Platform[];
  discounts: Discount[];
}) {
  const notify = useNotif();

  const [date, setDate] = useState(todayISO());
  const [ref, setRef] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState(1);
  const [channelId, setChannelId] = useState('');
  const [saleType, setSaleType] = useState('Full Price');
  const [cityId, setCityId] = useState('');
  const [platformId, setPlatformId] = useState('');
  const [customer, setCustomer] = useState('');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [discountId, setDiscountId] = useState<string>('');
  const [status, setStatus] = useState<'Paid' | 'Pending' | 'Free'>('Paid');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!productId) return;
    const p = products.find((x) => x.id === productId);
    if (p) setUnitPrice(Number(p.default_price || 0));
  }, [productId, products]);

  const discount = useMemo(() => {
    const d = discounts.find((x) => x.id === discountId);
    if (d) return d;
    const zero = discounts.find((x) => Number(x.pct) === 0);
    return zero ?? null;
  }, [discountId, discounts]);

  const discPct = Number(discount?.pct ?? 0);
  const discLabel = discount?.label ?? '0%';

  const subtotal = useMemo(() => {
    return Math.round(Number(unitPrice || 0) * Number(qty || 0));
  }, [qty, unitPrice]);

  const isFree = status === 'Free' || saleType.toLowerCase().includes('free');

  const discAmt = useMemo(() => {
    if (isFree) return subtotal;
    return Math.round(subtotal * discPct);
  }, [discPct, isFree, subtotal]);

  const finalPrice = useMemo(() => {
    if (isFree) return 0;
    return Math.round(subtotal * (1 - discPct));
  }, [discPct, isFree, subtotal]);

  async function nextRef(): Promise<string> {
    const { count } = await supabase.from('sales').select('id', { count: 'exact', head: true });
    const n = (count ?? 0) + 1;
    return 'ORD-' + String(n).padStart(3, '0');
  }

  async function addSale() {
    if (!date || !productId || !qty) {
      notify('Please fill Date, Product, and Qty');
      return;
    }

    const { data: stockRow } = await supabase.from('stock').select('current_qty').eq('product_id', productId).maybeSingle();
    const avail = Number(stockRow?.current_qty ?? 0);
    if (qty > avail) {
      const p = products.find((x) => x.id === productId);
      notify(`Only ${avail} units available for ${p?.name ?? 'this product'}`);
      return;
    }

    const saleRef = ref || (await nextRef());

    const insertRow: Record<string, unknown> = {
      date,
      ref: saleRef,
      product_id: productId,
      qty,
      channel_id: channelId || null,
      sale_type: saleType,
      city_id: cityId || null,
      platform_id: platformId || null,
      customer: customer || null,
      unit_price: unitPrice,
      discount_id: isFree ? null : discountId || null,
      discount_label: isFree ? '100%' : discLabel,
      discount_pct: isFree ? 1 : discPct,
      discount_amt: discAmt,
      final_price: finalPrice,
      status: isFree ? 'Free' : status,
      notes: notes || null,
    };

    const { error } = await supabase.from('sales').insert(insertRow);

    if (error) {
      notify(error.message);
      return;
    }

    notify('Sale recorded!');
    reset();
  }

  function reset() {
    setRef('');
    setCustomer('');
    setNotes('');
    setUnitPrice(0);
    setProductId('');
    setChannelId('');
    setCityId('');
    setPlatformId('');
    setQty(1);
    setDiscountId(discounts.find((d) => Number(d.pct) === 0)?.id ?? '');
    setStatus('Paid');
    setDate(todayISO());
  }

  const className = active ? 'page active' : 'page';

  return (
    <div className={className} id="page-add-sale">
      <div className="ph">
        <div>
          <h1>Add Sale</h1>
          <p>Record a new outgoing stock transaction</p>
        </div>
      </div>
      <div className="card">
        <div className="form-grid">
          <div className="fg">
            <label>Date</label>
            <input type="date" id="as-date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="fg">
            <label>Order / Ref #</label>
            <input
              type="text"
              id="as-ref"
              placeholder="Auto-generated"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            />
          </div>
          <div className="fg">
            <label>Product</label>
            <select id="as-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Select product…</option>
              {products
                .filter((p) => p.is_active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="fg">
            <label>Quantity</label>
            <input
              type="number"
              id="as-qty"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value || 1))}
            />
          </div>
          <div className="fg">
            <label>Channel</label>
            <select id="as-channel" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              <option value="">Select channel…</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Sale Type</label>
            <select id="as-type" value={saleType} onChange={(e) => setSaleType(e.target.value)}>
              <option>Full Price</option>
              <option>Percentage Discount</option>
              <option>Free / Complimentary</option>
            </select>
          </div>
          <div className="fg">
            <label>City</label>
            <select id="as-city" value={cityId} onChange={(e) => setCityId(e.target.value)}>
              <option value="">Select city…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Platform</label>
            <select id="as-platform" value={platformId} onChange={(e) => setPlatformId(e.target.value)}>
              <option value="">Select platform…</option>
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Customer / Recipient</label>
            <input
              type="text"
              id="as-customer"
              placeholder="Name or handle"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            />
          </div>
          <div className="fg">
            <label>Unit Price (PKR)</label>
            <input
              type="number"
              id="as-price"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value || 0))}
            />
          </div>
          <div className="fg">
            <label>Discount %</label>
            <select id="as-disc" value={discountId} onChange={(e) => setDiscountId(e.target.value)}>
              {discounts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Payment Status</label>
            <select id="as-status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option>Paid</option>
              <option>Pending</option>
              <option>Free</option>
            </select>
          </div>
          <div className="fg full">
            <label>Notes</label>
            <input
              type="text"
              id="as-notes"
              placeholder="Optional notes, tracking info…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="price-preview">
            <div className="lbl">Final Price (PKR)</div>
            <div className="val" id="as-final">
              {num(finalPrice)}
            </div>
          </div>
          <div className="price-preview red">
            <div className="lbl">
              Discount Amount
            </div>
            <div className="val" id="as-disc-amt">
              {num(discAmt)}
            </div>
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={() => void addSale()} type="button">
            Record Sale
          </button>
          <button className="btn btn-secondary" onClick={reset} type="button">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
