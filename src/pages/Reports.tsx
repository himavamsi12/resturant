import { Download, FileBarChart, Printer, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button, Card, Empty, Input, clsx } from '../components/ui';
import { downloadCSV, fmtDate, fmtDateTime, inr, startOfDay, TAX_RATES } from '../lib/billing';
import { useStore, type Store } from '../store/useStore';
import type { Order } from '../types';

const DAY = 86400000;
const COLORS = ['#1a9157', '#2a2a2a', '#7c7c7c', '#a6a6a6', '#78d2a3', '#5e5e5e', '#cdcdcd', '#125c3a'];
const tooltipStyle = { borderRadius: 14, border: 'none', fontSize: 12, background: 'rgba(242,242,242,.95)', boxShadow: '0 20px 40px -20px rgba(0,0,0,.35)' };

type Fmt = 'text' | 'inr' | 'num' | 'pct' | 'date' | 'datetime';
type Cell = string | number;
interface Col { h: string; fmt?: Fmt }
interface Result {
  cols: Col[];
  rows: Cell[][];
  totals?: Cell[];
  chart?: { kind: 'bar' | 'line' | 'pie'; data: { name: string; value: number }[]; label: string; money?: boolean };
}
interface Ctx { all: Order[]; sales: Order[]; from: number; to: number; s: Store }
interface ReportDef { id: string; name: string; category: string; desc: string; run: (c: Ctx) => Result }

const fmtCell = (v: Cell, f: Fmt = 'text') => {
  if (typeof v !== 'number') return v;
  switch (f) {
    case 'inr': return inr(v, 2);
    case 'pct': return `${v.toFixed(1)}%`;
    case 'num': return Number.isInteger(v) ? v.toLocaleString('en-IN') : v.toFixed(2);
    case 'date': return fmtDate(v);
    case 'datetime': return fmtDateTime(v);
    default: return String(v);
  }
};

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const r2 = (n: number) => +n.toFixed(2);
const TYPE_LABEL: Record<string, string> = { 'dine-in': 'Dine-in', takeaway: 'Takeaway', delivery: 'Delivery', online: 'Online' };

function group<T>(arr: T[], key: (x: T) => string) {
  const m = new Map<string, T[]>();
  arr.forEach((x) => { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k)!.push(x); });
  return m;
}

/** Group settled orders and produce the standard sales columns. */
function salesGrouped(orders: Order[], key: (o: Order) => string, label: string): Result {
  const g = group(orders, key);
  const rows = [...g.entries()].map(([k, os]) => [k, os.length, r2(sum(os.map((o) => o.subtotal))), r2(sum(os.map((o) => o.discountAmount))), r2(sum(os.map((o) => o.tax))), r2(sum(os.map((o) => o.total))), r2(sum(os.map((o) => o.total)) / os.length)] as Cell[]);
  rows.sort((a, b) => (b[5] as number) - (a[5] as number));
  return {
    cols: [{ h: label }, { h: 'Orders', fmt: 'num' }, { h: 'Gross', fmt: 'inr' }, { h: 'Discount', fmt: 'inr' }, { h: 'Tax', fmt: 'inr' }, { h: 'Net Sales', fmt: 'inr' }, { h: 'Avg Order', fmt: 'inr' }],
    rows,
    totals: ['Total', orders.length, r2(sum(orders.map((o) => o.subtotal))), r2(sum(orders.map((o) => o.discountAmount))), r2(sum(orders.map((o) => o.tax))), r2(sum(orders.map((o) => o.total))), orders.length ? r2(sum(orders.map((o) => o.total)) / orders.length) : 0],
    chart: { kind: 'bar', label: 'Net Sales', money: true, data: rows.map((r) => ({ name: String(r[0]), value: r[5] as number })) },
  };
}

function itemLines(sales: Order[]) {
  return sales.flatMap((o) => o.items.map((l) => ({ o, l, amt: l.qty * l.unitPrice })));
}

