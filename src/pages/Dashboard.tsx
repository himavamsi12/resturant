import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Ban, ChefHat, IndianRupee, LayoutGrid, MapPin,
  Maximize2, MessageCircle, Mic, Paperclip, Percent, Receipt, Send, ShoppingBag, Tag, Truck, X, Zap,
  CreditCard, Smartphone, Banknote, CircleDot, Contact, NotebookPen, PieChart as PieIcon, ShieldCheck, SquarePercent, Triangle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Badge, Button, Card, Empty, Pills, clsx, squareCls } from '../components/ui';
import { fmtTime, inr, minsAgo, startOfDay } from '../lib/billing';
import { useStore } from '../store/useStore';
import { photoFadeStyle } from '../components/RestaurantPhoto';
import type { Order } from '../types';

const DAY = 86400000;
const CHART_COLORS = ['#1a9157', '#2a2a2a', '#7c7c7c', '#a6a6a6', '#78d2a3', '#5e5e5e', '#cdcdcd', '#125c3a'];

type RangeKey = 'today' | 'yesterday' | '7d' | '30d';

function getRange(k: RangeKey): { from: number; to: number; prevFrom: number; prevTo: number } {
  const sod = startOfDay();
  const now = Date.now();
  switch (k) {
    case 'today': return { from: sod, to: now, prevFrom: sod - DAY, prevTo: now - DAY };
    case 'yesterday': return { from: sod - DAY, to: sod, prevFrom: sod - 2 * DAY, prevTo: sod - DAY };
    case '7d': return { from: sod - 6 * DAY, to: now, prevFrom: sod - 13 * DAY, prevTo: sod - 6 * DAY };
    case '30d': return { from: sod - 29 * DAY, to: now, prevFrom: sod - 59 * DAY, prevTo: sod - 29 * DAY };
  }
}

function summarize(orders: Order[]) {
  const sales = orders.filter((o) => o.status === 'settled');
  const net = sales.reduce((s, o) => s + o.total, 0);
  return {
    net,
    count: sales.length,
    aov: sales.length ? net / sales.length : 0,
    tax: sales.reduce((s, o) => s + o.tax, 0),
    discount: sales.reduce((s, o) => s + o.discountAmount, 0),
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };
}

const ORDER_TYPE_LABEL: Record<string, string> = { 'dine-in': 'Dine-in', takeaway: 'Takeaway', delivery: 'Delivery', online: 'Online' };

function Delta({ cur, prev, invert = false }: { cur: number; prev: number; invert?: boolean }) {
  if (!prev) return <span className="text-slate-400">vs previous: —</span>;
  const pct = ((cur - prev) / prev) * 100;
  const good = invert ? pct <= 0 : pct >= 0;
  return (
    <span className={clsx('inline-flex items-center gap-0.5', good ? 'text-brand-700' : 'text-red-600')}>
      {pct >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(pct).toFixed(1)}% <span className="font-normal text-slate-400">vs previous</span>
    </span>
  );
}

function Kpi({ label, value, cur, prev, icon, invert }: { label: string; value: string; cur: number; prev: number; icon: React.ReactNode; invert?: boolean }) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-start justify-between">
        <span className="text-[13px] text-slate-500">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-slate-700">{icon}</span>
      </div>
      <div className="mt-3 text-[26px] font-normal leading-none tracking-tight text-slate-900">{value}</div>
      <div className="mt-2 text-xs"><Delta cur={cur} prev={prev} invert={invert} /></div>
    </div>
  );
}

const tooltipStyle = { borderRadius: 14, border: 'none', fontSize: 12, background: 'rgba(242,242,242,.95)', boxShadow: '0 20px 40px -20px rgba(0,0,0,.35)' };

