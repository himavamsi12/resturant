import { useEffect, useMemo, useRef } from 'react';
import { startOfDay } from '../lib/billing';
import { beep } from '../lib/cart';
import { useCrossTabSync, useTick } from '../lib/useCrossTabSync';
import { useStore } from '../store/useStore';

/** Customer-facing queue screen: tokens being prepared vs ready for pickup. */
export default function TokenDisplay() {
  useCrossTabSync();
  useTick(1000);
  const orders = useStore((s) => s.orders);
  const kots = useStore((s) => s.kots);
  const name = useStore((s) => s.settings.restaurantName);

  const { preparing, ready } = useMemo(() => {
    const today = startOfDay();
    const preparing: number[] = [];
    const ready: number[] = [];
    orders
      .filter((o) => o.tokenNo && o.orderType !== 'dine-in' && o.createdAt >= today && o.status !== 'cancelled')
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach((o) => {
        const ks = kots.filter((k) => k.orderId === o.id && k.status !== 'cancelled');
        if (!ks.length) return; // not yet sent to kitchen
        if (ks.every((k) => k.status === 'served')) return; // collected
        if (ks.every((k) => k.status === 'ready' || k.status === 'served')) ready.push(o.tokenNo!);
        else preparing.push(o.tokenNo!);
      });
    return { preparing, ready };
  }, [orders, kots]);

  const prevReady = useRef(ready.length);
  useEffect(() => {
    if (ready.length > prevReady.current) beep(1046, 0.25, 2);
    prevReady.current = ready.length;
  }, [ready.length]);

  const now = new Date();
  const latest = ready.at(-1);

  return (
    <div className="flex min-h-screen flex-col bg-[#d9d9d9] text-slate-900">
      <header className="flex items-center justify-between px-10 pb-4 pt-8">
        <div className="flex items-center gap-4">
          <svg width="40" height="40" viewBox="0 0 34 34" fill="none" aria-hidden>
            <circle cx="17" cy="17" r="13" stroke="#111" strokeWidth="5" />
            <path d="M17 4v13h13" stroke="#111" strokeWidth="5" />
          </svg>
          <div>
            <div className="text-3xl font-normal tracking-tight">{name}</div>
            <div className="text-sm text-slate-500">Order status</div>
          </div>
        </div>
        <div className="glass rounded-3xl px-6 py-3 text-right">
          <div className="text-4xl font-light tabular-nums tracking-tight">{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          <div className="text-xs text-slate-500">{now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 px-10 pb-8 md:grid-cols-2">
        <section className="glass flex flex-col rounded-3xl p-8">
          <div className="mb-6 flex items-center justify-between border-b border-black/[.06] pb-5">
            <h2 className="text-3xl font-normal tracking-tight">Preparing</h2>
            <span className="flex items-center gap-2 text-sm text-slate-500"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-slate-400" /> {preparing.length} in kitchen</span>
          </div>
          <div className="grid grid-cols-3 gap-4 lg:grid-cols-4">
            {preparing.map((t) => (
              <div key={t} className="flex aspect-square items-center justify-center rounded-2xl bg-white/55 text-6xl font-light tabular-nums tracking-tight text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]">{t}</div>
            ))}
          </div>
          {preparing.length === 0 && <p className="m-auto text-lg text-slate-400">No orders in preparation</p>}
        </section>

        <section className="glass flex flex-col rounded-3xl p-8">
          <div className="mb-6 flex items-center justify-between border-b border-black/[.06] pb-5">
            <h2 className="text-3xl font-normal tracking-tight">Ready for pickup</h2>
            <span className="flex items-center gap-2 text-sm text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> {ready.length} ready</span>
          </div>
          {latest !== undefined && (
            <div className="mb-6 flex items-center justify-between rounded-3xl bg-white/80 px-8 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
              <div>
                <div className="text-sm text-slate-500">Now serving</div>
                <div className="mt-1 flex items-center gap-2 text-sm text-brand-700"><span className="h-2 w-2 rounded-full bg-brand-600" /> Please collect at counter</div>
              </div>
              <div className="text-[110px] font-light leading-none tabular-nums tracking-tighter text-slate-900">{latest}</div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4 lg:grid-cols-4">
            {ready.slice(0, -1).reverse().map((t) => (
              <div key={t} className="relative flex aspect-square items-center justify-center rounded-2xl bg-white/70 text-6xl font-light tabular-nums tracking-tight text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
                {t}
                <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-brand-600" />
              </div>
            ))}
          </div>
          {ready.length === 0 && <p className="m-auto text-lg text-slate-400">Nothing ready yet</p>}
        </section>
      </div>
      <footer className="pb-6 text-center text-sm text-slate-500">Please collect your order from the counter when your token number appears under “Ready”.</footer>
    </div>
  );
}
