import { Minus, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { inr } from '../lib/billing';
import { makeLine } from '../lib/cart';
import { useStore } from '../store/useStore';
import type { CartItem, MenuItem } from '../types';
import { clsx, VegMark } from './ui';

/** Customer-facing bottom sheet / dialog for choosing variation, add-ons and quantity. */
export default function CustomizeSheet({ item, basePrice, onAdd, onClose, large }: {
  item: MenuItem;
  basePrice?: number;
  onAdd: (l: CartItem) => void;
  onClose: () => void;
  large?: boolean;
}) {
  const groups = useStore((s) => s.addonGroups.filter((g) => item.addonGroupIds.includes(g.id)));
  const [vid, setVid] = useState(item.variations[0]?.id);
  const [addons, setAddons] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const v = item.variations.find((x) => x.id === vid);
  const chosen = groups.flatMap((g) => g.items).filter((a) => addons.includes(a.id));
  const unit = (v ? v.price : basePrice ?? item.price) + chosen.reduce((a, x) => a + x.price, 0);

  const toggle = (gid: string, aid: string) => {
    const g = groups.find((x) => x.id === gid)!;
    if (addons.includes(aid)) return setAddons(addons.filter((x) => x !== aid));
    if (addons.filter((x) => g.items.some((i) => i.id === x)).length >= g.max) return;
    setAddons([...addons, aid]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-neutral-500/30 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={clsx('flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#efefef]/95 shadow-[0_40px_80px_-30px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.8)] backdrop-blur-xl sm:rounded-3xl', large ? 'max-w-2xl' : 'max-w-md')}>
        <div className={clsx('relative mx-4 mt-4 flex items-center justify-center rounded-2xl bg-white/55', large ? 'h-48 text-8xl' : 'h-32 text-6xl')}>
          {item.image}
          <button onClick={onClose} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 text-slate-700 hover:bg-white"><X size={16} strokeWidth={1.6} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className={clsx('flex items-center gap-2 font-normal tracking-tight', large ? 'text-3xl' : 'text-xl')}><VegMark veg={item.veg} /> {item.name}</div>
          {item.description && <p className="mt-1 text-sm text-slate-500">{item.description}</p>}
          {item.variations.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-xs text-slate-500">Choose one</div>
              <div className="grid grid-cols-2 gap-2">
                {item.variations.map((x) => (
                  <button key={x.id} onClick={() => setVid(x.id)}
                    className={clsx('rounded-2xl p-3 text-left transition', large && 'p-4 text-lg', vid === x.id ? 'bg-white/90 shadow-[inset_0_0_0_1.5px_#1a9157]' : 'bg-white/50 hover:bg-white/75')}>
                    <div className="text-slate-900">{x.name}</div>
                    <div className="text-sm text-slate-500">{inr(x.price)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {groups.map((g) => (
            <div key={g.id} className="mt-5">
              <div className="mb-2 text-xs text-slate-500">{g.name} <span className="text-slate-400">· up to {g.max}</span></div>
              <div className="grid grid-cols-2 gap-2">
                {g.items.map((a) => (
                  <button key={a.id} onClick={() => toggle(g.id, a.id)}
                    className={clsx('flex items-center justify-between rounded-2xl p-3 text-sm transition', large && 'p-4 text-base', addons.includes(a.id) ? 'bg-white/90 shadow-[inset_0_0_0_1.5px_#1a9157]' : 'bg-white/50 hover:bg-white/75')}>
                    <span className="text-slate-900">{a.name}</span><span className="text-slate-500">+{inr(a.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 p-4 pt-2">
          <div className="flex items-center gap-2 rounded-2xl bg-white/60 px-2 py-1.5">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-1.5 text-slate-700"><Minus size={16} strokeWidth={1.6} /></button>
            <span className="w-6 text-center text-lg">{qty}</span>
            <button onClick={() => setQty(qty + 1)} className="p-1.5 text-slate-700"><Plus size={16} strokeWidth={1.6} /></button>
          </div>
          <button onClick={() => { onAdd({ ...makeLine(item, qty, v, chosen.map((a) => ({ name: a.name, price: a.price }))), unitPrice: unit }); onClose(); }}
            className={clsx('flex-1 rounded-2xl bg-brand-600 text-white shadow-[0_8px_20px_-10px_rgba(26,145,87,.8)] hover:bg-brand-700', large ? 'py-4 text-xl' : 'py-3')}>
            Add item · {inr(unit * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}
