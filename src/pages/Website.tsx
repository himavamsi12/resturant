import { Bike, Check, ChefHat, Clock, Loader2, Lock, MapPin, Minus, Phone, Plus, ShoppingBag, Star, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import CustomizeSheet from '../components/CustomizeSheet';
import RestaurantPhoto from '../components/RestaurantPhoto';
import { clsx, VegMark } from '../components/ui';
import { inr, uid } from '../lib/billing';
import { addToCart, changeQty, makeLine } from '../lib/cart';
import { useCrossTabSync } from '../lib/useCrossTabSync';
import { useOutlet, useStore } from '../store/useStore';
import type { CartItem, MenuItem, OnlineOrderStatus } from '../types';

const TRACK_KEY = 'dineflow-website-track';
const STEPS: { s: OnlineOrderStatus[]; label: string; icon: JSX.Element }[] = [
  { s: ['placed'], label: 'Order placed', icon: <Check size={17} strokeWidth={1.6} /> },
  { s: ['accepted', 'preparing'], label: 'Preparing', icon: <ChefHat size={18} /> },
  { s: ['ready'], label: 'Ready · rider assigned', icon: <ShoppingBag size={18} /> },
  { s: ['picked-up'], label: 'Out for delivery', icon: <Bike size={18} /> },
  { s: ['delivered'], label: 'Delivered', icon: <Check size={18} /> },
];

function Tracker({ id, onClose }: { id: string; onClose: () => void }) {
  const o = useStore((s) => s.onlineOrders.find((x) => x.id === id));
  if (!o) return null;
  const idx = STEPS.findIndex((st) => st.s.includes(o.status));
  const failed = o.status === 'rejected' || o.status === 'cancelled';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-500/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-[#efefef]/95 p-6 shadow-[0_40px_80px_-30px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.8)] backdrop-blur-xl">
        <div className="flex items-start justify-between border-b border-black/[.06] pb-4">
          <div>
            <div className="text-xs text-slate-500">Order #{o.platformOrderId}</div>
            <h2 className="text-xl font-normal tracking-tight">{failed ? 'Order could not be fulfilled' : o.status === 'delivered' ? 'Enjoy your meal! 🎉' : 'Tracking your order'}</h2>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/60 hover:bg-white/90"><X size={16} strokeWidth={1.6} /></button>
        </div>
        {failed ? (
          <p className="mt-4 rounded-2xl bg-white/55 p-4 text-sm text-red-700">Sorry, the restaurant couldn’t accept your order. {o.instructions?.startsWith('Rejected') && o.instructions} A full refund has been initiated.</p>
        ) : (
          <ol className="mt-6 space-y-4">
            {STEPS.map((st, i) => (
              <li key={st.label} className="flex items-center gap-3">
                <span className={clsx('flex h-10 w-10 items-center justify-center rounded-xl', i < idx ? 'bg-white/80 text-brand-700' : i === idx ? 'bg-brand-600 text-white' : 'bg-white/40 text-slate-400')}>{st.icon}</span>
                <span className={clsx(i <= idx ? 'text-slate-900' : 'text-slate-400')}>{st.label}</span>
                {i === 1 && idx === 1 && <span className="ml-auto text-xs text-slate-500"><Clock size={12} className="inline" /> ~{o.prepTime} min</span>}
              </li>
            ))}
          </ol>
        )}
        {o.rider && !failed && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/55 p-3 text-sm text-slate-800">
            <Bike size={18} strokeWidth={1.6} /> <div><span className="text-slate-900">{o.rider.name}</span> is your delivery partner<div className="text-xs">{o.rider.phone}</div></div>
          </div>
        )}
        <div className="mt-5 border-t border-black/[.06] pt-3 text-sm text-slate-600">
          {o.items.map((it, i) => <div key={i} className="flex justify-between"><span>{it.qty}× {it.name}</span><span>{inr(it.qty * it.price)}</span></div>)}
          <div className="mt-1 flex justify-between text-slate-900"><span>Paid</span><span>{inr(o.total)}</span></div>
        </div>
      </div>
    </div>
  );
}

