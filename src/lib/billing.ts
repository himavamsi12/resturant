import type { CartItem, Order } from '../types';

export const TAX_RATES: Record<CartItem['taxGroup'], number> = { GST5: 5, GST12: 12, GST18: 18, NONE: 0 };

export const lineTotal = (l: CartItem) => l.unitPrice * l.qty;

type TotalsInput = Pick<Order, 'items' | 'discount' | 'loyaltyRedeemed' | 'deliveryCharge' | 'packagingCharge'>;

/**
 * Bill math: subtotal → discount (pro-rated across lines so tax is on the discounted value)
 * → service charge → GST per line tax group → round off.
 */
export function computeTotals(o: TotalsInput, serviceChargePct = 0, roundOff = true) {
  const subtotal = o.items.reduce((s, l) => s + lineTotal(l), 0);
  let discountAmount = 0;
  if (o.discount && subtotal > 0) {
    discountAmount = o.discount.type === 'percent' ? (subtotal * o.discount.value) / 100 : Math.min(o.discount.value, subtotal);
  }
  discountAmount += Math.min(o.loyaltyRedeemed || 0, subtotal - discountAmount);
  const ratio = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 0;
  const tax = o.items.reduce((s, l) => s + (lineTotal(l) * ratio * TAX_RATES[l.taxGroup]) / 100, 0);
  const serviceCharge = ((subtotal - discountAmount) * serviceChargePct) / 100;
  const raw = subtotal - discountAmount + serviceCharge + tax + (o.deliveryCharge || 0) + (o.packagingCharge || 0);
  const total = roundOff ? Math.round(raw) : +raw.toFixed(2);
  return {
    subtotal: +subtotal.toFixed(2),
    discountAmount: +discountAmount.toFixed(2),
    serviceCharge: +serviceCharge.toFixed(2),
    tax: +tax.toFixed(2),
    roundOff: +(total - raw).toFixed(2),
    total,
  };
}

export const inr = (n: number, decimals = 0) =>
  '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

export const fmtTime = (t: number) => new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
export const fmtDate = (t: number) => new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
export const fmtDateTime = (t: number) => `${fmtDate(t)}, ${fmtTime(t)}`;

export const minsAgo = (t: number) => {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m ago` : `${Math.floor(h / 24)}d ago`;
};

export const startOfDay = (t = Date.now()) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}
