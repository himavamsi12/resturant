import { BellRing, CheckCircle2, ChevronUp, Minus, Plus, Receipt, Search, ShoppingBag, Smartphone } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import CustomizeSheet from '../components/CustomizeSheet';
import { clsx, Toggle, VegMark } from '../components/ui';
import { computeTotals, inr } from '../lib/billing';
import { addToCart, changeQty, makeLine } from '../lib/cart';
import { useCrossTabSync } from '../lib/useCrossTabSync';
import { useStore } from '../store/useStore';
import type { CartItem, MenuItem } from '../types';

/** Customer QR menu: scan the table QR → browse → order → pay. */
export default function ScanOrder() {
  useCrossTabSync();
  const { tableId } = useParams();
  const s = useStore();
  const table = s.tables.find((t) => t.id === tableId);
  const area = s.areas.find((a) => a.id === table?.areaId);
  const order = s.orders.find((o) => o.id === table?.orderId && (o.status === 'open' || o.status === 'billed'));

  const [cat, setCat] = useState('all');
  const [vegOnly, setVegOnly] = useState(false);
  const [q, setQ] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sheet, setSheet] = useState(false);
  const [custom, setCustom] = useState<MenuItem | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [done, setDone] = useState(false);
  const [paying, setPaying] = useState<'idle' | 'processing' | 'paid'>('idle');

  const price = (m: MenuItem) => (table ? m.areaPrices[table.areaId] ?? m.price : m.price);
  const cats = s.categories.filter((c) => c.active);
  const items = useMemo(() => s.menuItems.filter((m) => (cat === 'all' || m.categoryId === cat) && (!vegOnly || m.veg) && m.name.toLowerCase().includes(q.toLowerCase())), [s.menuItems, cat, vegOnly, q]);
  const qtyOf = (id: string) => cart.filter((l) => l.itemId === id).reduce((a, l) => a + l.qty, 0);
  const count = cart.reduce((a, l) => a + l.qty, 0);
  const preview = computeTotals({ items: cart }, area?.serviceCharge || 0, true);

  if (!table) {
    return <div className="flex min-h-screen items-center justify-center bg-[#d9d9d9] p-6 text-center text-slate-500">Invalid table QR code. Please ask the staff for help.</div>;
  }

  const add = (m: MenuItem) => {
    if (m.variations.length || m.addonGroupIds.length) return setCustom(m);
    setCart((c) => addToCart(c, { ...makeLine(m), unitPrice: price(m) }));
  };
  const dec = (m: MenuItem) => {
    const line = [...cart].reverse().find((l) => l.itemId === m.id);
    if (line) setCart((c) => changeQty(c, line.lineId, -1));
  };

  const place = () => {
    if (!cart.length) return;
    if (phone && !/^\d{10}$/.test(phone)) return s.toast('Enter a valid 10-digit phone', 'error');
    const customerId = phone ? s.findOrCreateCustomer(phone, name || undefined) : undefined;
    let id = order?.id;
    if (id) {
      // adding to a running (or already-billed) table order re-opens it
      s.updateOrder(id, { items: [...order!.items, ...cart], customerId: order!.customerId || customerId, status: 'open' });
    } else {
      id = s.createOrder({ orderType: 'dine-in', platform: 'scan-order', tableId: table.id, areaId: table.areaId, pax: 2, customerId, items: cart });
    }
    useStore.getState().sendKot(id);
    setCart([]);
    setSheet(false);
    setDone(true);
  };

  const pay = () => {
    if (!order) return;
    setPaying('processing');
    setTimeout(() => {
      useStore.getState().settleOrder(order.id, [{ mode: 'upi', amount: order.total }]);
      setPaying('paid');
    }, 1800);
  };

  if (paying === 'paid') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#d9d9d9] p-6 text-center text-slate-900">
        <div className="glass flex w-full max-w-sm flex-col items-center rounded-3xl p-8">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/70"><CheckCircle2 size={34} strokeWidth={1.4} className="text-brand-600" /></span>
          <h1 className="mt-4 text-[26px] font-normal tracking-tight">Payment successful</h1>
          <p className="mt-1 text-sm text-slate-500">Thank you for dining with us at {s.settings.restaurantName}.</p>
          <a href={`#/website`} className="mt-6 rounded-2xl bg-white/70 px-5 py-3 text-sm text-slate-800">Order online next time</a>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#d9d9d9] p-6 text-center text-slate-900">
        <div className="glass flex w-full max-w-sm flex-col items-center rounded-3xl p-8">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/70"><CheckCircle2 size={34} strokeWidth={1.4} className="text-brand-600" /></span>
          <h1 className="mt-4 text-[26px] font-normal tracking-tight">Order placed</h1>
          <p className="mt-1 text-sm text-slate-500">Sent to the kitchen — it will be served at table <span className="text-slate-900">{table.name}</span> shortly.</p>
          <button onClick={() => setDone(false)} className="mt-6 rounded-2xl bg-brand-600 px-6 py-3 text-sm text-white shadow-[0_8px_20px_-10px_rgba(26,145,87,.8)]">Order more</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#d9d9d9] text-slate-900">
    <div className="mx-auto min-h-screen max-w-md pb-28">
      <header className="px-4 pb-4 pt-7">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-slate-500">Welcome to</div>
            <h1 className="text-[28px] font-normal leading-tight tracking-tight">{s.settings.restaurantName}</h1>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/50 px-3 py-1 text-xs text-slate-600"><span className="h-2 w-2 rounded-full bg-brand-600" /> Table {table.name} · {area?.name}</div>
          </div>
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
            <circle cx="17" cy="17" r="13" stroke="#111" strokeWidth="5" />
            <path d="M17 4v13h13" stroke="#111" strokeWidth="5" />
          </svg>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => s.toast(`Waiter called to table ${table.name}`, 'info')} className="flex items-center justify-center gap-2 rounded-2xl bg-white/55 py-3 text-sm text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,.8)] hover:bg-white/80">
            <BellRing size={16} strokeWidth={1.6} /> Call waiter
          </button>
          <button disabled={!order} onClick={() => { if (order) { s.printBill(order.id); s.toast('Bill requested — it will be brought to your table', 'info'); } }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white/55 py-3 text-sm text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,.8)] hover:bg-white/80 disabled:opacity-50">
            <Receipt size={16} strokeWidth={1.6} /> Request bill
          </button>
        </div>
      </header>

      {order?.status === 'billed' && (
        <div className="glass mx-4 mb-2 rounded-3xl p-5">
          <div className="flex items-center gap-2 border-b border-black/[.06] pb-3 text-[15px]"><Smartphone size={16} strokeWidth={1.6} /> Scan & pay</div>
          <div className="mt-2 space-y-1 text-sm">
            {order.items.map((l) => <div key={l.lineId} className="flex justify-between text-slate-600"><span>{l.qty}× {l.name}</span><span>{inr(l.qty * l.unitPrice)}</span></div>)}
            <div className="flex justify-between border-t border-black/[.06] pt-1 text-xs text-slate-500"><span>Taxes & charges</span><span>{inr(order.tax + order.serviceCharge, 2)}</span></div>
            {order.discountAmount > 0 && <div className="flex justify-between text-xs text-brand-700"><span>Discount</span><span>-{inr(order.discountAmount, 2)}</span></div>}
            <div className="flex justify-between pt-1 text-2xl font-light tracking-tight"><span className="text-sm text-slate-500">Bill #{order.billNo}</span><span>{inr(order.total)}</span></div>
          </div>
          <button onClick={pay} disabled={paying === 'processing'} className="mt-3 w-full rounded-2xl bg-brand-600 py-3.5 text-white shadow-[0_8px_20px_-10px_rgba(26,145,87,.8)] disabled:opacity-70">
            {paying === 'processing' ? 'Processing payment…' : `Pay ${inr(order.total)} via UPI`}
          </button>
          <div className="mt-1 text-center text-[11px] text-slate-400">Paying to {s.settings.upiId}</div>
        </div>
      )}

      <div className="sticky top-0 z-10 space-y-2 bg-[#d9d9d9]/85 px-4 pb-2 pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white/60 px-3.5">
            <Search size={16} strokeWidth={1.6} className="text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dishes" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-400" />
          </div>
          <div className="rounded-2xl bg-white/60 px-3 py-2.5"><Toggle size="sm" checked={vegOnly} onChange={setVegOnly} label={<span className="text-xs text-slate-700">Veg</span>} /></div>
        </div>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          {[{ id: 'all', name: 'All' }, ...cats].map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={clsx('shrink-0 rounded-xl px-3.5 py-2 text-xs transition', cat === c.id ? 'bg-black/[.1] text-slate-900' : 'bg-white/55 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]')}>{c.name}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2 px-4">
        {items.map((m) => (
          <div key={m.id} className={clsx('glass flex gap-3 rounded-3xl p-3 pl-4', !m.available && 'opacity-50')}>
            <div className="flex-1 py-1">
              <VegMark veg={m.veg} />
              <div className="mt-1.5 text-[15px] text-slate-900">{m.name}</div>
              <div className="text-sm text-slate-500">{m.variations.length ? `from ${inr(Math.min(...m.variations.map((v) => v.price)))}` : inr(price(m))}</div>
              {m.variations.length > 0 && <div className="text-xs text-slate-400">Customisable</div>}
            </div>
            <div className="flex flex-col items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/60 text-4xl">{m.image}</div>
              {!m.available ? <span className="-mt-3 rounded-xl bg-white/90 px-2.5 py-1 text-[11px] text-slate-600">Sold out</span>
                : qtyOf(m.id) === 0 ? (
                  <button onClick={() => add(m)} className="-mt-3 rounded-xl bg-white/95 px-5 py-1.5 text-sm text-slate-900 shadow-[0_6px_14px_-8px_rgba(0,0,0,.35)]">Add</button>
                ) : (
                  <div className="-mt-3 flex items-center gap-2 rounded-xl bg-brand-600 px-2 py-1.5 text-white shadow-[0_6px_14px_-8px_rgba(26,145,87,.8)]">
                    <button onClick={() => dec(m)}><Minus size={14} strokeWidth={1.6} /></button>
                    <span className="w-4 text-center text-sm">{qtyOf(m.id)}</span>
                    <button onClick={() => add(m)}><Plus size={14} strokeWidth={1.6} /></button>
                  </div>
                )}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No dishes match.</p>}
      </div>

      {count > 0 && (
        <button onClick={() => setSheet(true)} className="fixed bottom-4 left-1/2 flex w-[calc(100%-2rem)] max-w-[26rem] -translate-x-1/2 items-center justify-between rounded-2xl bg-brand-600 px-5 py-4 text-sm text-white shadow-[0_18px_36px_-14px_rgba(26,145,87,.9)]">
          <span className="flex items-center gap-2"><ShoppingBag size={17} strokeWidth={1.6} /> {count} item{count > 1 && 's'} · {inr(preview.subtotal)}</span>
          <span className="flex items-center gap-1">View cart <ChevronUp size={17} strokeWidth={1.6} /></span>
        </button>
      )}

      {sheet && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-neutral-500/30 backdrop-blur-sm" onClick={() => setSheet(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[#efefef]/95 p-5 shadow-[0_-20px_60px_-30px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.8)] backdrop-blur-xl">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/10" />
            <h2 className="mb-3 text-xl font-normal tracking-tight">Your order <span className="text-sm text-slate-500">· Table {table.name}</span></h2>
            {cart.map((l) => (
              <div key={l.lineId} className="mb-1.5 flex items-center gap-3 rounded-2xl bg-white/55 px-4 py-3 text-sm">
                <div className="flex-1">
                  <div className="text-slate-900">{l.name}</div>
                  {(l.variation || l.addons.length > 0) && <div className="text-xs text-slate-400">{[l.variation, ...l.addons.map((a) => a.name)].filter(Boolean).join(', ')}</div>}
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-white/70 px-2 py-1">
                  <button onClick={() => setCart((c) => changeQty(c, l.lineId, -1))}><Minus size={14} strokeWidth={1.6} /></button>
                  <span className="w-4 text-center">{l.qty}</span>
                  <button onClick={() => setCart((c) => changeQty(c, l.lineId, 1))}><Plus size={14} strokeWidth={1.6} /></button>
                </div>
                <span className="w-16 text-right">{inr(l.qty * l.unitPrice)}</span>
              </div>
            ))}
            <div className="mt-3 space-y-1 text-sm text-slate-600">
              <div className="flex justify-between"><span>Item total</span><span>{inr(preview.subtotal, 2)}</span></div>
              {preview.serviceCharge > 0 && <div className="flex justify-between"><span>Service charge ({area?.serviceCharge}%)</span><span>{inr(preview.serviceCharge, 2)}</span></div>}
              <div className="flex justify-between"><span>GST</span><span>{inr(preview.tax, 2)}</span></div>
              <div className="flex justify-between pt-1 text-2xl font-light tracking-tight text-slate-900"><span className="self-end text-sm text-slate-500">Estimated total</span><span>{inr(preview.total)}</span></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="rounded-xl bg-white/60 px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 focus:bg-white/90" />
              <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Mobile (for e-bill)" className="rounded-xl bg-white/60 px-3.5 py-3 text-sm outline-none placeholder:text-slate-400 focus:bg-white/90" />
            </div>
            <button onClick={place} className="mt-4 w-full rounded-2xl bg-brand-600 py-4 text-white shadow-[0_8px_20px_-10px_rgba(26,145,87,.8)]">Place order</button>
            <p className="mt-2 text-center text-xs text-slate-400">Pay at the end of your meal via Scan & Pay or at the counter.</p>
          </div>
        </div>
      )}

      {custom && <CustomizeSheet item={custom} basePrice={price(custom)} onClose={() => setCustom(null)} onAdd={(l) => setCart((c) => addToCart(c, l))} />}
    </div>
    </div>
  );
}
