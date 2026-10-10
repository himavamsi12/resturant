import { ArrowLeft, CreditCard, Loader2, Minus, Plus, ShoppingBag, Smartphone, Trash2, UtensilsCrossed } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import CustomizeSheet from '../components/CustomizeSheet';
import RestaurantPhoto from '../components/RestaurantPhoto';
import { clsx, VegMark } from '../components/ui';
import { computeTotals, inr } from '../lib/billing';
import { addToCart, changeQty, makeLine } from '../lib/cart';
import { useCrossTabSync } from '../lib/useCrossTabSync';
import { useStore } from '../store/useStore';
import type { CartItem, MenuItem } from '../types';

type Step = 'welcome' | 'type' | 'menu' | 'cart' | 'pay' | 'processing' | 'done';
const IDLE_MS = 60000;

/** Self-service ordering kiosk (touch screen). */
export default function Kiosk() {
  useCrossTabSync();
  const s = useStore();
  const [step, setStep] = useState<Step>('welcome');
  const [eatHere, setEatHere] = useState(true);
  const [cat, setCat] = useState(s.categories[0]?.id);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [custom, setCustom] = useState<MenuItem | null>(null);
  const [token, setToken] = useState<number>();
  const [mode, setMode] = useState<'upi' | 'card'>('upi');
  const last = useRef(Date.now());

  const reset = () => { setStep('welcome'); setCart([]); setCustom(null); setToken(undefined); };

  // idle timeout back to attract screen
  useEffect(() => {
    const bump = () => { last.current = Date.now(); };
    window.addEventListener('pointerdown', bump);
    const t = setInterval(() => {
      if (step !== 'welcome' && step !== 'processing' && Date.now() - last.current > (step === 'done' ? 15000 : IDLE_MS)) reset();
    }, 2000);
    return () => { window.removeEventListener('pointerdown', bump); clearInterval(t); };
  }, [step]);

  const packaging = eatHere ? 0 : s.settings.packagingCharge;
  const totals = computeTotals({ items: cart, packagingCharge: packaging }, 0, true);
  const count = cart.reduce((a, l) => a + l.qty, 0);
  const qtyOf = (id: string) => cart.filter((l) => l.itemId === id).reduce((a, l) => a + l.qty, 0);

  const tap = (m: MenuItem) => {
    if (!m.available) return;
    if (m.variations.length || m.addonGroupIds.length) setCustom(m);
    else setCart((c) => addToCart(c, makeLine(m)));
  };

  const pay = () => {
    setStep('processing');
    setTimeout(() => {
      const st = useStore.getState();
      const id = st.createOrder({ orderType: 'takeaway', platform: 'kiosk', items: cart, packagingCharge: packaging, note: eatHere ? 'Kiosk · Eat here' : 'Kiosk · Takeaway' });
      const o = useStore.getState().orders.find((x) => x.id === id)!;
      // settle first (it marks existing KOTs served), then fire KOTs so the kitchen/token board track them
      useStore.getState().settleOrder(id, [{ mode, amount: o.total }]);
      useStore.getState().sendKot(id);
      setToken(o.tokenNo);
      setCart([]);
      setStep('done');
      last.current = Date.now();
    }, 2200);
  };

  const soft = 'bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]';
  const Logo = () => (
    <svg width="38" height="38" viewBox="0 0 34 34" fill="none" aria-hidden>
      <circle cx="17" cy="17" r="13" stroke="#111" strokeWidth="5" />
      <path d="M17 4v13h13" stroke="#111" strokeWidth="5" />
    </svg>
  );

  if (step === 'welcome') {
    return (
      <button onClick={() => setStep('type')} className="flex min-h-screen w-full flex-col bg-[#d9d9d9] px-10 py-8 text-left text-slate-900">
        <div className="flex w-full items-center justify-between">
          <Logo />
          <span className="rounded-2xl bg-white/50 px-5 py-3 text-sm text-slate-600">Self-service kiosk</span>
        </div>
        <div className="mt-10">
          <h1 className="text-6xl font-normal tracking-tight">{s.settings.restaurantName}</h1>
          <p className="mt-2 text-2xl text-slate-500">Order here · skip the queue</p>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <RestaurantPhoto className="w-full max-w-[1000px]" />
        </div>
        <div className="flex w-full justify-center">
          <span className="flex items-center gap-3 rounded-2xl bg-brand-600 px-12 py-5 text-2xl text-white shadow-[0_14px_30px_-12px_rgba(26,145,87,.8)]">
            Touch to start <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
          </span>
        </div>
      </button>
    );
  }

  if (step === 'type') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#d9d9d9] p-8 text-slate-900">
        <h1 className="text-5xl font-normal tracking-tight">Where will you eat today?</h1>
        <p className="mt-2 text-xl text-slate-500">Choose one to continue</p>
        <div className="mt-12 grid w-full max-w-3xl grid-cols-2 gap-6">
          {[{ v: true, label: 'Eat here', icon: <UtensilsCrossed size={64} strokeWidth={1.2} /> }, { v: false, label: 'Take away', icon: <ShoppingBag size={64} strokeWidth={1.2} /> }].map((o) => (
            <button key={o.label} onClick={() => { setEatHere(o.v); setStep('menu'); }}
              className="glass flex aspect-square flex-col items-center justify-center gap-6 rounded-[2rem] text-3xl font-normal text-slate-900 transition hover:bg-white/70 active:scale-95">
              <span className="text-slate-800">{o.icon}</span>{o.label}
            </button>
          ))}
        </div>
        <button onClick={reset} className={clsx('mt-10 rounded-2xl px-8 py-4 text-lg text-slate-600', soft)}>Cancel</button>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#d9d9d9] text-slate-900">
        <div className="glass flex flex-col items-center rounded-[2rem] px-20 py-14">
          <Loader2 size={72} strokeWidth={1.2} className="animate-spin text-brand-600" />
          <h1 className="mt-6 text-4xl font-normal tracking-tight">{mode === 'upi' ? 'Waiting for UPI payment…' : 'Insert or tap your card…'}</h1>
          <p className="mt-2 text-2xl font-light text-slate-500">{inr(totals.total)}</p>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <button onClick={reset} className="flex min-h-screen w-full flex-col items-center justify-center bg-[#d9d9d9] p-8 text-slate-900">
        <div className="flex items-center gap-2 text-xl text-brand-700"><span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> Payment received — thank you!</div>
        <div className="glass mt-8 flex flex-col items-center rounded-[2.5rem] px-24 py-10">
          <div className="text-lg text-slate-500">Your token number</div>
          <div className="text-[170px] font-light leading-none tracking-tighter tabular-nums">{token}</div>
        </div>
        <div className="mt-8 text-2xl text-slate-600">Watch the screen and collect your order at the counter.</div>
        <div className="mt-10 text-base text-slate-400">Touch anywhere to start a new order</div>
      </button>
    );
  }

  if (step === 'pay') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#d9d9d9] p-8 text-slate-900">
        <div className="text-xl text-slate-500">Amount to pay</div>
        <h1 className="text-7xl font-light tracking-tight">{inr(totals.total)}</h1>
        <div className="mt-10 grid w-full max-w-3xl grid-cols-2 gap-6">
          {([['upi', 'UPI / QR', <Smartphone key="u" size={56} strokeWidth={1.2} />], ['card', 'Card', <CreditCard key="c" size={56} strokeWidth={1.2} />]] as const).map(([id, label, icon]) => (
            <button key={id} onClick={() => setMode(id)}
              className={clsx('flex flex-col items-center gap-4 rounded-[2rem] py-12 text-3xl font-normal transition',
                mode === id ? 'bg-white/85 shadow-[inset_0_0_0_2px_#1a9157]' : 'glass text-slate-700')}>
              {icon}{label}
            </button>
          ))}
        </div>
        {mode === 'upi' && (
          <div className="mt-8 flex flex-col items-center">
            <div className="grid h-48 w-48 grid-cols-8 gap-0.5 rounded-3xl bg-white/80 p-4">
              {Array.from({ length: 64 }, (_, i) => <span key={i} className={((i * 7) % 5 < 2 || i % 9 === 0) ? 'rounded-[2px] bg-slate-900' : ''} />)}
            </div>
            <p className="mt-3 text-lg text-slate-500">Scan with any UPI app · {s.settings.upiId}</p>
          </div>
        )}
        <div className="mt-10 flex gap-4">
          <button onClick={() => setStep('cart')} className={clsx('rounded-2xl px-10 py-5 text-2xl text-slate-700', soft)}>Back</button>
          <button onClick={pay} className="rounded-2xl bg-brand-600 px-16 py-5 text-2xl text-white shadow-[0_14px_30px_-12px_rgba(26,145,87,.8)]">Confirm payment</button>
        </div>
      </div>
    );
  }

  const cartPanel = (
    <div className="flex h-full flex-col">
      <div className="mx-5 border-b border-black/[.06] py-5">
        <div className="text-2xl font-normal tracking-tight">My order</div>
        <div className="text-sm text-slate-500">{eatHere ? 'Eat here' : 'Take away'}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {cart.length === 0 && <p className="py-16 text-center text-xl text-slate-400">Your tray is empty</p>}
        {cart.map((l) => (
          <div key={l.lineId} className="mb-2.5 rounded-2xl bg-white/55 p-4">
            <div className="flex justify-between text-lg"><span>{l.name}</span><span>{inr(l.qty * l.unitPrice)}</span></div>
            {(l.variation || l.addons.length > 0) && <div className="text-sm text-slate-500">{[l.variation, ...l.addons.map((a) => a.name)].filter(Boolean).join(', ')}</div>}
            <div className="mt-3 flex items-center gap-4">
              <button onClick={() => setCart((c) => changeQty(c, l.lineId, -1))} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80">{l.qty === 1 ? <Trash2 size={18} strokeWidth={1.6} /> : <Minus size={18} strokeWidth={1.6} />}</button>
              <span className="text-xl">{l.qty}</span>
              <button onClick={() => setCart((c) => changeQty(c, l.lineId, 1))} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80"><Plus size={18} strokeWidth={1.6} /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-1 p-5 text-lg">
        <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{inr(totals.subtotal, 2)}</span></div>
        {packaging > 0 && <div className="flex justify-between text-slate-500"><span>Packaging</span><span>{inr(packaging)}</span></div>}
        <div className="flex justify-between text-slate-500"><span>GST</span><span>{inr(totals.tax, 2)}</span></div>
        <div className="flex justify-between pt-2 text-3xl font-light tracking-tight"><span>Total</span><span>{inr(totals.total)}</span></div>
        <button disabled={!count} onClick={() => setStep('pay')} className="mt-3 w-full rounded-2xl bg-brand-600 py-5 text-2xl text-white shadow-[0_14px_30px_-12px_rgba(26,145,87,.8)] disabled:opacity-40">Checkout</button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen gap-4 bg-[#d9d9d9] p-4 text-slate-900">
      <aside className="flex w-48 shrink-0 flex-col gap-2 overflow-y-auto">
        <button onClick={reset} className={clsx('mb-2 flex items-center gap-2 rounded-2xl px-4 py-4 text-lg text-slate-600', soft)}><ArrowLeft size={20} strokeWidth={1.6} /> Cancel</button>
        {s.categories.filter((c) => c.active).map((c) => (
          <button key={c.id} onClick={() => { setCat(c.id); setStep('menu'); }}
            className={clsx('rounded-2xl px-4 py-5 text-left text-lg transition', cat === c.id && step === 'menu' ? 'bg-black/[.1] text-slate-900' : clsx(soft, 'text-slate-700'))}>
            {c.name}
          </button>
        ))}
      </aside>
      <main className="flex-1 overflow-y-auto px-2">
        <h1 className="mb-5 mt-2 text-5xl font-normal tracking-tight">{s.categories.find((c) => c.id === cat)?.name}</h1>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {s.menuItems.filter((m) => m.categoryId === cat).map((m) => (
            <button key={m.id} onClick={() => tap(m)} disabled={!m.available}
              className="glass relative flex flex-col overflow-hidden rounded-3xl p-3 text-left transition active:scale-95 disabled:opacity-40">
              <div className="flex h-36 items-center justify-center rounded-2xl bg-white/55 text-7xl">{m.image}</div>
              <div className="p-2 pt-4">
                <div className="flex items-center gap-2 text-xl"><VegMark veg={m.veg} /> {m.name}</div>
                <div className="mt-1 text-lg text-slate-500">{m.variations.length ? `from ${inr(Math.min(...m.variations.map((v) => v.price)))}` : inr(m.price)}</div>
              </div>
              {!m.available && <span className="absolute left-5 top-5 rounded-xl bg-white/90 px-3 py-1 text-sm text-slate-700">Sold out</span>}
              {qtyOf(m.id) > 0 && <span className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg text-white">{qtyOf(m.id)}</span>}
            </button>
          ))}
        </div>
      </main>
      <aside className={clsx('glass w-96 shrink-0 rounded-3xl', step === 'cart' ? 'block' : 'hidden lg:block')}>{cartPanel}</aside>
      {step === 'menu' && count > 0 && (
        <button onClick={() => setStep('cart')} className="fixed bottom-6 right-6 rounded-2xl bg-brand-600 px-8 py-5 text-2xl text-white shadow-[0_14px_30px_-12px_rgba(26,145,87,.8)] lg:hidden">
          View order ({count}) · {inr(totals.total)}
        </button>
      )}
      {custom && <CustomizeSheet large item={custom} onClose={() => setCustom(null)} onAdd={(l) => setCart((c) => addToCart(c, l))} />}
    </div>
  );
}
