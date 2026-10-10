import { ArrowLeft, ClipboardList, LayoutGrid, LogOut, Minus, Plus, Printer, Search, Send, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, clsx, Modal, VegMark } from '../components/ui';
import { inr, minsAgo } from '../lib/billing';
import { addToCart, changeQty, makeLine } from '../lib/cart';
import { useCrossTabSync } from '../lib/useCrossTabSync';
import { useCurrentStaff, useStore } from '../store/useStore';
import type { CartItem, MenuItem, Table, TableStatus } from '../types';

// tile surfaces stay neutral; status is carried by a small dot
const STATUS_STYLE: Record<TableStatus, string> = {
  blank: 'bg-white/45 text-slate-600',
  running: 'bg-white/85 text-slate-900',
  printed: 'bg-white/85 text-slate-900',
  paid: 'bg-white/60 text-slate-700',
  reserved: 'bg-white/60 text-slate-700',
};
const STATUS_DOT: Record<TableStatus, string> = {
  blank: 'bg-black/15', running: 'bg-brand-600', printed: 'bg-amber-500', paid: 'bg-slate-500', reserved: 'bg-slate-800',
};
const soft = 'bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]';

function ItemPicker({ item, price, onAdd, onClose }: { item: MenuItem; price: (m: MenuItem) => number; onAdd: (l: CartItem) => void; onClose: () => void }) {
  const groups = useStore((s) => s.addonGroups.filter((g) => item.addonGroupIds.includes(g.id)));
  const [vid, setVid] = useState(item.variations[0]?.id);
  const [addons, setAddons] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const v = item.variations.find((x) => x.id === vid);
  const chosen = groups.flatMap((g) => g.items).filter((a) => addons.includes(a.id));
  const unit = (v ? v.price : price(item)) + chosen.reduce((a, x) => a + x.price, 0);
  return (
    <Modal open onClose={onClose} title={item.name} size="sm"
      footer={<button onClick={() => { onAdd({ ...makeLine(item, 1, v, chosen.map((a) => ({ name: a.name, price: a.price })), note || undefined), unitPrice: unit }); onClose(); }}
        className="w-full rounded-2xl bg-brand-600 py-3 text-white shadow-[0_8px_20px_-10px_rgba(26,145,87,.8)]">Add · {inr(unit)}</button>}>
      {item.variations.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs text-slate-500">Choose size</div>
          {item.variations.map((x) => (
            <label key={x.id} className="mb-1.5 flex items-center justify-between rounded-2xl bg-white/55 px-4 py-2.5 text-sm">
              <span className="flex items-center gap-2"><input type="radio" checked={vid === x.id} onChange={() => setVid(x.id)} /> {x.name}</span>
              <span>{inr(x.price)}</span>
            </label>
          ))}
        </div>
      )}
      {groups.map((g) => (
        <div key={g.id} className="mb-4">
          <div className="mb-2 text-xs text-slate-500">{g.name} <span className="text-slate-400">· up to {g.max}</span></div>
          {g.items.map((a) => (
            <label key={a.id} className="mb-1.5 flex items-center justify-between rounded-2xl bg-white/55 px-4 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                <input type="checkbox" checked={addons.includes(a.id)}
                  onChange={(e) => setAddons(e.target.checked ? (addons.filter((x) => g.items.some((i) => i.id === x)).length < g.max ? [...addons, a.id] : addons) : addons.filter((x) => x !== a.id))} />
                {a.name}
              </span>
              <span>+{inr(a.price)}</span>
            </label>
          ))}
        </div>
      ))}
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cooking instruction (e.g. less spicy)" className="w-full rounded-xl bg-white/60 px-3.5 py-2.5 text-sm outline-none focus:bg-white/90 focus:shadow-[inset_0_0_0_1.5px_#1a9157]" />
    </Modal>
  );
}