const REPORTS: ReportDef[] = [
  // ---------- Sales ----------
  { id: 'day', name: 'Day-wise Sales Summary', category: 'Sales', desc: 'Orders, gross, discounts, tax and net sales per day.', run: ({ sales }) => {
    const r = salesGrouped(sales, (o) => String(startOfDay(o.createdAt)), 'Date');
    r.cols[0] = { h: 'Date', fmt: 'date' };
    r.rows = r.rows.map((x) => [Number(x[0]), ...x.slice(1)]).sort((a, b) => (a[0] as number) - (b[0] as number));
    r.chart = { kind: 'line', label: 'Net Sales', money: true, data: r.rows.map((x) => ({ name: fmtDate(x[0] as number).slice(0, 6), value: x[5] as number })) };
    return r;
  } },
  { id: 'hourly', name: 'Hourly / Time-slot Sales', category: 'Sales', desc: 'Sales split by hour of day and by meal time-slot.', run: ({ sales }) => {
    const slot = (h: number) => (h < 12 ? 'Breakfast (<12)' : h < 16 ? 'Lunch (12–16)' : h < 19 ? 'Evening (16–19)' : 'Dinner (19+)');
    const g = group(sales, (o) => String(new Date(o.createdAt).getHours()));
    const rows = [...g.entries()].map(([h, os]) => [`${String(h).padStart(2, '0')}:00 – ${String(+h + 1).padStart(2, '0')}:00`, slot(+h), os.length, r2(sum(os.map((o) => o.total))), r2(sum(os.map((o) => o.total)) / os.length)] as Cell[]);
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    return {
      cols: [{ h: 'Hour' }, { h: 'Time slot' }, { h: 'Orders', fmt: 'num' }, { h: 'Net Sales', fmt: 'inr' }, { h: 'Avg Order', fmt: 'inr' }],
      rows, totals: ['Total', '', sales.length, r2(sum(sales.map((o) => o.total))), ''],
      chart: { kind: 'bar', label: 'Net Sales', money: true, data: rows.map((r) => ({ name: String(r[0]).slice(0, 5), value: r[3] as number })) },
    };
  } },
  { id: 'type', name: 'Order-type wise Sales', category: 'Sales', desc: 'Dine-in vs takeaway vs delivery vs online.', run: ({ sales }) => {
    const r = salesGrouped(sales, (o) => TYPE_LABEL[o.orderType], 'Order type');
    r.chart!.kind = 'pie';
    return r;
  } },
  { id: 'platform', name: 'Platform / Source wise Sales', category: 'Sales', desc: 'POS, captain app, Swiggy, Zomato, website, kiosk, QR.', run: ({ sales }) => {
    const r = salesGrouped(sales, (o) => o.platform, 'Source');
    r.chart!.kind = 'pie';
    return r;
  } },
  { id: 'area', name: 'Area wise Sales', category: 'Sales', desc: 'Dine-in sales split by seating area.', run: ({ sales, s }) => salesGrouped(sales.filter((o) => o.orderType === 'dine-in'), (o) => s.areas.find((a) => a.id === o.areaId)?.name || 'Unassigned', 'Area') },
  { id: 'bills', name: 'Bill-wise Register', category: 'Sales', desc: 'Every bill with its full break-up.', run: ({ all, s }) => {
    const rows = [...all].filter((o) => o.status !== 'open').sort((a, b) => a.createdAt - b.createdAt).map((o) => [
      o.billNo || '-', o.createdAt, TYPE_LABEL[o.orderType], s.tables.find((t) => t.id === o.tableId)?.name || '-', o.status,
      o.subtotal, o.discountAmount, o.serviceCharge, o.tax, o.total, o.payments.map((p) => p.mode).join('+') || '-',
    ] as Cell[]);
    const settled = all.filter((o) => o.status === 'settled');
    return {
      cols: [{ h: 'Bill #' }, { h: 'Time', fmt: 'datetime' }, { h: 'Type' }, { h: 'Table' }, { h: 'Status' }, { h: 'Subtotal', fmt: 'inr' }, { h: 'Discount', fmt: 'inr' }, { h: 'Service', fmt: 'inr' }, { h: 'Tax', fmt: 'inr' }, { h: 'Total', fmt: 'inr' }, { h: 'Payment' }],
      rows,
      totals: ['Settled total', '', '', '', settled.length, r2(sum(settled.map((o) => o.subtotal))), r2(sum(settled.map((o) => o.discountAmount))), r2(sum(settled.map((o) => o.serviceCharge))), r2(sum(settled.map((o) => o.tax))), r2(sum(settled.map((o) => o.total))), ''],
    };
  } },
  { id: 'discount', name: 'Discount Report', category: 'Sales', desc: 'Bills with discounts, coupons and loyalty redemption.', run: ({ sales }) => {
    const d = sales.filter((o) => o.discountAmount > 0);
    const rows = d.map((o) => [o.billNo || '-', o.createdAt, o.discount ? (o.discount.type === 'percent' ? `${o.discount.value}%` : `₹${o.discount.value}`) : '-', o.discount?.coupon || '-', o.discount?.reason || (o.loyaltyRedeemed ? 'Loyalty redeem' : '-'), o.subtotal, o.discountAmount, o.subtotal ? r2((o.discountAmount / o.subtotal) * 100) : 0] as Cell[]);
    const reasons = group(d, (o) => o.discount?.coupon || o.discount?.reason || 'Loyalty');
    return {
      cols: [{ h: 'Bill #' }, { h: 'Time', fmt: 'datetime' }, { h: 'Discount' }, { h: 'Coupon' }, { h: 'Reason' }, { h: 'Gross', fmt: 'inr' }, { h: 'Discount Amt', fmt: 'inr' }, { h: '% of bill', fmt: 'pct' }],
      rows, totals: ['Total', `${d.length} bills`, '', '', '', r2(sum(d.map((o) => o.subtotal))), r2(sum(d.map((o) => o.discountAmount))), ''],
      chart: { kind: 'pie', label: 'Discount', money: true, data: [...reasons.entries()].map(([k, os]) => ({ name: k, value: r2(sum(os.map((o) => o.discountAmount))) })) },
    };
  } },
  { id: 'service', name: 'Service Charge Report', category: 'Sales', desc: 'Service charge collected per area.', run: ({ sales, s }) => {
    const sc = sales.filter((o) => o.serviceCharge > 0);
    const g = group(sc, (o) => s.areas.find((a) => a.id === o.areaId)?.name || '-');
    const rows = [...g.entries()].map(([k, os]) => [k, `${s.areas.find((a) => a.name === k)?.serviceCharge ?? '-'}%`, os.length, r2(sum(os.map((o) => o.subtotal - o.discountAmount))), r2(sum(os.map((o) => o.serviceCharge)))] as Cell[]);
    return {
      cols: [{ h: 'Area' }, { h: 'Rate' }, { h: 'Bills', fmt: 'num' }, { h: 'Taxable base', fmt: 'inr' }, { h: 'Service charge', fmt: 'inr' }],
      rows, totals: ['Total', '', sc.length, r2(sum(rows.map((r) => r[3] as number))), r2(sum(sc.map((o) => o.serviceCharge)))],
      chart: { kind: 'bar', label: 'Service charge', money: true, data: rows.map((r) => ({ name: String(r[0]), value: r[4] as number })) },
    };
  } },
  // ---------- Items ----------
  { id: 'items', name: 'Item-wise Sales', category: 'Items', desc: 'Quantity and revenue for every menu item.', run: ({ sales, s }) => {
    const g = group(itemLines(sales), (x) => x.l.itemId);
    const rows = [...g.entries()].map(([id, ls]) => {
      const m = s.menuItems.find((x) => x.id === id);
      return [ls[0].l.name, s.categories.find((c) => c.id === m?.categoryId)?.name || '-', sum(ls.map((x) => x.l.qty)), r2(sum(ls.map((x) => x.amt)) / sum(ls.map((x) => x.l.qty))), r2(sum(ls.map((x) => x.amt)))] as Cell[];
    }).sort((a, b) => (b[4] as number) - (a[4] as number));
    const tot = sum(rows.map((r) => r[4] as number));
    rows.forEach((r) => r.push(tot ? r2(((r[4] as number) / tot) * 100) : 0));
    return {
      cols: [{ h: 'Item' }, { h: 'Category' }, { h: 'Qty', fmt: 'num' }, { h: 'Avg price', fmt: 'inr' }, { h: 'Revenue', fmt: 'inr' }, { h: 'Share', fmt: 'pct' }],
      rows, totals: ['Total', '', sum(rows.map((r) => r[2] as number)), '', r2(tot), 100],
      chart: { kind: 'bar', label: 'Revenue', money: true, data: rows.slice(0, 15).map((r) => ({ name: String(r[0]), value: r[4] as number })) },
    };
  } },
  { id: 'category', name: 'Category-wise Sales', category: 'Items', desc: 'Revenue and quantity per menu category.', run: ({ sales, s }) => {
    const g = group(itemLines(sales), (x) => s.categories.find((c) => c.id === s.menuItems.find((m) => m.id === x.l.itemId)?.categoryId)?.name || 'Other');
    const rows = [...g.entries()].map(([k, ls]) => [k, new Set(ls.map((x) => x.l.itemId)).size, sum(ls.map((x) => x.l.qty)), r2(sum(ls.map((x) => x.amt)))] as Cell[]).sort((a, b) => (b[3] as number) - (a[3] as number));
    return {
      cols: [{ h: 'Category' }, { h: 'Items sold', fmt: 'num' }, { h: 'Qty', fmt: 'num' }, { h: 'Revenue', fmt: 'inr' }],
      rows, totals: ['Total', '', sum(rows.map((r) => r[2] as number)), r2(sum(rows.map((r) => r[3] as number)))],
      chart: { kind: 'pie', label: 'Revenue', money: true, data: rows.map((r) => ({ name: String(r[0]), value: r[3] as number })) },
    };
  } },
  { id: 'variation', name: 'Variation-wise Sales', category: 'Items', desc: 'Sales split by item variation (Half/Full, sizes…).', run: ({ sales }) => {
    const ls = itemLines(sales).filter((x) => x.l.variation);
    const g = group(ls, (x) => `${x.l.name}|${x.l.variation}`);
    const rows = [...g.entries()].map(([k, xs]) => { const [n, v] = k.split('|'); return [n, v, sum(xs.map((x) => x.l.qty)), r2(sum(xs.map((x) => x.amt)))] as Cell[]; })
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])) || (b[3] as number) - (a[3] as number));
    return {
      cols: [{ h: 'Item' }, { h: 'Variation' }, { h: 'Qty', fmt: 'num' }, { h: 'Revenue', fmt: 'inr' }],
      rows, totals: ['Total', '', sum(rows.map((r) => r[2] as number)), r2(sum(rows.map((r) => r[3] as number)))],
    };
  } },
  { id: 'topbottom', name: 'Top & Bottom Sellers', category: 'Items', desc: 'Best and worst 10 items by quantity, incl. unsold items.', run: ({ sales, s }) => {
    const qty: Record<string, number> = {};
    const rev: Record<string, number> = {};
    s.menuItems.forEach((m) => { qty[m.id] = 0; rev[m.id] = 0; });
    itemLines(sales).forEach(({ l, amt }) => { qty[l.itemId] = (qty[l.itemId] || 0) + l.qty; rev[l.itemId] = (rev[l.itemId] || 0) + amt; });
    const sorted = s.menuItems.map((m) => ({ m, q: qty[m.id] || 0, r: rev[m.id] || 0 })).sort((a, b) => b.q - a.q);
    const top = sorted.slice(0, 10).map((x, i) => ['Top', i + 1, x.m.name, x.q, r2(x.r)] as Cell[]);
    const bottom = sorted.slice(-10).reverse().map((x, i) => ['Bottom', i + 1, x.m.name, x.q, r2(x.r)] as Cell[]);
    return {
      cols: [{ h: 'Group' }, { h: 'Rank' }, { h: 'Item' }, { h: 'Qty', fmt: 'num' }, { h: 'Revenue', fmt: 'inr' }],
      rows: [...top, ...bottom],
      chart: { kind: 'bar', label: 'Qty', data: top.map((r) => ({ name: String(r[2]), value: r[3] as number })) },
    };
  } },
  // ---------- Payments ----------
  { id: 'payment', name: 'Payment Mode wise', category: 'Payments', desc: 'Collections by cash, card, UPI, wallet, due, online.', run: ({ sales }) => {
    const ps = sales.flatMap((o) => o.payments);
    const g = group(ps, (p) => p.mode);
    const tot = sum(ps.map((p) => p.amount));
    const rows = [...g.entries()].map(([k, xs]) => [k.toUpperCase(), xs.length, r2(sum(xs.map((p) => p.amount))), tot ? r2((sum(xs.map((p) => p.amount)) / tot) * 100) : 0] as Cell[]).sort((a, b) => (b[2] as number) - (a[2] as number));
    return {
      cols: [{ h: 'Mode' }, { h: 'Transactions', fmt: 'num' }, { h: 'Amount', fmt: 'inr' }, { h: 'Share', fmt: 'pct' }],
      rows, totals: ['Total', ps.length, r2(tot), 100],
      chart: { kind: 'pie', label: 'Amount', money: true, data: rows.map((r) => ({ name: String(r[0]), value: r[2] as number })) },
    };
  } },
  { id: 'daypayment', name: 'Day-wise Payment Collection', category: 'Payments', desc: 'Daily totals per payment mode.', run: ({ sales }) => {
    const modes = ['cash', 'card', 'upi', 'wallet', 'due', 'online'] as const;
    const g = group(sales, (o) => String(startOfDay(o.createdAt)));
    const rows = [...g.entries()].sort((a, b) => +a[0] - +b[0]).map(([d, os]) => {
      const ps = os.flatMap((o) => o.payments);
      return [+d, ...modes.map((m) => r2(sum(ps.filter((p) => p.mode === m).map((p) => p.amount)))), r2(sum(ps.map((p) => p.amount)))] as Cell[];
    });
    return {
      cols: [{ h: 'Date', fmt: 'date' }, ...modes.map((m) => ({ h: m.toUpperCase(), fmt: 'inr' as Fmt })), { h: 'Total', fmt: 'inr' }],
      rows, totals: ['Total', ...modes.map((_, i) => r2(sum(rows.map((r) => r[i + 1] as number)))), r2(sum(rows.map((r) => r[7] as number)))],
    };
  } },
  { id: 'due', name: 'Due / Credit Bills', category: 'Payments', desc: 'Bills settled fully or partly on due (credit).', run: ({ sales, s }) => {
    const d = sales.filter((o) => o.payments.some((p) => p.mode === 'due'));
    const rows = d.map((o) => [o.billNo || '-', o.createdAt, s.customers.find((c) => c.id === o.customerId)?.name || 'Walk-in', o.total, r2(sum(o.payments.filter((p) => p.mode === 'due').map((p) => p.amount)))] as Cell[]);
    return { cols: [{ h: 'Bill #' }, { h: 'Time', fmt: 'datetime' }, { h: 'Customer' }, { h: 'Bill total', fmt: 'inr' }, { h: 'Due amount', fmt: 'inr' }], rows, totals: ['Total', '', `${d.length} bills`, r2(sum(d.map((o) => o.total))), r2(sum(rows.map((r) => r[4] as number)))] };
  } },
  // ---------- Taxes ----------
  { id: 'gst', name: 'GST Report (CGST / SGST)', category: 'Taxes', desc: 'Taxable value and tax split by GST slab.', run: ({ sales }) => {
    const acc: Record<string, { taxable: number; tax: number; lines: number }> = {};
    sales.forEach((o) => {
      const ratio = o.subtotal ? (o.subtotal - o.discountAmount) / o.subtotal : 0;
      o.items.forEach((l) => {
        const a = (acc[l.taxGroup] ||= { taxable: 0, tax: 0, lines: 0 });
        const tv = l.qty * l.unitPrice * ratio;
        a.taxable += tv; a.tax += (tv * TAX_RATES[l.taxGroup]) / 100; a.lines++;
      });
    });
    const rows = Object.entries(acc).map(([k, a]) => [k === 'NONE' ? 'Exempt' : `GST ${TAX_RATES[k as keyof typeof TAX_RATES]}%`, a.lines, r2(a.taxable), r2(a.tax / 2), r2(a.tax / 2), r2(a.tax)] as Cell[]);
    return {
      cols: [{ h: 'Tax slab' }, { h: 'Line items', fmt: 'num' }, { h: 'Taxable value', fmt: 'inr' }, { h: 'CGST', fmt: 'inr' }, { h: 'SGST', fmt: 'inr' }, { h: 'Total GST', fmt: 'inr' }],
      rows, totals: ['Total', sum(rows.map((r) => r[1] as number)), r2(sum(rows.map((r) => r[2] as number))), r2(sum(rows.map((r) => r[3] as number))), r2(sum(rows.map((r) => r[4] as number))), r2(sum(rows.map((r) => r[5] as number)))],
      chart: { kind: 'bar', label: 'Total GST', money: true, data: rows.map((r) => ({ name: String(r[0]), value: r[5] as number })) },
    };
  } },
  { id: 'daytax', name: 'Day-wise Tax Summary', category: 'Taxes', desc: 'Daily tax liability for filing.', run: ({ sales }) => {
    const g = group(sales, (o) => String(startOfDay(o.createdAt)));
    const rows = [...g.entries()].sort((a, b) => +a[0] - +b[0]).map(([d, os]) => { const t = sum(os.map((o) => o.tax)); return [+d, os.length, r2(sum(os.map((o) => o.subtotal - o.discountAmount))), r2(t / 2), r2(t / 2), r2(t)] as Cell[]; });
    return {
      cols: [{ h: 'Date', fmt: 'date' }, { h: 'Bills', fmt: 'num' }, { h: 'Taxable', fmt: 'inr' }, { h: 'CGST', fmt: 'inr' }, { h: 'SGST', fmt: 'inr' }, { h: 'Total tax', fmt: 'inr' }],
      rows, totals: ['Total', sales.length, r2(sum(rows.map((r) => r[2] as number))), r2(sum(rows.map((r) => r[3] as number))), r2(sum(rows.map((r) => r[4] as number))), r2(sum(rows.map((r) => r[5] as number)))],
    };
  } },
  // ---------- Staff ----------
  { id: 'staff', name: 'Staff / Captain-wise Sales', category: 'Staff', desc: 'Orders and sales handled by each staff member.', run: ({ sales, s }) => {
    const r = salesGrouped(sales, (o) => { const st = s.staff.find((x) => x.id === o.staffId); return st ? `${st.name} (${st.role})` : 'Unassigned'; }, 'Staff');
    return r;
  } },
  { id: 'staffcancel', name: 'Staff Actions – Cancellations & Discounts', category: 'Staff', desc: 'Who cancelled orders or gave discounts.', run: ({ all, s }) => {
    const g = group(all.filter((o) => o.status === 'cancelled' || o.discountAmount > 0), (o) => s.staff.find((x) => x.id === o.staffId)?.name || 'Unassigned');
    const rows = [...g.entries()].map(([k, os]) => {
      const c = os.filter((o) => o.status === 'cancelled'); const d = os.filter((o) => o.status === 'settled' && o.discountAmount > 0);
      return [k, c.length, r2(sum(c.map((o) => o.total))), d.length, r2(sum(d.map((o) => o.discountAmount)))] as Cell[];
    });
    return { cols: [{ h: 'Staff' }, { h: 'Cancelled', fmt: 'num' }, { h: 'Cancelled value', fmt: 'inr' }, { h: 'Discounted bills', fmt: 'num' }, { h: 'Discount given', fmt: 'inr' }], rows };
  } },
  // ---------- Online ----------
  { id: 'aggregator', name: 'Online Orders by Aggregator', category: 'Online', desc: 'Gross, commission and net receivable per platform.', run: ({ sales }) => {
    const on = sales.filter((o) => o.orderType === 'online');
    const comm: Record<string, number> = { swiggy: 22, zomato: 20, website: 0 };
    const g = group(on, (o) => o.platform);
    const rows = [...g.entries()].map(([k, os]) => {
      const gross = sum(os.map((o) => o.total)); const base = sum(os.map((o) => o.subtotal - o.discountAmount));
      const c = (base * (comm[k] ?? 0)) / 100; const gst = c * 0.18;
      return [k, os.length, r2(gross), `${comm[k] ?? 0}%`, r2(c), r2(gst), r2(gross - c - gst)] as Cell[];
    });
    return {
      cols: [{ h: 'Platform' }, { h: 'Orders', fmt: 'num' }, { h: 'Gross', fmt: 'inr' }, { h: 'Commission %' }, { h: 'Commission', fmt: 'inr' }, { h: 'GST on comm.', fmt: 'inr' }, { h: 'Net receivable', fmt: 'inr' }],
      rows, totals: ['Total', on.length, r2(sum(rows.map((r) => r[2] as number))), '', r2(sum(rows.map((r) => r[4] as number))), r2(sum(rows.map((r) => r[5] as number))), r2(sum(rows.map((r) => r[6] as number)))],
      chart: { kind: 'pie', label: 'Gross', money: true, data: rows.map((r) => ({ name: String(r[0]), value: r[2] as number })) },
    };
  } },
  { id: 'onlinestatus', name: 'Online Order Status Log', category: 'Online', desc: 'Live aggregator orders with their current status.', run: ({ s, from, to }) => {
    const os = s.onlineOrders.filter((o) => o.createdAt >= from && o.createdAt < to);
    const rows = os.map((o) => [o.platformOrderId, o.platform, o.createdAt, o.customerName, o.status, o.paymentType, o.total] as Cell[]);
    const g = group(os, (o) => o.status);
    return {
      cols: [{ h: 'Order ID' }, { h: 'Platform' }, { h: 'Time', fmt: 'datetime' }, { h: 'Customer' }, { h: 'Status' }, { h: 'Payment' }, { h: 'Total', fmt: 'inr' }],
      rows, totals: ['Total', `${os.length} orders`, '', '', '', '', r2(sum(os.map((o) => o.total)))],
      chart: { kind: 'bar', label: 'Orders', data: [...g.entries()].map(([k, v]) => ({ name: k, value: v.length })) },
    };
  } },
  // ---------- Inventory ----------
  { id: 'consumption', name: 'Inventory Consumption', category: 'Inventory', desc: 'Raw material movement by reason (sale, wastage, purchase…).', run: ({ s, from, to }) => {
    const logs = s.stockLogs.filter((l) => l.at >= from && l.at < to);
    const g = group(logs, (l) => l.rawMaterialId);
    const reasons = ['sale', 'wastage', 'purchase', 'adjustment', 'transfer-in', 'transfer-out'] as const;
    const rows = [...g.entries()].map(([id, ls]) => {
      const rm = s.rawMaterials.find((r) => r.id === id);
      const by = reasons.map((rs) => r2(sum(ls.filter((l) => l.reason === rs).map((l) => Math.abs(l.change)))));
      return [rm?.name || id, rm?.unit || '', ...by, r2(by[0] * (rm?.costPerUnit || 0))] as Cell[];
    }).sort((a, b) => (b[8] as number) - (a[8] as number));
    return {
      cols: [{ h: 'Material' }, { h: 'Unit' }, ...reasons.map((r) => ({ h: r, fmt: 'num' as Fmt })), { h: 'Sale consumption cost', fmt: 'inr' }],
      rows, totals: ['Total', '', '', '', '', '', '', '', r2(sum(rows.map((r) => r[8] as number)))],
      chart: { kind: 'bar', label: 'Consumption cost', money: true, data: rows.slice(0, 12).map((r) => ({ name: String(r[0]), value: r[8] as number })) },
    };
  } },
  { id: 'stock', name: 'Current Stock & Valuation', category: 'Inventory', desc: 'Closing stock with value at cost.', run: ({ s }) => {
    const rows = s.rawMaterials.map((r) => [r.name, r.category, r.unit, r.stock, r.minStock, r.costPerUnit, r2(r.stock * r.costPerUnit), r.stock <= r.minStock ? 'LOW' : 'OK'] as Cell[]);
    return {
      cols: [{ h: 'Material' }, { h: 'Category' }, { h: 'Unit' }, { h: 'Stock', fmt: 'num' }, { h: 'Min', fmt: 'num' }, { h: 'Cost/unit', fmt: 'inr' }, { h: 'Value', fmt: 'inr' }, { h: 'Status' }],
      rows, totals: ['Total', '', '', '', '', '', r2(sum(rows.map((r) => r[6] as number))), ''],
    };
  } },
  { id: 'lowstock', name: 'Low Stock Report', category: 'Inventory', desc: 'Items at or below reorder level with suggested qty.', run: ({ s }) => {
    const low = s.rawMaterials.filter((r) => r.stock <= r.minStock);
    const rows = low.map((r) => [r.name, r.unit, r.stock, r.minStock, r2(r.minStock * 2 - r.stock), r2((r.minStock * 2 - r.stock) * r.costPerUnit)] as Cell[]);
    return { cols: [{ h: 'Material' }, { h: 'Unit' }, { h: 'Stock', fmt: 'num' }, { h: 'Min', fmt: 'num' }, { h: 'Suggested reorder', fmt: 'num' }, { h: 'Est. cost', fmt: 'inr' }], rows, totals: ['Total', '', '', '', '', r2(sum(rows.map((r) => r[5] as number)))] };
  } },
  { id: 'purchase', name: 'Purchase Report', category: 'Inventory', desc: 'Purchase orders by vendor with payment status.', run: ({ s, from, to }) => {
    const pos = s.purchaseOrders.filter((p) => p.createdAt >= from && p.createdAt < to);
    const rows = pos.map((p) => [p.poNo, p.createdAt, s.vendors.find((v) => v.id === p.vendorId)?.name || '-', p.items.length, p.status, p.invoiceNo || '-', p.paid ? 'Paid' : 'Unpaid', p.total] as Cell[]);
    const g = group(pos, (p) => s.vendors.find((v) => v.id === p.vendorId)?.name || '-');
    return {
      cols: [{ h: 'PO #' }, { h: 'Date', fmt: 'datetime' }, { h: 'Vendor' }, { h: 'Items', fmt: 'num' }, { h: 'Status' }, { h: 'Invoice' }, { h: 'Payment' }, { h: 'Amount', fmt: 'inr' }],
      rows, totals: ['Total', '', `${pos.length} POs`, '', '', '', `Unpaid ${inr(sum(pos.filter((p) => !p.paid && p.status !== 'cancelled').map((p) => p.total)))}`, r2(sum(pos.map((p) => p.total)))],
      chart: { kind: 'bar', label: 'Purchase', money: true, data: [...g.entries()].map(([k, ps]) => ({ name: k, value: sum(ps.map((p) => p.total)) })) },
    };
  } },
  // ---------- CRM ----------
  { id: 'customers', name: 'Top Customers', category: 'CRM', desc: 'Customers ranked by spend in the period.', run: ({ sales, s }) => {
    const g = group(sales.filter((o) => o.customerId), (o) => o.customerId!);
    const rows = [...g.entries()].map(([id, os]) => { const c = s.customers.find((x) => x.id === id); return [c?.name || id, c?.phone || '', (c?.labels || []).join(', '), os.length, r2(sum(os.map((o) => o.total))), r2(sum(os.map((o) => o.total)) / os.length), c?.points || 0] as Cell[]; })
      .sort((a, b) => (b[4] as number) - (a[4] as number));
    return {
      cols: [{ h: 'Customer' }, { h: 'Phone' }, { h: 'Labels' }, { h: 'Visits', fmt: 'num' }, { h: 'Spend', fmt: 'inr' }, { h: 'Avg bill', fmt: 'inr' }, { h: 'Points', fmt: 'num' }],
      rows, totals: ['Total', `${rows.length} customers`, '', sum(rows.map((r) => r[3] as number)), r2(sum(rows.map((r) => r[4] as number))), '', ''],
      chart: { kind: 'bar', label: 'Spend', money: true, data: rows.slice(0, 10).map((r) => ({ name: String(r[0]), value: r[4] as number })) },
    };
  } },
  { id: 'newrepeat', name: 'New vs Repeat Customers', category: 'CRM', desc: 'First-time vs returning customers in the period.', run: ({ sales, s, from }) => {
    const first: Record<string, number> = {};
    s.orders.filter((o) => o.status === 'settled' && o.customerId).forEach((o) => { first[o.customerId!] = Math.min(first[o.customerId!] ?? Infinity, o.createdAt); });
    const withC = sales.filter((o) => o.customerId);
    const isNew = (o: Order) => first[o.customerId!] >= from; // first-ever visit falls inside the period
    const newO = withC.filter(isNew); const rep = withC.filter((o) => !isNew(o)); const walk = sales.filter((o) => !o.customerId);
    const row = (n: string, os: Order[]) => [n, new Set(os.map((o) => o.customerId || o.id)).size, os.length, r2(sum(os.map((o) => o.total))), os.length ? r2(sum(os.map((o) => o.total)) / os.length) : 0] as Cell[];
    const rows = [row('New customers', newO), row('Repeat customers', rep), row('Walk-in (no details)', walk)];
    return {
      cols: [{ h: 'Segment' }, { h: 'Customers', fmt: 'num' }, { h: 'Orders', fmt: 'num' }, { h: 'Sales', fmt: 'inr' }, { h: 'Avg bill', fmt: 'inr' }],
      rows, totals: ['Total', '', sales.length, r2(sum(sales.map((o) => o.total))), ''],
      chart: { kind: 'pie', label: 'Orders', data: rows.map((r) => ({ name: String(r[0]), value: r[2] as number })) },
    };
  } },
  { id: 'feedback', name: 'Feedback Ratings Summary', category: 'CRM', desc: 'Average ratings and distribution.', run: ({ s, from, to }) => {
    const fb = s.feedbacks.filter((f) => f.at >= from && f.at < to);
    const avg = (k: 'rating' | 'food' | 'service' | 'ambience') => (fb.length ? r2(sum(fb.map((f) => f[k])) / fb.length) : 0);
    const rows = [5, 4, 3, 2, 1].map((st) => { const n = fb.filter((f) => f.rating === st).length; return [`${st} ★`, n, fb.length ? r2((n / fb.length) * 100) : 0] as Cell[]; });
    return {
      cols: [{ h: 'Rating' }, { h: 'Responses', fmt: 'num' }, { h: 'Share', fmt: 'pct' }],
      rows: [...rows, ['Avg overall', avg('rating'), ''], ['Avg food', avg('food'), ''], ['Avg service', avg('service'), ''], ['Avg ambience', avg('ambience'), '']],
      totals: ['Total', fb.length, 100],
      chart: { kind: 'bar', label: 'Responses', data: rows.map((r) => ({ name: String(r[0]), value: r[1] as number })) },
    };
  } },
  // ---------- Cancellations ----------
  { id: 'cancelled', name: 'Cancelled Orders', category: 'Cancellations', desc: 'Cancelled orders with reasons and lost value.', run: ({ all, s }) => {
    const c = all.filter((o) => o.status === 'cancelled');
    const rows = c.map((o) => [o.billNo || '-', o.createdAt, TYPE_LABEL[o.orderType], o.platform, s.staff.find((x) => x.id === o.staffId)?.name || '-', o.cancelReason || '-', o.total] as Cell[]);
    const g = group(c, (o) => o.cancelReason || 'Not specified');
    return {
      cols: [{ h: 'Bill #' }, { h: 'Time', fmt: 'datetime' }, { h: 'Type' }, { h: 'Source' }, { h: 'Staff' }, { h: 'Reason' }, { h: 'Value', fmt: 'inr' }],
      rows, totals: ['Total', `${c.length} orders`, '', '', '', '', r2(sum(c.map((o) => o.total)))],
      chart: { kind: 'pie', label: 'Orders', data: [...g.entries()].map(([k, v]) => ({ name: k, value: v.length })) },
    };
  } },
  { id: 'kotcancel', name: 'Cancelled KOTs', category: 'Cancellations', desc: 'Kitchen tickets voided after printing.', run: ({ s, from, to }) => {
    const k = s.kots.filter((x) => x.status === 'cancelled' && x.createdAt >= from && x.createdAt < to);
    const rows = k.map((x) => [x.kotNo, x.createdAt, x.tableName || x.orderType, s.stations.find((st) => st.id === x.station)?.name || x.station, x.items.map((i) => `${i.qty}× ${i.name}`).join(', ')] as Cell[]);
    return { cols: [{ h: 'KOT #' }, { h: 'Time', fmt: 'datetime' }, { h: 'Table / Token' }, { h: 'Station' }, { h: 'Items' }], rows, totals: ['Total', `${k.length} KOTs`, '', '', ''] };
  } },
  // ---------- Expenses ----------
  { id: 'expenses', name: 'Expense Report', category: 'Expenses', desc: 'Outlet expenses by category and payment mode.', run: ({ s, from, to }) => {
    const ex = s.expenses.filter((e) => e.at >= from && e.at < to);
    const rows = ex.map((e) => [e.at, e.category, e.note, e.mode.toUpperCase(), e.amount] as Cell[]);
    const g = group(ex, (e) => e.category);
    return {
      cols: [{ h: 'Date', fmt: 'datetime' }, { h: 'Category' }, { h: 'Note' }, { h: 'Mode' }, { h: 'Amount', fmt: 'inr' }],
      rows, totals: ['Total', `${ex.length} entries`, '', '', r2(sum(ex.map((e) => e.amount)))],
      chart: { kind: 'pie', label: 'Amount', money: true, data: [...g.entries()].map(([k, v]) => ({ name: k, value: sum(v.map((e) => e.amount)) })) },
    };
  } },
  { id: 'pnl', name: 'Sales vs Expenses (P&L snapshot)', category: 'Expenses', desc: 'Net sales minus food cost, purchases and expenses.', run: (c) => {
    const net = sum(c.sales.map((o) => o.total - o.tax));
    const cons = REPORTS.find((r) => r.id === 'consumption')!.run(c);
    const foodCost = (cons.totals?.[8] as number) || 0;
    const exp = sum(c.s.expenses.filter((e) => e.at >= c.from && e.at < c.to).map((e) => e.amount));
    const rows: Cell[][] = [
      ['Net sales (excl. tax)', r2(net)],
      ['Food cost (recipe consumption)', r2(-foodCost)],
      ['Gross profit', r2(net - foodCost)],
      ['Operating expenses', r2(-exp)],
      ['Operating profit', r2(net - foodCost - exp)],
      ['Food cost %', net ? `${((foodCost / net) * 100).toFixed(1)}%` : '-'],
    ];
    return { cols: [{ h: 'Line' }, { h: 'Amount', fmt: 'inr' }], rows };
  } },
];