/** Restaurant's own website with commission-free online ordering. */
export default function Website() {
  useCrossTabSync();
  const s = useStore();
  const outlet = useOutlet();
  const open = s.settings.storeOnline.website;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [custom, setCustom] = useState<MenuItem | null>(null);
  const [vegOnly, setVegOnly] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '', note: '' });
  const [paying, setPaying] = useState(false);
  const [trackId, setTrackId] = useState<string | null>(() => { try { return localStorage.getItem(TRACK_KEY); } catch { return null; } });
  const [showTrack, setShowTrack] = useState(false);

  const price = (m: MenuItem) => m.onlinePrice || m.price;
  const cats = s.categories.filter((c) => c.active);
  const visible = useMemo(() => s.menuItems.filter((m) => m.onlineAvailable.website && (!vegOnly || m.veg)), [s.menuItems, vegOnly]);
  const count = cart.reduce((a, l) => a + l.qty, 0);
  const subtotal = cart.reduce((a, l) => a + l.qty * l.unitPrice, 0);
  const tax = Math.round(subtotal * 0.05);
  const packaging = cart.length ? s.settings.packagingCharge : 0;
  const delivery = cart.length ? s.settings.deliveryCharge : 0;
  const total = subtotal + tax + packaging + delivery;
  const tracked = s.onlineOrders.find((o) => o.id === trackId);
  const avg = s.feedbacks.length ? s.feedbacks.reduce((a, f) => a + f.rating, 0) / s.feedbacks.length : 4.5;

  const add = (m: MenuItem) => {
    if (!open || !m.available) return;
    if (m.variations.length || m.addonGroupIds.length) return setCustom(m);
    setCart((c) => addToCart(c, { ...makeLine(m), unitPrice: price(m) }));
  };

  const placeOrder = () => {
    if (!form.name.trim() || !/^\d{10}$/.test(form.phone) || !form.address.trim()) return s.toast('Please fill name, 10-digit phone and address', 'error');
    setPaying(true);
    setTimeout(() => {
      const id = uid('on');
      s.findOrCreateCustomer(form.phone, form.name);
      s.addOnlineOrder({
        id, platform: 'website', customerName: form.name, customerPhone: form.phone, address: form.address,
        items: cart.map((l) => ({ itemId: l.itemId, name: l.name + (l.variation ? ` (${l.variation})` : ''), qty: l.qty, price: l.unitPrice })),
        subtotal, tax, packaging: packaging + delivery, total, paymentType: 'prepaid', commission: 0, instructions: form.note || undefined,
      });
      try { localStorage.setItem(TRACK_KEY, id); } catch { /* ignore */ }
      setTrackId(id);
      setCart([]);
      setPaying(false);
      setCheckout(false);
      setDrawer(false);
      setShowTrack(true);
    }, 2000);
  };

  const soft = 'bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]';
  const scrollTo = (id: string) => (e: React.MouseEvent) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };

  return (
    <div className="min-h-screen bg-[#d9d9d9] text-slate-900">
      <nav className="sticky top-0 z-30 bg-[#d9d9d9]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <a href="#/website" className="flex items-center gap-2.5">
            <svg width="32" height="32" viewBox="0 0 34 34" fill="none" aria-hidden>
              <circle cx="17" cy="17" r="13" stroke="#111" strokeWidth="5" />
              <path d="M17 4v13h13" stroke="#111" strokeWidth="5" />
            </svg>
            <span className="hidden text-[15px] font-medium tracking-tight sm:inline">{s.settings.restaurantName}</span>
          </a>
          <div className="mx-auto hidden gap-1.5 md:flex">
            {[['menu', 'Menu'], ['about', 'About'], ['contact', 'Contact']].map(([id, l]) => (
              <a key={id} href="#/website" onClick={scrollTo(id)} className={clsx('rounded-2xl px-5 py-3 text-sm text-slate-700 hover:bg-white/80', soft)}>{l}</a>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {tracked && <button onClick={() => setShowTrack(true)} className={clsx('rounded-2xl px-4 py-3 text-sm text-slate-800', soft)}>Track order</button>}
            <button onClick={() => setDrawer(true)} className="flex items-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm text-white shadow-[0_8px_20px_-10px_rgba(26,145,87,.8)]">
              <ShoppingBag size={16} strokeWidth={1.6} /> Cart {count > 0 && <span className="rounded-full bg-white/25 px-1.5 text-xs">{count}</span>}
            </button>
          </div>
        </div>
      </nav>

      {!open && <div className="mx-auto mt-2 flex max-w-6xl items-center gap-2 px-4 text-sm text-slate-600"><span className="h-2 w-2 rounded-full bg-slate-500" /> Online ordering is closed right now — you can still browse the menu.</div>}

      <header className="mx-auto grid max-w-6xl items-center gap-6 px-4 pb-6 pt-10 lg:grid-cols-[1fr_320px]">
        <div>
          <h1 className="text-[40px] font-normal leading-tight tracking-tight sm:text-[52px]">{s.settings.restaurantName}</h1>
          <p className="mt-1 text-[15px] text-slate-500">North Indian, tandoor & wood-fired pizzas · {outlet.name.split('–')[1]?.trim() || outlet.address}</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/50 px-3 py-1.5 text-xs text-slate-600">
            <Star size={13} strokeWidth={1.6} className="fill-brand-600 text-brand-600" /> {avg.toFixed(1)} · {s.feedbacks.length}+ reviews
          </div>
          <RestaurantPhoto className="mt-4 w-full max-w-[760px]" />
        </div>
        <div className="glass rounded-3xl p-5">
          <div className="border-b border-black/[.06] pb-4">
            <div className="text-[15px]">Order direct</div>
            <div className="text-xs text-slate-500">No platform fees · earn loyalty points</div>
          </div>
          <div className="mt-3 space-y-1.5">
            {[[<Clock key="c" size={16} strokeWidth={1.6} />, `Open ${s.settings.businessHours.open} – ${s.settings.businessHours.close}`], [<Bike key="b" size={16} strokeWidth={1.6} />, `Delivery ${inr(s.settings.deliveryCharge)} · ~${s.settings.defaultPrepTime + 15} min`], [<MapPin key="m" size={16} strokeWidth={1.6} />, outlet.address]].map(([icon, t], i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl bg-white/55 px-4 py-3 text-sm text-slate-700">{icon}<span className="truncate">{t}</span></div>
            ))}
          </div>
          <button onClick={() => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })} className="mt-4 w-full rounded-2xl bg-brand-600 py-3.5 text-sm text-white shadow-[0_8px_20px_-10px_rgba(26,145,87,.8)]">Order now</button>
        </div>
      </header>

      <section id="menu" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[32px] font-normal tracking-tight">Menu</h2>
            <p className="text-sm text-slate-500">Freshly made, delivered hot</p>
          </div>
          <button onClick={() => setVegOnly(!vegOnly)} className={clsx('flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm', vegOnly ? 'bg-black/[.1] text-slate-900' : clsx(soft, 'text-slate-600'))}>
            <span className={clsx('h-2 w-2 rounded-full', vegOnly ? 'bg-brand-600' : 'bg-black/20')} /> Veg only
          </button>
        </div>
        <div className="no-scrollbar mb-8 flex gap-1.5 overflow-x-auto pb-1">
          {cats.map((c) => (
            <a key={c.id} href="#/website" onClick={(e) => { e.preventDefault(); document.getElementById(`cat-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              className={clsx('shrink-0 rounded-2xl px-4 py-2.5 text-sm text-slate-700 hover:bg-white/80', soft)}>{c.name}</a>
          ))}
        </div>
        {cats.map((c) => {
          const list = visible.filter((m) => m.categoryId === c.id);
          if (!list.length) return null;
          return (
            <div key={c.id} id={`cat-${c.id}`} className="mb-10 scroll-mt-24">
              <h3 className="mb-4 text-xl font-normal tracking-tight">{c.name}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((m) => {
                  const q = cart.filter((l) => l.itemId === m.id).reduce((a, l) => a + l.qty, 0);
                  return (
                    <div key={m.id} className={clsx('glass flex gap-4 rounded-3xl p-3', !m.available && 'opacity-50')}>
                      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-white/55 text-5xl">{m.image}</div>
                      <div className="flex flex-1 flex-col py-1">
                        <div className="flex items-center gap-1.5 text-[15px]"><VegMark veg={m.veg} /> {m.name}</div>
                        <div className="text-sm text-slate-500">{m.variations.length ? `from ${inr(Math.min(...m.variations.map((v) => v.price)))}` : inr(price(m))}</div>
                        <div className="mt-auto pt-2">
                          {!m.available ? <span className="text-xs text-slate-500">Sold out</span> : (
                            <button disabled={!open} onClick={() => add(m)}
                              className={clsx('rounded-xl px-4 py-1.5 text-sm transition disabled:opacity-50', q > 0 ? 'bg-brand-600 text-white' : 'bg-white/70 text-slate-800 hover:bg-white')}>
                              {q > 0 ? `Added · ${q}` : 'Add +'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section id="about" className="mx-auto grid max-w-6xl scroll-mt-20 gap-4 px-4 pb-12 md:grid-cols-3">
        <div className="glass rounded-3xl p-6 md:col-span-2">
          <h2 className="text-[28px] font-normal tracking-tight">About us</h2>
          <p className="mt-3 text-slate-600">Since 2015 we’ve been serving slow-cooked dals, smoky tandoor kebabs and hand-stretched pizzas to Bengaluru. Every dish is made fresh in our kitchen with ingredients sourced daily from local farms.</p>
        </div>
        <div className="space-y-4">
          {s.feedbacks.filter((f) => f.rating >= 5).slice(0, 2).map((f) => (
            <div key={f.id} className="glass rounded-3xl p-5">
              <div className="flex gap-0.5 text-brand-600">{Array.from({ length: f.rating }, (_, i) => <Star key={i} size={13} strokeWidth={1.6} className="fill-brand-600" />)}</div>
              <p className="mt-2 text-sm text-slate-700">“{f.comment}”</p>
              <p className="mt-1 text-xs text-slate-400">— {f.customerName}</p>
            </div>
          ))}
        </div>
      </section>

      <footer id="contact" className="mx-auto max-w-6xl px-4 pb-10">
        <div className="glass grid gap-6 rounded-3xl p-6 md:grid-cols-3">
          <div><div className="text-[15px]">{s.settings.restaurantName}</div><p className="mt-1 text-xs text-slate-500">FSSAI {outlet.fssai}</p></div>
          <div className="space-y-1.5 text-sm text-slate-600">
            <div className="flex items-center gap-2"><MapPin size={15} strokeWidth={1.6} /> {outlet.address}</div>
            <div className="flex items-center gap-2"><Phone size={15} strokeWidth={1.6} /> {outlet.phone}</div>
          </div>
          <div className="text-sm text-slate-600"><div className="flex items-center gap-2"><Clock size={15} strokeWidth={1.6} /> Open daily {s.settings.businessHours.open} – {s.settings.businessHours.close}</div></div>
        </div>
        <div className="py-4 text-center text-xs text-slate-500">© {new Date().getFullYear()} {s.settings.restaurantName} · Powered by DineFlow</div>
      </footer>

      {drawer && (
        <div className="fixed inset-0 z-40 flex justify-end bg-neutral-500/30 p-3 backdrop-blur-sm" onClick={() => setDrawer(false)}>
          <div onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-md flex-col rounded-3xl bg-[#efefef]/95 shadow-[0_40px_80px_-30px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.8)] backdrop-blur-xl">
            <div className="mx-5 flex items-center justify-between border-b border-black/[.06] py-4">
              <div>
                <h2 className="text-[17px] font-normal">{checkout ? 'Checkout' : 'Your cart'}</h2>
                <div className="text-xs text-slate-500">{count} item{count === 1 ? '' : 's'}</div>
              </div>
              <button onClick={() => { setDrawer(false); setCheckout(false); }} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/60 hover:bg-white/90"><X size={16} strokeWidth={1.6} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 && <p className="py-16 text-center text-slate-400">Your cart is empty</p>}
              {!checkout && cart.map((l) => (
                <div key={l.lineId} className="mb-1.5 flex items-center gap-3 rounded-2xl bg-white/55 px-4 py-3 text-sm">
                  <div className="flex-1"><div className="text-slate-900">{l.name}</div>{(l.variation || l.addons.length > 0) && <div className="text-xs text-slate-400">{[l.variation, ...l.addons.map((a) => a.name)].filter(Boolean).join(', ')}</div>}</div>
                  <div className="flex items-center gap-2 rounded-xl bg-white/70 px-2 py-1">
                    <button onClick={() => setCart((c) => changeQty(c, l.lineId, -1))}><Minus size={14} strokeWidth={1.6} /></button><span className="w-4 text-center">{l.qty}</span>
                    <button onClick={() => setCart((c) => changeQty(c, l.lineId, 1))}><Plus size={14} strokeWidth={1.6} /></button>
                  </div>
                  <span className="w-16 text-right">{inr(l.qty * l.unitPrice)}</span>
                </div>
              ))}
              {checkout && (
                <div className="space-y-3">
                  {(['name', 'phone', 'address', 'note'] as const).map((k) => (
                    <label key={k} className="block">
                      <span className="mb-1.5 block text-xs capitalize text-slate-500">{k === 'note' ? 'Cooking instructions (optional)' : k}</span>
                      {k === 'address' || k === 'note'
                        ? <textarea rows={k === 'address' ? 3 : 2} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="w-full rounded-xl bg-white/60 px-3.5 py-2.5 text-sm outline-none focus:bg-white/90 focus:shadow-[inset_0_0_0_1.5px_#1a9157]" />
                        : <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: k === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value })} className="w-full rounded-xl bg-white/60 px-3.5 py-2.5 text-sm outline-none focus:bg-white/90 focus:shadow-[inset_0_0_0_1.5px_#1a9157]" />}
                    </label>
                  ))}
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="space-y-1 p-5 pt-2 text-sm">
                <div className="flex justify-between text-slate-500"><span>Item total</span><span>{inr(subtotal)}</span></div>
                <div className="flex justify-between text-slate-500"><span>Packaging</span><span>{inr(packaging)}</span></div>
                <div className="flex justify-between text-slate-500"><span>Delivery</span><span>{inr(delivery)}</span></div>
                <div className="flex justify-between text-slate-500"><span>GST</span><span>{inr(tax)}</span></div>
                <div className="flex justify-between pt-1 text-2xl font-light tracking-tight"><span>To pay</span><span>{inr(total)}</span></div>
                {!checkout ? (
                  <button disabled={!open} onClick={() => setCheckout(true)} className="mt-3 w-full rounded-2xl bg-brand-600 py-3.5 text-white shadow-[0_8px_20px_-10px_rgba(26,145,87,.8)] disabled:opacity-50">{open ? 'Proceed to checkout' : 'Store closed'}</button>
                ) : (
                  <button disabled={paying || !open} onClick={placeOrder} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-white shadow-[0_8px_20px_-10px_rgba(26,145,87,.8)] disabled:opacity-60">
                    {paying ? <><Loader2 size={18} className="animate-spin" /> Processing payment…</> : <><Lock size={15} strokeWidth={1.6} /> Pay {inr(total)} securely</>}
                  </button>
                )}
                {checkout && <p className="pt-1 text-center text-[11px] text-slate-400">Secured by Razorpay (simulated) · UPI, cards, netbanking</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {custom && <CustomizeSheet item={custom} basePrice={price(custom)} onClose={() => setCustom(null)} onAdd={(l) => setCart((c) => addToCart(c, l))} />}
      {showTrack && trackId && <Tracker id={trackId} onClose={() => setShowTrack(false)} />}
    </div>
  );
}