function TableOrder({ table, onBack }: { table: Table; onBack: () => void }) {
  const s = useStore();
  const order = s.orders.find((o) => o.id === table.orderId);
  const area = s.areas.find((a) => a.id === table.areaId);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cat, setCat] = useState(s.categories[0]?.id || '');
  const [q, setQ] = useState('');
  const [picking, setPicking] = useState<MenuItem | null>(null);
  const [pax, setPax] = useState(2);
  const [view, setView] = useState<'menu' | 'order'>(order ? 'order' : 'menu');

  const price = (m: MenuItem) => m.areaPrices[table.areaId] ?? m.price;
  const items = s.menuItems.filter((m) => (q ? m.name.toLowerCase().includes(q.toLowerCase()) || m.shortCode.toLowerCase() === q.toLowerCase() : m.categoryId === cat));
  const qtyInCart = (id: string) => cart.filter((l) => l.itemId === id).reduce((a, l) => a + l.qty, 0);

  const tap = (m: MenuItem) => {
    if (!m.available) return;
    if (m.variations.length || m.addonGroupIds.length) setPicking(m);
    else setCart((c) => addToCart(c, { ...makeLine(m), unitPrice: price(m) }));
  };

  const sendKot = () => {
    if (!cart.length) return;
    let id = order?.id;
    if (!id) {
      id = s.createOrder({ orderType: 'dine-in', platform: 'captain', tableId: table.id, areaId: table.areaId, pax, items: cart });
    } else {
      s.updateOrder(id, { items: [...order!.items, ...cart] });
    }
    const n = useStore.getState().sendKot(id);
    s.toast(`KOT sent to ${n} station${n > 1 ? 's' : ''}`);
    setCart([]);
    setView('order');
  };

  const cartTotal = cart.reduce((a, l) => a + l.qty * l.unitPrice, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 pb-3 pt-5">
        <button onClick={onBack} className={clsx('flex h-10 w-10 items-center justify-center rounded-xl text-slate-700', soft)}><ArrowLeft size={18} strokeWidth={1.6} /></button>
        <div className="flex-1">
          <div className="text-[22px] font-normal leading-tight tracking-tight">Table {table.name}</div>
          <div className="text-xs text-slate-500">{area?.name} · {table.seats} seats {order && `· ${inr(order.total)}`}</div>
        </div>
        <div className="flex gap-1 text-xs">
          <button onClick={() => setView('menu')} className={clsx('rounded-xl px-3 py-2', view === 'menu' ? 'bg-black/[.1] text-slate-900' : clsx(soft, 'text-slate-600'))}>Menu</button>
          <button onClick={() => setView('order')} className={clsx('rounded-xl px-3 py-2', view === 'order' ? 'bg-black/[.1] text-slate-900' : clsx(soft, 'text-slate-600'))}>Order</button>
        </div>
      </div>

      {view === 'menu' ? (
        <>
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 rounded-2xl bg-white/60 px-3.5">
              <Search size={16} strokeWidth={1.6} className="text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search dish or shortcode" className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-400" />
            </div>
            {!q && (
              <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
                {s.categories.filter((c) => c.active).map((c) => (
                  <button key={c.id} onClick={() => setCat(c.id)} className={clsx('shrink-0 rounded-xl px-3.5 py-2 text-xs', cat === c.id ? 'bg-black/[.1] text-slate-900' : clsx(soft, 'text-slate-600'))}>{c.name}</button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto px-4 pb-3">
            {items.map((m) => (
              <button key={m.id} onClick={() => tap(m)} disabled={!m.available}
                className="flex w-full items-center gap-3 rounded-2xl bg-white/55 px-3 py-2.5 text-left transition hover:bg-white/80 disabled:opacity-40">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/70 text-2xl">{m.image}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 text-sm text-slate-900"><VegMark veg={m.veg} /> {m.name}</div>
                  <div className="text-xs text-slate-500">{m.variations.length ? `from ${inr(Math.min(...m.variations.map((v) => v.price)))}` : inr(price(m))} · {m.shortCode}{!m.available && ' · Out of stock'}</div>
                </div>
                {qtyInCart(m.id) > 0
                  ? <span className="flex h-8 min-w-8 items-center justify-center rounded-xl bg-brand-600 px-2 text-xs text-white">{qtyInCart(m.id)}</span>
                  : <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 text-slate-700"><Plus size={15} strokeWidth={1.6} /></span>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {!order && !cart.length && <p className="py-10 text-center text-sm text-slate-400">No items yet. Add from menu.</p>}
          {!order && (
            <div className="glass mb-3 flex items-center justify-between rounded-3xl p-4">
              <span className="text-sm text-slate-700">Guests</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setPax(Math.max(1, pax - 1))} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/70"><Minus size={14} strokeWidth={1.6} /></button>
                <span className="w-5 text-center text-lg font-light">{pax}</span>
                <button onClick={() => setPax(pax + 1)} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/70"><Plus size={14} strokeWidth={1.6} /></button>
              </div>
            </div>
          )}
          {order && (
            <div className="glass mb-3 rounded-3xl p-4">
              <div className="mb-2 flex items-center justify-between border-b border-black/[.06] pb-2 text-xs text-slate-500">
                <span>Sent to kitchen</span>
                <span>{minsAgo(order.createdAt)}</span>
              </div>
              {order.items.map((l) => (
                <div key={l.lineId} className="flex justify-between py-1 text-sm">
                  <span>{l.qty}× {l.name}{l.variation && <span className="text-slate-400"> ({l.variation})</span>}</span>
                  <span className="text-slate-600">{inr(l.qty * l.unitPrice)}</span>
                </div>
              ))}
              <div className="mt-2 space-y-0.5 border-t border-black/[.06] pt-2 text-xs text-slate-500">
                <div className="flex justify-between"><span>Subtotal</span><span>{inr(order.subtotal, 2)}</span></div>
                {order.serviceCharge > 0 && <div className="flex justify-between"><span>Service charge</span><span>{inr(order.serviceCharge, 2)}</span></div>}
                <div className="flex justify-between"><span>GST</span><span>{inr(order.tax, 2)}</span></div>
                <div className="flex justify-between pt-1 text-xl font-light tracking-tight text-slate-900"><span>Total</span><span>{inr(order.total)}</span></div>
              </div>
              {order.status === 'billed' && <Badge color="green" className="mt-2">Bill printed #{order.billNo}</Badge>}
            </div>
          )}
          {cart.length > 0 && (
            <div className="rounded-3xl bg-white/70 p-4 shadow-[inset_0_0_0_1.5px_rgba(26,145,87,.35)]">
              <div className="mb-2 flex items-center gap-2 text-xs text-brand-700"><span className="h-2 w-2 rounded-full bg-brand-600" /> New items · not sent</div>
              {cart.map((l) => (
                <div key={l.lineId} className="flex items-center gap-2 py-1.5 text-sm">
                  <div className="flex-1">
                    <div>{l.name}{l.variation && <span className="text-slate-400"> ({l.variation})</span>}</div>
                    {(l.addons.length > 0 || l.note) && <div className="text-xs text-slate-400">{l.addons.map((a) => a.name).join(', ')} {l.note && `· ${l.note}`}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCart((c) => changeQty(c, l.lineId, -1))} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/80"><Minus size={12} strokeWidth={1.6} /></button>
                    <span className="w-4 text-center">{l.qty}</span>
                    <button onClick={() => setCart((c) => changeQty(c, l.lineId, 1))} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/80"><Plus size={12} strokeWidth={1.6} /></button>
                  </div>
                  <span className="w-14 text-right">{inr(l.qty * l.unitPrice)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="glass m-3 flex gap-2 rounded-3xl p-2">
        {order && !cart.length && (
          <button onClick={() => { s.printBill(order.id); s.toast(`Bill requested for ${table.name}`); }}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/80 py-3.5 text-slate-900"><Printer size={17} strokeWidth={1.6} /> {order.status === 'billed' ? 'Reprint Bill' : 'Request Bill'}</button>
        )}
        {(cart.length > 0 || !order) && (
          <button disabled={!cart.length} onClick={sendKot}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-sm text-white shadow-[0_8px_20px_-10px_rgba(26,145,87,.8)] disabled:opacity-40">
            <Send size={16} strokeWidth={1.6} /> Send KOT {cart.length > 0 && `· ${cart.reduce((a, l) => a + l.qty, 0)} items · ${inr(cartTotal)}`}
          </button>
        )}
      </div>
      {picking && <ItemPicker item={picking} price={price} onClose={() => setPicking(null)} onAdd={(l) => setCart((c) => addToCart(c, l))} />}
    </div>
  );
}

export default function CaptainApp() {
  useCrossTabSync();
  const staff = useCurrentStaff();
  const logout = useStore((s) => s.logout);
  const tables = useStore((s) => s.tables);
  const areas = useStore((s) => s.areas);
  const orders = useStore((s) => s.orders);
  const [tab, setTab] = useState<'tables' | 'orders' | 'profile'>('tables');
  const [area, setArea] = useState(areas[0]?.id);
  const [tableId, setTableId] = useState<string | null>(null);
  const table = tables.find((t) => t.id === tableId);

  const running = useMemo(() => orders.filter((o) => o.status === 'open' || o.status === 'billed').filter((o) => o.orderType === 'dine-in'), [orders]);
  const mine = orders.filter((o) => o.staffId === staff?.id && o.createdAt > Date.now() - 86400000);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#cfcfcf] text-slate-900 sm:p-6">
      <div className="relative flex h-screen w-full max-w-md flex-col overflow-hidden bg-[#dcdcdc] sm:h-[860px] sm:rounded-[2.75rem] sm:shadow-[0_50px_100px_-40px_rgba(0,0,0,.5),inset_0_0_0_8px_#ececec,inset_0_0_0_9px_rgba(0,0,0,.06)] sm:p-2">
        {table ? <TableOrder key={table.id} table={table} onBack={() => setTableId(null)} /> : (
          <>
            <div className="flex items-end justify-between px-4 pb-3 pt-6">
              <div>
                <div className="text-xs text-slate-500">Captain app</div>
                <div className="text-[26px] font-normal leading-tight tracking-tight">Hi, {staff?.name.split(' ')[0]}</div>
              </div>
              <span className={clsx('flex h-11 w-11 items-center justify-center rounded-2xl text-sm', soft)}>{staff?.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {tab === 'tables' && (
                <div className="px-4 pb-4">
                  <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
                    {areas.map((a) => (
                      <button key={a.id} onClick={() => setArea(a.id)} className={clsx('shrink-0 rounded-xl px-4 py-2.5 text-xs', area === a.id ? 'bg-black/[.1] text-slate-900' : clsx(soft, 'text-slate-600'))}>{a.name}</button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {tables.filter((t) => t.areaId === area).map((t) => {
                      const o = orders.find((x) => x.id === t.orderId);
                      return (
                        <button key={t.id} onClick={() => setTableId(t.id)} className={clsx('relative flex aspect-square flex-col items-center justify-center rounded-3xl shadow-[inset_0_1px_0_rgba(255,255,255,.8)] transition active:scale-95', STATUS_STYLE[t.status])}>
                          <span className={clsx('absolute right-3 top-3 h-2 w-2 rounded-full', STATUS_DOT[t.status])} />
                          <span className="text-2xl font-light tracking-tight">{t.name}</span>
                          <span className="text-[11px] capitalize text-slate-500">{t.status === 'blank' ? `${t.seats} seats` : t.status}</span>
                          {o && <span className="text-xs text-slate-700">{inr(o.total)}</span>}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-500">
                    {(['blank', 'running', 'printed', 'reserved'] as TableStatus[]).map((s) => (
                      <span key={s} className="flex items-center gap-1.5 capitalize"><span className={clsx('h-2 w-2 rounded-full', STATUS_DOT[s])} />{s === 'blank' ? 'Available' : s}</span>
                    ))}
                  </div>
                </div>
              )}
              {tab === 'orders' && (
                <div className="space-y-2 px-4 pb-4">
                  <div className="text-xs text-slate-500">Running dine-in orders</div>
                  {running.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No running orders</p>}
                  {running.map((o) => {
                    const t = tables.find((x) => x.id === o.tableId);
                    return (
                      <button key={o.id} onClick={() => t && setTableId(t.id)} className="glass flex w-full items-center justify-between rounded-3xl p-4 text-left">
                        <div>
                          <div className="text-[15px]">Table {t?.name || '—'}</div>
                          <div className="text-xs text-slate-500">{o.items.reduce((a, l) => a + l.qty, 0)} items · {minsAgo(o.createdAt)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-light">{inr(o.total)}</div>
                          <span className="flex items-center justify-end gap-1.5 text-[11px] text-slate-500"><span className={clsx('h-2 w-2 rounded-full', o.status === 'billed' ? 'bg-amber-500' : 'bg-brand-600')} />{o.status === 'billed' ? 'Billed' : 'Running'}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {tab === 'profile' && (
                <div className="px-4 pb-4">
                  <div className="glass rounded-3xl p-5 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/70 text-2xl font-light">{staff?.name[0]}</div>
                    <div className="mt-3 text-xl font-normal tracking-tight">{staff?.name}</div>
                    <div className="text-sm capitalize text-slate-500">{staff?.role} · {staff?.phone}</div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-2xl bg-white/55 p-3"><div className="text-2xl font-light">{mine.length}</div><div className="text-xs text-slate-500">Orders (24h)</div></div>
                      <div className="rounded-2xl bg-white/55 p-3"><div className="text-2xl font-light">{inr(mine.filter((o) => o.status !== 'cancelled').reduce((a, o) => a + o.total, 0))}</div><div className="text-xs text-slate-500">Sales (24h)</div></div>
                    </div>
                  </div>
                  <button onClick={logout} className={clsx('mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm text-red-600', soft)}><LogOut size={16} strokeWidth={1.6} /> Log out</button>
                </div>
              )}
            </div>
            <nav className="glass m-3 grid grid-cols-3 gap-1 rounded-3xl p-1.5">
              {([['tables', 'Tables', LayoutGrid], ['orders', 'Orders', ClipboardList], ['profile', 'Profile', User]] as const).map(([id, label, Icon]) => (
                <button key={id} onClick={() => setTab(id)} className={clsx('flex flex-col items-center gap-0.5 rounded-2xl py-2.5 text-[11px] transition', tab === id ? 'bg-black/[.08] text-slate-900' : 'text-slate-500')}>
                  <Icon size={18} strokeWidth={1.6} /> {label}
                </button>
              ))}
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