const CATEGORIES = ['Sales', 'Items', 'Payments', 'Taxes', 'Staff', 'Online', 'Inventory', 'CRM', 'Cancellations', 'Expenses'];

const toInput = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fromInput = (v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };

export default function Reports() {
  const s = useStore();
  const [active, setActive] = useState('day');
  const [q, setQ] = useState('');
  const [fromD, setFromD] = useState(toInput(startOfDay() - 6 * DAY));
  const [toD, setToD] = useState(toInput(Date.now()));

  const from = fromInput(fromD);
  const to = fromInput(toD) + DAY;
  const def = REPORTS.find((r) => r.id === active)!;

  const preset = (k: string) => {
    const sod = startOfDay();
    if (k === 'today') { setFromD(toInput(sod)); setToD(toInput(sod)); }
    if (k === 'yesterday') { setFromD(toInput(sod - DAY)); setToD(toInput(sod - DAY)); }
    if (k === '7d') { setFromD(toInput(sod - 6 * DAY)); setToD(toInput(sod)); }
    if (k === '30d') { setFromD(toInput(sod - 29 * DAY)); setToD(toInput(sod)); }
    if (k === 'month') { const d = new Date(); setFromD(toInput(new Date(d.getFullYear(), d.getMonth(), 1).getTime())); setToD(toInput(sod)); }
  };

  const result = useMemo(() => {
    const all = s.orders.filter((o) => o.createdAt >= from && o.createdAt < to);
    return def.run({ all, sales: all.filter((o) => o.status === 'settled'), from, to, s });
  }, [def, from, to, s]);

  const filtered = REPORTS.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.category.toLowerCase().includes(q.toLowerCase()));

  const exportCsv = () => downloadCSV(`${def.id}_${fromD}_to_${toD}`, [
    [def.name, `${fromD} to ${toD}`], [],
    result.cols.map((c) => c.h),
    ...result.rows.map((r) => r.map((v, i) => (result.cols[i]?.fmt === 'date' || result.cols[i]?.fmt === 'datetime') && typeof v === 'number' ? fmtCell(v, result.cols[i].fmt) : v)),
    ...(result.totals ? [result.totals] : []),
  ]);

  return (
    <div className="flex h-full flex-col gap-4 px-4 pb-4 pt-2 sm:px-6 lg:flex-row">
      <aside className="glass flex shrink-0 flex-col rounded-3xl lg:w-72">
        <div className="p-4 pb-2">
          <div className="relative">
            <Search size={15} strokeWidth={1.6} className="absolute left-3 top-3 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${REPORTS.length} reports…`} className="pl-9" />
          </div>
        </div>
        <nav className="max-h-56 overflow-y-auto px-2.5 pb-3 lg:max-h-none lg:flex-1">
          {CATEGORIES.map((cat) => {
            const rs = filtered.filter((r) => r.category === cat);
            if (!rs.length) return null;
            return (
              <div key={cat} className="mb-2">
                <div className="px-2.5 pb-1 pt-3 text-[11px] text-slate-400">{cat}</div>
                {rs.map((r) => (
                  <button key={r.id} onClick={() => setActive(r.id)}
                    className={clsx('flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition', active === r.id ? 'bg-white/75 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]' : 'text-slate-600 hover:bg-white/45')}>
                    <FileBarChart size={14} strokeWidth={1.6} className={clsx('shrink-0', active === r.id && 'text-brand-600')} /> {r.name}
                  </button>
                ))}
              </div>
            );
          })}
          {!filtered.length && <p className="px-2 text-sm text-slate-400">No reports match.</p>}
        </nav>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto pb-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">{def.category}</div>
            <h1 className="text-[32px] font-normal leading-tight tracking-tight text-slate-900">{def.name}</h1>
            <p className="text-sm text-slate-500">{def.desc}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={exportCsv}><Download size={15} strokeWidth={1.6} /> CSV</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer size={15} strokeWidth={1.6} /> Print</Button>
          </div>
        </div>

        <div className="glass mb-4 flex flex-wrap items-center gap-2 rounded-3xl p-3">
          <Input type="date" value={fromD} max={toD} onChange={(e) => e.target.value && setFromD(e.target.value)} className="!w-auto" />
          <span className="text-sm text-slate-400">to</span>
          <Input type="date" value={toD} min={fromD} onChange={(e) => e.target.value && setToD(e.target.value)} className="!w-auto" />
          <div className="flex flex-wrap gap-1">
            {[['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['month', 'This month']].map(([k, l]) => (
              <button key={k} onClick={() => preset(k)} className="rounded-xl bg-white/50 px-3 py-2 text-xs text-slate-600 hover:bg-white/85">{l}</button>
            ))}
          </div>
        </div>

        <div className="print-area space-y-4" style={{ width: '100%' }}>
          <div className="hidden print:block">
            <h2 className="text-lg font-bold">{s.settings.restaurantName} — {def.name}</h2>
            <p className="text-xs">{fromD} to {toD}</p>
          </div>

          {result.totals && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {result.cols.map((c, i) => ({ c, v: result.totals![i] })).filter((x, i) => i > 0 && x.v !== '' && x.v !== undefined).slice(0, 4).map(({ c, v }) => (
                <div key={c.h} className="glass rounded-3xl p-5">
                  <div className="text-xs text-slate-500">{c.h}</div>
                  <div className="mt-2 text-2xl font-light tracking-tight text-slate-900">{fmtCell(v, c.fmt)}</div>
                </div>
              ))}
            </div>
          )}

          {result.chart && result.chart.data.length > 0 && (
            <Card title={result.chart.label}>
              <div className="h-64 p-3">
                <ResponsiveContainer>
                  {result.chart.kind === 'pie' ? (
                    <PieChart>
                      <Pie data={result.chart.data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={3} stroke="none"
                        label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                        {result.chart.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => (result.chart!.money ? inr(v, 2) : v)} />
                    </PieChart>
                  ) : result.chart.kind === 'line' ? (
                    <LineChart data={result.chart.data}>
                      <CartesianGrid vertical={false} stroke="rgba(0,0,0,.06)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#7c7c7c' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#7c7c7c' }} axisLine={false} tickLine={false} width={56} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => (result.chart!.money ? inr(v, 2) : v)} />
                      <Line type="monotone" dataKey="value" stroke="#1a9157" strokeWidth={2} dot={false} />
                    </LineChart>
                  ) : (
                    <BarChart data={result.chart.data}>
                      <CartesianGrid vertical={false} stroke="rgba(0,0,0,.06)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#7c7c7c' }} axisLine={false} tickLine={false} interval={0} angle={result.chart.data.length > 6 ? -30 : 0} textAnchor={result.chart.data.length > 6 ? 'end' : 'middle'} height={result.chart.data.length > 6 ? 70 : 30} />
                      <YAxis tick={{ fontSize: 11, fill: '#7c7c7c' }} axisLine={false} tickLine={false} width={56} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => (result.chart!.money ? inr(v, 2) : v)} />
                      <Bar dataKey="value" fill="#2a2a2a" radius={[8, 8, 8, 8]} maxBarSize={28} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card title={`${result.rows.length} rows`}>
            {result.rows.length === 0 ? <Empty title="No data for the selected period" hint="Try a wider date range." /> : (
              <div className="max-h-[600px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#e9e9e9]/90 backdrop-blur">
                    <tr className="border-b border-black/[.06] text-left text-xs text-slate-500">
                      {result.cols.map((c) => <th key={c.h} className={clsx('whitespace-nowrap px-4 py-3 font-normal', c.fmt && c.fmt !== 'text' && c.fmt !== 'date' && c.fmt !== 'datetime' && 'text-right')}>{c.h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r, i) => (
                      <tr key={i} className="border-b border-black/[.04] hover:bg-white/40">
                        {r.map((v, j) => {
                          const f = result.cols[j]?.fmt;
                          return <td key={j} className={clsx('whitespace-nowrap px-4 py-2.5 text-slate-700', f && f !== 'text' && f !== 'date' && f !== 'datetime' && 'text-right tabular-nums', v === 'LOW' && 'font-semibold text-red-600')}>{fmtCell(v, f)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                  {result.totals && (
                    <tfoot className="sticky bottom-0 bg-[#e9e9e9]/90 backdrop-blur">
                      <tr className="border-t border-black/[.08] font-medium">
                        {result.totals.map((v, j) => {
                          const f = result.cols[j]?.fmt;
                          return <td key={j} className={clsx('whitespace-nowrap px-4 py-3 text-slate-900', f && f !== 'text' && f !== 'date' && f !== 'datetime' && 'text-right tabular-nums')}>{v === '' ? '' : fmtCell(v, typeof v === 'number' && (f === 'date' || f === 'datetime') ? 'num' : f)}</td>;
                        })}
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}
