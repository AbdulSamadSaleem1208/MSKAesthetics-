import { useMemo } from 'react';
import type { StockComputed } from '../../state/useStockData';
import { num } from '../../lib/format';

function stockBadge(cur: number, reorder: number) {
  if (cur <= 0) return <span className="badge b-red">Out</span>;
  if (cur <= reorder) return <span className="badge b-amber">Low</span>;
  return <span className="badge b-green">OK</span>;
}

function barColor(p: number): string {
  if (p >= 0.6) return 'var(--green)';
  if (p >= 0.25) return 'var(--amber)';
  return 'var(--red)';
}

export function StockPage({ active, rows }: { active: boolean; rows: StockComputed[] }) {
  const className = useMemo(() => (active ? 'page active' : 'page'), [active]);

  return (
    <div className={className} id="page-stock">
      <div className="ph">
        <div>
          <h1>Stock Levels</h1>
          <p>Live inventory across all products</p>
        </div>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Opening</th>
                <th>Restocked</th>
                <th>Total</th>
                <th>Sold</th>
                <th>Current</th>
                <th>Reorder At</th>
                <th style={{ minWidth: '100px' }}>Stock %</th>
                <th>Est. Days Left</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="stock-tbl">
              {rows.map((r) => (
                <tr key={r.product.id}>
                  <td>{r.product.name}</td>
                  <td className="mono">{num(r.opening)}</td>
                  <td className="mono">{num(r.restocked)}</td>
                  <td className="mono">{num(r.total)}</td>
                  <td className="mono">{num(r.sold)}</td>
                  <td className="mono">{num(r.current)}</td>
                  <td className="mono">{num(r.reorderAt)}</td>
                  <td>
                    <div className="prog">
                      <div
                        className="prog-fill"
                        style={{ width: `${Math.round(r.pct * 100)}%`, background: barColor(r.pct) }}
                      ></div>
                    </div>
                  </td>
                  <td className="mono">{r.estDaysLeft === null ? '—' : num(r.estDaysLeft)}</td>
                  <td>{stockBadge(r.current, r.reorderAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
