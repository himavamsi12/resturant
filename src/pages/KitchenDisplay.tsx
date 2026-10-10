import { History, Maximize2, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx, IconButton, Toggle } from '../components/ui';
import { beep } from '../lib/cart';
import { useCrossTabSync, useTick } from '../lib/useCrossTabSync';
import { fmtTime } from '../lib/billing';
import { useStore } from '../store/useStore';
import type { Kot, KotStatus } from '../types';

const PLATFORM_LABEL: Record<Kot['platform'], string> = {
  swiggy: 'Swiggy', zomato: 'Zomato', website: 'Website', 'scan-order': 'QR Order', kiosk: 'Kiosk', pos: 'POS', captain: 'Captain',
};
const NEXT: Partial<Record<KotStatus, KotStatus>> = { new: 'preparing', preparing: 'ready', ready: 'served' };
const NEXT_LABEL: Partial<Record<KotStatus, string>> = { new: 'Start preparing', preparing: 'Mark ready', ready: 'Served' };

function elapsed(t: number) {
  const s = Math.floor((Date.now() - t) / 1000);
  return { mins: Math.floor(s / 60), label: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` };
}

function Ticket({ k, stationName }: { k: Kot; stationName: string }) {
  const setKotStatus = useStore((s) => s.setKotStatus);
  const { mins, label } = elapsed(k.createdAt);
  const done = k.status === 'served' || k.status === 'cancelled';
  const urgency = done ? 'bg-black/15' : mins > 20 ? 'bg-red-500' : mins > 10 ? 'bg-amber-500' : 'bg-brand-600';
  const next = NEXT[k.status];
  return (
    <div className={clsx('flex flex-col rounded-2xl bg-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]', done && 'opacity-70')}>
      <div className="mx-4 flex items-start justify-between gap-2 border-b border-black/[.06] py-3">
        <div>
          <div className="text-[17px] font-normal text-slate-900">{k.tableName || PLATFORM_LABEL[k.platform]}</div>
          <div className="text-[11px] text-slate-500">KOT #{k.kotNo} · {stationName}</div>
        </div>
        <div className="text-right">
          <div className={clsx('flex items-center justify-end gap-1.5 text-sm tabular-nums', !done && mins > 20 ? 'text-red-600' : !done && mins > 10 ? 'text-amber-700' : 'text-slate-700')}>
            <span className={clsx('h-2 w-2 rounded-full', urgency)} /> {label}
          </div>
          <div className="text-[11px] text-slate-400">{fmtTime(k.createdAt)}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 pt-2.5 text-[11px] text-slate-500">
        <span className="rounded-full bg-black/[.05] px-2 py-0.5 capitalize">{k.orderType}</span>
        <span className="rounded-full bg-black/[.05] px-2 py-0.5">{PLATFORM_LABEL[k.platform]}</span>
        {k.status === 'cancelled' && <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-red-700">Cancelled</span>}
      </div>
      <ul className="flex-1 space-y-1.5 px-4 py-3">
        {k.items.map((it, i) => (
          <li key={i} className="text-sm">
            <div className="flex gap-2 text-slate-800">
              <span className="w-6 shrink-0 text-slate-900">{it.qty}×</span>
              <span>{it.name}{it.variation && <span className="text-slate-400"> ({it.variation})</span>}</span>
            </div>
            {it.addons.length > 0 && <div className="ml-8 text-xs text-slate-500">+ {it.addons.join(', ')}</div>}
            {it.note && <div className="ml-8 text-xs italic text-amber-700">“{it.note}”</div>}
          </li>
        ))}
      </ul>
      <div className="flex gap-1.5 p-2.5 pt-0">
        {next && (
          <button onClick={() => setKotStatus(k.id, next)}
            className={clsx('flex-1 rounded-xl py-2.5 text-sm transition active:scale-[.98]',
              k.status === 'preparing' ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-white/80 text-slate-900 hover:bg-white')}>
            {NEXT_LABEL[k.status]}
          </button>
        )}
        {k.status === 'served' && (
          <button onClick={() => setKotStatus(k.id, 'ready')} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/80 py-2.5 text-sm text-slate-700 hover:bg-white">
            <RotateCcw size={14} strokeWidth={1.6} /> Recall
          </button>
        )}
        {(k.status === 'preparing' || k.status === 'ready') && (
          <button title="Move back" onClick={() => setKotStatus(k.id, k.status === 'ready' ? 'preparing' : 'new')} className="rounded-xl bg-white/60 px-3 text-slate-500 hover:bg-white hover:text-slate-900"><RotateCcw size={14} strokeWidth={1.6} /></button>
        )}
      </div>
    </div>
  );
}

export default function KitchenDisplay() {
  useCrossTabSync();
  useTick(15000);
  const kots = useStore((s) => s.kots);
  const stations = useStore((s) => s.stations);
  const [station, setStation] = useState('all');
  const [showServed, setShowServed] = useState(false);
  const [sound, setSound] = useState(true);

  const filtered = useMemo(() => kots.filter((k) => station === 'all' || k.station === station), [kots, station]);
  const cols: { id: KotStatus; title: string; color: string }[] = [
    { id: 'new', title: 'New', color: 'bg-sky-500' },
    { id: 'preparing', title: 'Preparing', color: 'bg-amber-500' },
    { id: 'ready', title: 'Ready', color: 'bg-brand-600' },
  ];
  const stationName = (id: string) => stations.find((s) => s.id === id)?.name || id;

  // ring on new KOTs
  const newCount = kots.filter((k) => k.status === 'new').length;
  const prev = useRef(newCount);
  useEffect(() => {
    if (sound && newCount > prev.current) beep(660, 0.15, 3);
    prev.current = newCount;
  }, [newCount, sound]);

  const served = filtered.filter((k) => k.status === 'served' || k.status === 'cancelled').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 40);

  return (
    <div className="flex min-h-full flex-col px-4 pb-10 pt-4 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-normal leading-tight tracking-tight text-slate-900">Kitchen</h1>
          <p className="mt-1 text-sm text-slate-500">Live KOTs across stations · bump to move tickets along</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 rounded-xl bg-white/50 px-3 py-2"><Toggle size="sm" checked={sound} onChange={setSound} label={<span className="text-xs text-slate-600">Sound</span>} /></span>
          <IconButton active={showServed} onClick={() => setShowServed(!showServed)} title="Served history"><History size={16} strokeWidth={1.6} /></IconButton>
          <IconButton onClick={() => document.documentElement.requestFullscreen?.()} title="Full screen"><Maximize2 size={16} strokeWidth={1.6} /></IconButton>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {[{ id: 'all', name: 'All stations' }, ...stations].map((s) => {
            const c = kots.filter((k) => (s.id === 'all' || k.station === s.id) && (k.status === 'new' || k.status === 'preparing')).length;
            return (
              <button key={s.id} onClick={() => setStation(s.id)}
                className={clsx('flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm transition', station === s.id ? 'bg-black/[.09] text-slate-900' : 'bg-white/45 text-slate-600 hover:bg-white/70')}>
                {s.name} {c > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[11px] text-white">{c}</span>}
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs text-slate-600">
          {cols.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5"><span className={clsx('h-2 w-2 rounded-full', c.color)} />{c.title} <span className="text-slate-900">{filtered.filter((k) => k.status === c.id).length}</span></span>
          ))}
        </div>
      </div>

      {showServed ? (
        <div className="glass rounded-3xl p-5">
          <div className="mb-4 border-b border-black/[.06] pb-4 text-[15px] text-slate-900">Served & cancelled</div>
          {served.length === 0 ? <p className="text-sm text-slate-500">Nothing served yet.</p> : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {served.map((k) => <Ticket key={k.id} k={k} stationName={stationName(k.station)} />)}
            </div>
          )}
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
          {cols.map((c) => {
            const list = filtered.filter((k) => k.status === c.id).sort((a, b) => a.createdAt - b.createdAt);
            return (
              <div key={c.id} className="glass flex min-h-[260px] flex-col rounded-3xl p-3">
                <div className="mx-2 mb-3 flex items-center justify-between border-b border-black/[.06] pb-3 pt-1">
                  <span className="flex items-center gap-2 text-[15px] text-slate-900"><span className={clsx('h-2 w-2 rounded-full', c.color)} />{c.title}</span>
                  <span className="text-xs text-slate-500">{list.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
                  {list.map((k) => <Ticket key={k.id} k={k} stationName={stationName(k.station)} />)}
                </div>
                {list.length === 0 && <div className="flex flex-1 items-center justify-center text-sm text-slate-400">No tickets</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