export default function Dashboard() {
  const [range, setRange] = useState<RangeKey>('today');
  const navigate = useNavigate();
  const orders = useStore((s) => s.orders);
  const menuItems = useStore((s) => s.menuItems);
  const categories = useStore((s) => s.categories);
  const tables = useStore((s) => s.tables);
  const kots = useStore((s) => s.kots);
  const onlineOrders = useStore((s) => s.onlineOrders);
  const rawMaterials = useStore((s) => s.rawMaterials);
  const settings = useStore((s) => s.settings);
  const areas = useStore((s) => s.areas);
  const outlet = useStore((s) => s.outlets.find((o) => o.id === s.outletId));
  const toast = useStore((s) => s.toast);
  const [areaId, setAreaId] = useState<string>('ar-ac');
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [command, setCommand] = useState('');

  const r = getRange(range);
  const inRange = useMemo(() => orders.filter((o) => o.createdAt >= r.from && o.createdAt < r.to), [orders, r.from, r.to]);
  const inPrev = useMemo(() => orders.filter((o) => o.createdAt >= r.prevFrom && o.createdAt < r.prevTo), [orders, r.prevFrom, r.prevTo]);
  const cur = summarize(inRange);
  const prev = summarize(inPrev);
  const sales = inRange.filter((o) => o.status === 'settled');
  const singleDay = range === 'today' || range === 'yesterday';

  const trend = useMemo(() => {
    if (singleDay) {
      const rows = Array.from({ length: 24 }, (_, h) => ({ label: `${h}:00`, sales: 0, orders: 0 }));
      sales.forEach((o) => { const h = new Date(o.createdAt).getHours(); rows[h].sales += o.total; rows[h].orders++; });
      return rows.slice(9, 24);
    }
    const days = range === '7d' ? 7 : 30;
    const rows = Array.from({ length: days }, (_, i) => {
      const d = r.from + i * DAY;
      return { key: startOfDay(d), label: new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), sales: 0, orders: 0 };
    });
    sales.forEach((o) => {
      const row = rows.find((x) => x.key === startOfDay(o.createdAt));
      if (row) { row.sales += o.total; row.orders++; }
    });
    return rows;
  }, [sales, singleDay, range, r.from]);

  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    sales.forEach((o) => { m[o.orderType] = (m[o.orderType] || 0) + o.total; });
    return Object.entries(m).map(([k, v]) => ({ name: ORDER_TYPE_LABEL[k] || k, value: Math.round(v) }));
  }, [sales]);

  const byPayment = useMemo(() => {
    const m: Record<string, number> = {};
    sales.forEach((o) => o.payments.forEach((p) => { m[p.mode] = (m[p.mode] || 0) + p.amount; }));
    return Object.entries(m).map(([k, v]) => ({ name: k.toUpperCase(), value: Math.round(v) })).sort((a, b) => b.value - a.value);
  }, [sales]);

  const byHour = useMemo(() => {
    const rows = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`, orders: 0 }));
    sales.forEach((o) => { rows[new Date(o.createdAt).getHours()].orders++; });
    return rows.slice(10, 24);
  }, [sales]);
  const maxHour = Math.max(1, ...byHour.map((h) => h.orders));

  const topItems = useMemo(() => {
    const m: Record<string, { name: string; qty: number; revenue: number }> = {};
    sales.forEach((o) => o.items.forEach((l) => {
      const x = (m[l.itemId] ||= { name: l.name, qty: 0, revenue: 0 });
      x.qty += l.qty; x.revenue += l.qty * l.unitPrice;
    }));
    return Object.values(m).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [sales]);

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    sales.forEach((o) => o.items.forEach((l) => {
      const cat = menuItems.find((x) => x.id === l.itemId)?.categoryId;
      const name = categories.find((c) => c.id === cat)?.name || 'Other';
      m[name] = (m[name] || 0) + l.qty * l.unitPrice;
    }));
    return Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  }, [sales, menuItems, categories]);

  // Live panels
  const running = tables.filter((t) => t.orderId && (t.status === 'running' || t.status === 'printed'));
  const runningAmt = running.reduce((s, t) => s + (orders.find((o) => o.id === t.orderId)?.total || 0), 0);
  const openKots = kots.filter((k) => k.status === 'new' || k.status === 'preparing');
  const pendingOnline = onlineOrders.filter((o) => ['placed', 'accepted', 'preparing', 'ready'].includes(o.status));
  const lowStock = rawMaterials.filter((m) => m.stock <= m.minStock);
  const recent = [...orders].filter((o) => o.status !== 'open').sort((a, b) => (b.settledAt || b.createdAt) - (a.settledAt || a.createdAt)).slice(0, 8);

  const reservations = useStore((s) => s.reservations);
  const areaTables = tables.filter((t) => areaId === 'all' || t.areaId === areaId);
  const areaRunning = areaTables.filter((t) => t.orderId);
  const upcoming = reservations.filter((r) => r.status === 'booked').sort((x, y) => x.at - y.at);
  const [resIdx, setResIdx] = useState(0);
  const res = upcoming[Math.min(resIdx, Math.max(0, upcoming.length - 1))];
  const [payMode, setPayMode] = useState<'UPI' | 'CARD' | 'CASH'>('UPI');
  const carousel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Start with the first card peeking at the left edge, like the reference carousel.
    const el = carousel.current;
    if (el) el.scrollLeft = (el.firstElementChild as HTMLElement).offsetWidth + 12 - 22;
  }, []);

  const runCommand = () => {
    const c = command.toLowerCase().trim();
    if (!c) return;
    const routes: [RegExp, string, string][] = [
      [/reserv|book|table/, '/tables', 'Opening tables & reservations'],
      [/kot|kitchen|chef/, '/kds', 'Opening kitchen display'],
      [/swiggy|zomato|online|deliver/, '/online', 'Opening online orders'],
      [/stock|inventor|raw|recipe/, '/inventory', 'Opening inventory'],
      [/purchase|vendor|po\b/, '/purchase', 'Opening purchase manager'],
      [/report|sales|analys|gst|tax/, '/reports', 'Opening reports'],
      [/customer|crm|guest/, '/crm', 'Opening customers'],
      [/menu|item|price/, '/menu', 'Opening menu'],
      [/bill|order|settle/, '/billing', 'Opening billing'],
    ];
    const hit = routes.find(([re]) => re.test(c));
    if (hit) { toast(hit[2], 'info'); navigate(hit[1]); setCommand(''); }
    else toast('Try “book a table”, “low stock”, “today’s sales”…', 'info');
  };

  const payRows = [
    { mode: 'UPI' as const, icon: <Smartphone size={17} strokeWidth={1.5} />, title: 'UPI', sub: settings.upiId },
    { mode: 'CARD' as const, icon: <CreditCard size={17} strokeWidth={1.5} className="fill-slate-900 text-[#e9e9e9]" />, title: 'Credit Card', sub: '4417 **** **** 2093' },
    { mode: 'CASH' as const, icon: <Banknote size={17} strokeWidth={1.5} />, title: 'Cash', sub: 'Drawer · counter 1' },
  ];
  const fmtDay = (t: number) => {
    const d = new Date(t).getDate();
    const sfx = d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th';
    return `${d}${sfx} of ${new Date(t).toLocaleDateString('en-GB', { month: 'long' })}`;
  };
  const timeParts = (t: number) => {
    const d = new Date(t);
    return { hm: `${String(d.getHours() % 12 || 12).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, ap: d.getHours() < 12 ? 'AM' : 'PM' };
  };
  const slot = res ? timeParts(res.at) : timeParts(Date.now());

  const cardHead = (title: string, sub: string, to: string) => (
    <div className="flex items-start justify-between border-b border-black/[.07] pb-4">
      <div><div className="text-[17px] text-slate-900">{title}</div><div className="mt-0.5 text-xs text-slate-500">{sub}</div></div>
      <button onClick={() => navigate(to)} title="Expand" className={squareCls()}><Maximize2 size={17} strokeWidth={1.5} /></button>
    </div>
  );
  const cardCls = 'glass shrink-0 snap-start rounded-[26px] p-6 w-[calc((100%-80px)/3)] min-w-[300px]';

  return (
    <div className="pb-14 pr-4 sm:pr-7">
      {/* ── Hero: title · product shot · assistant ───────────────── */}
      <section className="flex gap-4">
        <div className="relative min-w-0 flex-1 lg:h-[600px]">
          <div className="relative z-[1] pl-1 lg:pl-8">
            <h1 className="text-[34px] font-normal leading-none tracking-[-0.02em] text-slate-900 sm:text-[44px]">{settings.restaurantName}</h1>
            <p className="mt-3 text-[15px] text-slate-500">Modern Indian kitchen & terrace</p>
            <div className="mt-11 inline-flex items-center gap-0.5 rounded-full bg-white/50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,.75)]">
              {areas.map((a) => (
                <button key={a.id} onClick={() => setAreaId(areaId === a.id ? 'all' : a.id)} title={a.name}
                  className={clsx('flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-medium transition',
                    areaId === a.id ? 'bg-brand-600 text-white' : 'text-slate-800 hover:bg-white/70')}>
                  {a.name[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Hero photo: Declan Sun / Unsplash (Unsplash License). Edges fade into the canvas like a product shot. */}
          <img src={`${import.meta.env.BASE_URL}hero-restaurant.jpg`} alt="DineFlow restaurant terrace"
            className="pointer-events-none mt-4 aspect-[16/9] w-full rounded-[26px] object-cover lg:absolute lg:left-0 lg:top-[200px] lg:mt-0 lg:aspect-auto lg:h-[420px] lg:w-[88%] lg:rounded-none"
            style={photoFadeStyle} />

          {/* Assistant + command — floats over the truck's rear like the reference card over the car */}
          <div className="relative z-[2] mt-4 flex w-full flex-col gap-1 lg:absolute lg:right-0 lg:top-0 lg:mt-0 lg:w-[340px]">
            {assistantOpen && (
              <div className="glass rounded-[26px] p-6">
                <div className="flex items-start justify-between border-b border-black/[.07] pb-4">
                  <div><div className="text-[17px] text-slate-900">AI Assistant</div><div className="mt-0.5 text-xs text-slate-500">How can I help you?</div></div>
                  <button onClick={() => setAssistantOpen(false)} title="Close" className={squareCls()}><X size={17} strokeWidth={1.5} /></button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-1">
                  {[
                    { icon: <NotebookPen size={17} strokeWidth={1.6} className="fill-slate-900 text-[#e5e5e5]" />, t: 'Book a table', s: '2 min', to: '/tables' },
                    { icon: <PieIcon size={17} strokeWidth={1.6} className="fill-slate-900 text-slate-900" />, t: 'Analysis', s: 'Sales', to: '/reports' },
                    { icon: <ShieldCheck size={17} strokeWidth={1.6} className="fill-slate-900 text-[#e5e5e5]" />, t: 'Inventory', s: `${lowStock.length} low stock`, to: '/inventory' },
                    { icon: <SquarePercent size={17} strokeWidth={1.6} className="fill-slate-900 text-[#e5e5e5]" />, t: 'Payment', s: 'Settle bills', to: '/billing' },
                  ].map((x, i) => (
                    <button key={x.t} onClick={() => navigate(x.to)}
                      className={clsx('flex items-start gap-2.5 rounded-[14px] px-3 py-3 text-left transition hover:bg-white/60', i === 0 && 'bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]')}>
                      <span className="mt-0.5">{x.icon}</span>
                      <span><span className="block text-[15px] text-slate-900">{x.t}</span><span className="block text-xs text-slate-500">{x.s}</span></span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); runCommand(); }} className="glass rounded-[26px] p-6">
              <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="Book table A3 for 4 at 8pm"
                className="w-full border-b border-black/[.07] bg-transparent pb-4 text-[16px] text-slate-900 caret-slate-900 outline-none placeholder:text-slate-900" />
              <div className="mt-4 flex items-center gap-2">
                <button type="button" title="Voice" onClick={() => toast('Voice input needs microphone access in a real deployment', 'info')} className={squareCls()}><Mic size={17} strokeWidth={1.5} /></button>
                <button type="button" title="Attach" onClick={() => navigate('/purchase')} className={squareCls()}><Paperclip size={17} strokeWidth={1.5} /></button>
                <button type="button" title="Options" onClick={() => setAssistantOpen(!assistantOpen)} className={squareCls()}><CircleDot size={17} strokeWidth={1.5} /></button>
                <button type="submit" className="ml-auto flex h-12 items-center gap-2 rounded-[14px] bg-brand-600 px-5 text-[15px] text-white hover:bg-brand-700">
                  Send <Send size={16} strokeWidth={1.5} />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* right micro rail */}
        <div className="hidden w-12 shrink-0 flex-col gap-2.5 pt-[148px] lg:flex">
          <button title="Online orders" onClick={() => navigate('/online')} className={clsx(squareCls(true), 'relative')}>
            <Zap size={18} strokeWidth={1.5} />
            {pendingOnline.some((o) => o.status === 'placed') && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-brand-600" />}
          </button>
          <button title="Customers" onClick={() => navigate('/crm')} className={squareCls()}><Contact size={18} strokeWidth={1.5} /></button>
          <button title="Feedback" onClick={() => navigate('/feedback')} className={squareCls()}><MessageCircle size={18} strokeWidth={1.5} /></button>
        </div>
      </section>

      {/* ── Bottom carousel: peeking edges, raised centre card ───────────── */}
      <div ref={carousel} className="no-scrollbar -mr-4 mt-6 flex snap-x snap-mandatory scroll-pl-[22px] items-start gap-3 overflow-x-auto pb-2 pt-8 sm:-mr-7 lg:mt-0">
        <div className={cardCls}>
          {cardHead('Kitchen', `${openKots.length} open tickets`, '/kds')}
          <div className="mt-5 space-y-1.5">
            {['new', 'preparing', 'ready'].map((st) => (
              <div key={st} className="flex items-center justify-between rounded-[16px] bg-white/55 px-4 py-3 text-sm capitalize">
                {st}<span className="text-slate-500">{kots.filter((k) => k.status === st).length}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={cardCls}>
          {cardHead('My Floor', `${outlet?.name.split('–')[1]?.trim() || ''}, ${areaId === 'all' ? 'all areas' : areas.find((x) => x.id === areaId)?.name}`, '/tables')}
          <button onClick={() => navigate('/tables')} className="relative -mx-6 mt-5 block h-[150px] w-[calc(100%+48px)] overflow-hidden">
            <svg viewBox="0 0 340 150" preserveAspectRatio="none" className="h-full w-full">
              <rect width="340" height="150" fill="rgba(0,0,0,.035)" />
              {[[0, 8, 70, 40], [82, 0, 96, 34], [190, 10, 60, 44], [262, 0, 78, 52], [0, 62, 46, 88], [58, 48, 70, 46], [140, 58, 54, 92], [206, 66, 72, 40], [290, 64, 50, 86], [58, 106, 70, 44], [206, 118, 72, 32]].map(([x, y, w, h], i) => (
                <rect key={i} x={x} y={y} width={w} height={h} fill="rgba(0,0,0,.055)" />
              ))}
            </svg>
            <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_8px_18px_-6px_rgba(26,145,87,.8)]">
              <MapPin size={18} strokeWidth={1.8} className="fill-white text-white [&>circle]:fill-brand-600" />
            </span>
            <span className="absolute bottom-2 left-6 text-[11px] text-slate-500">{areaRunning.length}/{areaTables.length} tables seated · {inr(runningAmt)}</span>
          </button>
        </div>

        <div className={clsx(cardCls, '-mt-8')}>
          {cardHead('My Reservations', res ? `${fmtDay(res.at)} · ${slot.hm} ${slot.ap}` : 'No upcoming bookings', '/tables')}
          <div className="mt-5 grid grid-cols-2 items-center gap-3">
            <div className="flex items-center justify-between rounded-[18px] bg-white/55 px-2 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]">
              <button onClick={() => setResIdx(Math.max(0, resIdx - 1))} disabled={resIdx === 0} className="p-1 text-brand-600 disabled:opacity-30"><Triangle size={11} className="-rotate-90 fill-brand-600" /></button>
              <div className="text-center">
                <div className="text-[38px] font-light leading-none tracking-tight">{String(new Date(res?.at || Date.now()).getDate()).padStart(2, '0')}</div>
                <div className="mt-1.5 text-sm text-slate-700">{new Date(res?.at || Date.now()).toLocaleDateString('en-GB', { month: 'short' })}</div>
              </div>
              <button onClick={() => setResIdx(Math.min(upcoming.length - 1, resIdx + 1))} disabled={resIdx >= upcoming.length - 1} className="p-1 text-brand-600 disabled:opacity-30"><Triangle size={11} className="rotate-90 fill-brand-600" /></button>
            </div>
            <div className="text-center">
              <div className="text-[38px] font-light leading-none tracking-tight">{slot.hm}</div>
              <div className="mt-1.5 text-sm text-slate-700">{slot.ap}</div>
            </div>
          </div>
          {res && <div className="mt-3 truncate text-center text-xs text-slate-500">{res.customerName} · {res.pax} guests{res.note ? ` · ${res.note}` : ''}</div>}
        </div>

        <div className={cardCls}>
          {cardHead('Payment Method', payRows.find((p) => p.mode === payMode)!.title, '/cash')}
          <div className="mt-5 space-y-1.5">
            {payRows.map((p) => (
              <button key={p.mode} onClick={() => setPayMode(p.mode)} className="flex w-full items-center gap-3 rounded-[16px] bg-white/55 px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,.8)]">
                <span className="text-slate-900">{p.icon}</span>
                <span className="flex-1"><span className="block text-[15px] text-slate-900">{p.title}</span><span className="block text-xs text-slate-500">{p.sub}</span></span>
                <span className={clsx('flex h-[18px] w-[18px] items-center justify-center rounded-full border-2', payMode === p.mode ? 'border-brand-600' : 'border-black/15')}>
                  {payMode === p.mode && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className={cardCls}>
          {cardHead('Online Orders', `${pendingOnline.length} active · Swiggy, Zomato, Web`, '/online')}
          <div className="mt-5 space-y-1.5">
            {pendingOnline.slice(0, 3).map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-[16px] bg-white/55 px-4 py-3 text-sm">
                <span className="capitalize">{o.platform}</span><span className="text-xs text-slate-500">{o.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Performance ─────────────────────────────────── */}
      <div className="mb-4 mt-12 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[26px] font-normal tracking-tight text-slate-900">Performance</h2>
          <p className="text-sm text-slate-500">Compared with the previous period</p>
        </div>
        <Pills<RangeKey> value={range} onChange={setRange} options={[
          { id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: '7d', label: '7 days' }, { id: '30d', label: '30 days' },
        ]} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Net sales" value={inr(cur.net)} cur={cur.net} prev={prev.net} icon={<IndianRupee size={16} strokeWidth={1.6} />} />
        <Kpi label="Orders" value={String(cur.count)} cur={cur.count} prev={prev.count} icon={<ShoppingBag size={16} strokeWidth={1.6} />} />
        <Kpi label="Avg. order" value={inr(cur.aov)} cur={cur.aov} prev={prev.aov} icon={<Receipt size={16} strokeWidth={1.6} />} />
        <Kpi label="Tax" value={inr(cur.tax)} cur={cur.tax} prev={prev.tax} icon={<Percent size={16} strokeWidth={1.6} />} />
        <Kpi label="Discounts" value={inr(cur.discount)} cur={cur.discount} prev={prev.discount} icon={<Tag size={16} strokeWidth={1.6} />} invert />
        <Kpi label="Cancelled" value={String(cur.cancelled)} cur={cur.cancelled} prev={prev.cancelled} icon={<Ban size={16} strokeWidth={1.6} />} invert />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <LiveTile onClick={() => navigate('/tables')} icon={<LayoutGrid size={17} strokeWidth={1.6} />} label="Running tables" value={`${running.length}`} sub={`${inr(runningAmt)} on tables`} />
        <LiveTile onClick={() => navigate('/kds')} icon={<ChefHat size={17} strokeWidth={1.6} />} label="Open KOTs" value={`${openKots.length}`} sub={`${openKots.filter((k) => k.status === 'new').length} new · ${openKots.filter((k) => k.status === 'preparing').length} preparing`} />
        <LiveTile onClick={() => navigate('/online')} icon={<Truck size={17} strokeWidth={1.6} />} label="Online orders" value={`${pendingOnline.length}`} sub={`${pendingOnline.filter((o) => o.status === 'placed').length} awaiting acceptance`} alert={pendingOnline.some((o) => o.status === 'placed')} />
        <LiveTile onClick={() => navigate('/inventory')} icon={<AlertTriangle size={17} strokeWidth={1.6} />} label="Low stock" value={`${lowStock.length}`} sub={lowStock.slice(0, 2).map((m) => m.name).join(', ') || 'All good'} alert={lowStock.length > 0} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title={singleDay ? 'Hourly sales' : 'Daily sales'} className="xl:col-span-2">
          <div className="h-72 p-4">
            {sales.length === 0 ? <Empty title="No sales in this period" /> : (
              <ResponsiveContainer>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1a9157" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#1a9157" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(0,0,0,.06)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7c7c7c' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: '#7c7c7c' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} width={44} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n) => (n === 'sales' ? [inr(v), 'Sales'] : [v, 'Orders'])} />
                  <Area type="monotone" dataKey="sales" stroke="#1a9157" strokeWidth={2} fill="url(#salesFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card title="Order types">
          <div className="h-72 p-4">
            {byType.length === 0 ? <Empty title="No data" /> : (
              <div className="flex h-full flex-col">
                <div className="flex-1">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={byType} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={3} stroke="none">
                        {byType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => inr(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {byType.map((t, i) => (
                    <div key={t.name} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-slate-600">{t.name}</span>
                      <span className="ml-auto text-slate-900">{cur.net ? ((t.value / cur.net) * 100).toFixed(0) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title="Orders by hour" className="xl:col-span-2">
          <div className="p-5">
            <div className="flex h-44 items-end gap-1.5">
              {byHour.map((h) => (
                <div key={h.hour} className="group flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100">{h.orders}</span>
                  <div className="w-full rounded-lg transition"
                    style={{ height: `${Math.max(6, (h.orders / maxHour) * 140)}px`, background: h.orders === maxHour ? '#1a9157' : 'rgba(255,255,255,.7)' }}
                    title={`${h.label}: ${h.orders} orders`} />
                  <span className="text-[10px] text-slate-500">{h.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">Peak hour <span className="text-slate-900">{byHour.reduce((a, b) => (b.orders > a.orders ? b : a), byHour[0]).label}</span></p>
          </div>
        </Card>

        <Card title="Category share">
          <div className="space-y-3 p-5">
            {byCategory.length === 0 && <Empty title="No data" />}
            {byCategory.map((c) => {
              const total = byCategory.reduce((s, x) => s + x.value, 0);
              const pct = total ? (c.value / total) * 100 : 0;
              return (
                <div key={c.name}>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-slate-700">{c.name}</span>
                    <span className="text-slate-500">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/[.06]">
                    <div className="h-1.5 rounded-full bg-slate-800" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Top items" className="xl:col-span-2">
          <div className="px-2 pb-2">
            {topItems.length === 0 && <Empty title="No sales" />}
            {topItems.map((t, i) => (
              <div key={t.name} className="flex items-center gap-4 rounded-2xl px-3 py-2.5 text-sm hover:bg-white/40">
                <span className="w-5 text-xs text-slate-400">{String(i + 1).padStart(2, '0')}</span>
                <span className="w-44 truncate text-slate-900">{t.name}</span>
                <div className="hidden h-1.5 flex-1 rounded-full bg-black/[.06] sm:block">
                  <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${(t.revenue / topItems[0].revenue) * 100}%` }} />
                </div>
                <span className="w-12 text-right text-xs text-slate-500">×{t.qty}</span>
                <span className="w-20 text-right text-slate-900">{inr(t.revenue)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Payment modes">
          <div className="h-64 p-4">
            <ResponsiveContainer>
              <BarChart data={byPayment} layout="vertical" margin={{ left: 4 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#404040' }} axisLine={false} tickLine={false} width={56} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,.4)' }} formatter={(v: number) => inr(v)} />
                <Bar dataKey="value" fill="#2a2a2a" radius={[8, 8, 8, 8]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Recent orders" className="xl:col-span-2" actions={<Button size="sm" variant="outline" onClick={() => navigate('/orders')}>View all</Button>}>
          <div className="px-2 pb-2">
            {recent.map((o) => (
              <div key={o.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm hover:bg-white/40">
                <span className="w-14 text-xs text-slate-500">#{o.billNo || '—'}</span>
                <Badge>{ORDER_TYPE_LABEL[o.orderType]}</Badge>
                <span className="hidden text-xs capitalize text-slate-500 sm:inline">{o.platform}</span>
                <span className="text-xs text-slate-400">{fmtTime(o.createdAt)}</span>
                <span className="ml-auto text-slate-900">{inr(o.total)}</span>
                <span className={clsx('h-2 w-2 rounded-full', o.status === 'settled' ? 'bg-brand-600' : o.status === 'cancelled' ? 'bg-red-500' : 'bg-amber-500')} title={o.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Needs attention" actions={<Button size="sm" variant="outline" onClick={() => navigate('/purchase')}>Reorder</Button>}>
          <div className="px-2 pb-2">
            {lowStock.length === 0 && pendingOnline.length === 0 && <Empty title="All clear" />}
            {lowStock.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm">
                <span className="text-slate-800">{m.name}</span>
                <span className="text-xs"><span className="text-red-600">{m.stock} {m.unit}</span> <span className="text-slate-400">/ {m.minStock}</span></span>
              </div>
            ))}
            {pendingOnline.slice(0, 3).map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm">
                <span className="capitalize text-slate-800">{o.platform} · {o.platformOrderId}</span>
                <span className="text-xs text-slate-500">{o.status} · {minsAgo(o.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function LiveTile({ icon, label, value, sub, onClick, alert }: { icon: React.ReactNode; label: string; value: string; sub: string; onClick: () => void; alert?: boolean }) {
  return (
    <button onClick={onClick} className="glass flex items-center gap-3.5 rounded-3xl p-4 text-left transition hover:bg-white/70">
      <span className={clsx('relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/65 text-slate-800')}>
        {icon}
        {alert && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-600" />}
      </span>
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-xl font-normal text-slate-900">{value}</div>
        <div className="truncate text-[11px] text-slate-400">{sub}</div>
      </div>
    </button>
  );
}
