import { Bike, MapPin, Phone, Plus, Power, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, clsx, Empty, Modal, PageHeader, SearchInput, Select, Tabs, Toggle, VegMark } from '../components/ui';
import { inr, minsAgo } from '../lib/billing';
import { beep } from '../lib/cart';
import { useCrossTabSync, useTick } from '../lib/useCrossTabSync';
import { useStore } from '../store/useStore';
import type { OnlineOrder, OnlineOrderStatus } from '../types';

type P = OnlineOrder['platform'];
const PLATFORM_STYLE: Record<P, { label: string; dot: string }> = {
  swiggy: { label: 'Swiggy', dot: 'bg-orange-500' },
  zomato: { label: 'Zomato', dot: 'bg-red-500' },
  website: { label: 'Website', dot: 'bg-sky-500' },
};

type TabId = 'new' | 'preparing' | 'ready' | 'picked-up' | 'delivered' | 'rejected';
const TAB_STATUSES: Record<TabId, OnlineOrderStatus[]> = {
  new: ['placed'],
  preparing: ['accepted', 'preparing'],
  ready: ['ready'],
  'picked-up': ['picked-up'],
  delivered: ['delivered'],
  rejected: ['rejected', 'cancelled'],
};
const REJECT_REASONS = ['Item out of stock', 'Kitchen too busy', 'Outlet closing soon', 'Address not serviceable', 'Other'];

function Countdown({ o }: { o: OnlineOrder }) {
  // prep timer starts when accepted; approximate from createdAt
  const due = o.createdAt + o.prepTime * 60000;
  const left = Math.round((due - Date.now()) / 60000);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span className={clsx('h-2 w-2 rounded-full', left < 0 ? 'bg-red-500' : left < 5 ? 'bg-amber-500' : 'bg-brand-600')} /> {left < 0 ? `${-left} min late` : `${left} min left`}
    </span>
  );
}

function OrderCard({ o, onAccept, onReject }: { o: OnlineOrder; onAccept: () => void; onReject: () => void }) {
  const setStatus = useStore((s) => s.setOnlineStatus);
  const toast = useStore((s) => s.toast);
  const ps = PLATFORM_STYLE[o.platform];
  return (
    <div className={clsx('glass flex flex-col rounded-3xl', o.status === 'placed' && 'shadow-[inset_0_0_0_1.5px_#1a9157] animate-[pulse_2s_ease-in-out_3]')}>
      <div className="mx-5 flex items-center justify-between gap-2 border-b border-black/[.06] py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-xs text-slate-800"><span className={clsx('h-2 w-2 rounded-full', ps.dot)} />{ps.label}</span>
          <span className="text-sm tracking-wide text-slate-900">#{o.platformOrderId}</span>
        </div>
        <span className="text-xs text-slate-400">{minsAgo(o.createdAt)}</span>
      </div>
      <div className="space-y-3 px-5 py-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-slate-900">{o.customerName}</div>
            <div className="flex items-center gap-1 text-xs text-slate-500"><Phone size={11} strokeWidth={1.6} /> {o.customerPhone}</div>
          </div>
          <div className="flex items-center gap-3">
            <Badge color={o.paymentType === 'prepaid' ? 'green' : 'yellow'}>{o.paymentType === 'prepaid' ? 'Prepaid' : 'Cash on delivery'}</Badge>
            {(o.status === 'accepted' || o.status === 'preparing') && <Countdown o={o} />}
          </div>
        </div>
        <div className="flex items-start gap-1 text-xs text-slate-500"><MapPin size={12} strokeWidth={1.6} className="mt-0.5 shrink-0" /> {o.address}</div>
        <ul className="divide-y divide-black/[.05] rounded-2xl bg-white/55 px-4">
          {o.items.map((it, i) => (
            <li key={i} className="flex justify-between py-2">
              <span className="text-slate-800"><span className="text-slate-900">{it.qty}×</span> {it.name}</span>
              <span className="text-slate-600">{inr(it.qty * it.price)}</span>
            </li>
          ))}
        </ul>
        {o.instructions && <div className="flex items-center gap-2 rounded-xl bg-white/45 px-3 py-2 text-xs text-slate-600"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{o.instructions}</div>}
        <div className="flex justify-between text-xs text-slate-500">
          <span>Subtotal {inr(o.subtotal)} · Pkg {inr(o.packaging)} · Tax {inr(o.tax)}</span>
          <span className="text-[22px] font-light tracking-tight text-slate-900">{inr(o.total)}</span>
        </div>
        {o.rider && (
          <div className="flex items-center gap-2 rounded-xl bg-white/55 px-3 py-2 text-xs text-slate-600">
            <Bike size={14} strokeWidth={1.6} /> <span className="text-slate-900">{o.rider.name}</span> · {o.rider.phone} · <span className="capitalize">{o.rider.provider}</span>
            <span className="ml-auto">{o.status === 'ready' ? 'Arriving' : o.status === 'picked-up' ? 'On the way' : o.status === 'delivered' ? 'Delivered' : ''}</span>
          </div>
        )}
      </div>
      <div className="mt-auto flex gap-2 px-5 pb-5">
        {o.status === 'placed' && <>
          <Button variant="danger" className="flex-1" onClick={onReject}>Reject</Button>
          <Button variant="success" className="flex-[2]" onClick={onAccept}>Accept</Button>
        </>}
        {(o.status === 'accepted' || o.status === 'preparing') && (
          <Button className="flex-1" onClick={() => { setStatus(o.id, 'ready'); toast('Food marked ready · rider assigned'); }}>Mark food ready</Button>
        )}
        {o.status === 'ready' && <Button variant="outline" className="flex-1" onClick={() => setStatus(o.id, 'picked-up')}><Bike size={16} strokeWidth={1.6} /> Picked up by rider</Button>}
        {o.status === 'picked-up' && <Button variant="success" className="flex-1" onClick={() => { setStatus(o.id, 'delivered'); toast('Order delivered & settled'); }}>Mark delivered</Button>}
        {(o.status === 'delivered' || o.status === 'rejected' || o.status === 'cancelled') && (
          <div className="flex-1 py-1 text-center text-xs capitalize text-slate-500">{o.status}</div>
        )}
      </div>
    </div>
  );
}

function OnlineMenu() {
  const items = useStore((s) => s.menuItems);
  const cats = useStore((s) => s.categories);
  const toggle = useStore((s) => s.toggleItemOnline);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const list = items.filter((m) => (cat === 'all' || m.categoryId === cat) && (m.name.toLowerCase().includes(q.toLowerCase()) || m.shortCode.toLowerCase() === q.toLowerCase()));
  const plats: P[] = ['swiggy', 'zomato', 'website'];
  return (
    <Card>
      <div className="mx-5 flex flex-wrap items-center gap-2 border-b border-black/[.06] py-4">
        <SearchInput value={q} onChange={setQ} placeholder="Search item or shortcode" />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="!w-48">
          <option value="all">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <div className="ml-auto flex gap-2">
          {plats.map((p) => (
            <Button key={p} size="sm" variant="outline" onClick={() => list.filter((m) => !m.onlineAvailable[p]).forEach((m) => toggle(m.id, p))}>All on · {PLATFORM_STYLE[p].label}</Button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/[.06] text-left text-xs text-slate-500">
              <th className="px-5 py-3 font-normal">Item</th><th className="px-5 py-3 font-normal">Category</th><th className="px-5 py-3 font-normal">POS price</th><th className="px-5 py-3 font-normal">Online price</th>
              {plats.map((p) => <th key={p} className="px-5 py-3 font-normal"><span className="flex items-center gap-1.5"><span className={clsx('h-2 w-2 rounded-full', PLATFORM_STYLE[p].dot)} />{PLATFORM_STYLE[p].label}</span></th>)}
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id} className="border-b border-black/[.04] last:border-0 hover:bg-white/40">
                <td className="px-5 py-3"><div className="flex items-center gap-2"><VegMark veg={m.veg} /> <span className="text-slate-900">{m.name}</span> {!m.available && <Badge color="red">Out of stock</Badge>}</div></td>
                <td className="px-5 py-3 text-slate-500">{cats.find((c) => c.id === m.categoryId)?.name}</td>
                <td className="px-5 py-3">{inr(m.price)}</td>
                <td className="px-5 py-3 text-slate-900">{inr(m.onlinePrice || m.price)}</td>
                {plats.map((p) => <td key={p} className="px-5 py-3"><Toggle size="sm" checked={m.onlineAvailable[p]} onChange={() => toggle(m.id, p)} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function OnlineOrders() {
  useCrossTabSync();
  useTick(30000);
  const orders = useStore((s) => s.onlineOrders);
  const settings = useStore((s) => s.settings);
  const toggleStore = useStore((s) => s.toggleStore);
  const updateSettings = useStore((s) => s.updateSettings);
  const addOnlineOrder = useStore((s) => s.addOnlineOrder);
  const setStatus = useStore((s) => s.setOnlineStatus);
  const toast = useStore((s) => s.toast);

  const [view, setView] = useState<'orders' | 'menu'>('orders');
  const [tab, setTab] = useState<TabId>('new');
  const [platform, setPlatform] = useState<'all' | P>('all');
  const [autoSim, setAutoSim] = useState(false);
  const [accepting, setAccepting] = useState<OnlineOrder | null>(null);
  const [prep, setPrep] = useState(settings.defaultPrepTime);
  const [rejecting, setRejecting] = useState<OnlineOrder | null>(null);
  const [reason, setReason] = useState(REJECT_REASONS[0]);

  // beep on new incoming
  const placedCount = orders.filter((o) => o.status === 'placed').length;
  const prevPlaced = useRef(placedCount);
  useEffect(() => {
    if (placedCount > prevPlaced.current) beep(880, 0.18, 3);
    prevPlaced.current = placedCount;
  }, [placedCount]);

  useEffect(() => {
    if (!autoSim) return;
    const t = setInterval(() => {
      const st = useStore.getState().settings.storeOnline;
      const open = (Object.keys(st) as P[]).filter((p) => st[p]);
      if (open.length) addOnlineOrder({ platform: open[Math.floor(Math.random() * open.length)] });
    }, 45000);
    return () => clearInterval(t);
  }, [autoSim, addOnlineOrder]);

  const simulate = () => {
    const open = (Object.keys(settings.storeOnline) as P[]).filter((p) => settings.storeOnline[p]);
    if (!open.length) return toast('All stores are offline', 'error');
    addOnlineOrder({ platform: open[Math.floor(Math.random() * open.length)] });
  };

  const byPlatform = orders.filter((o) => platform === 'all' || o.platform === platform);
  const list = useMemo(() => byPlatform.filter((o) => TAB_STATUSES[tab].includes(o.status)).sort((a, b) => b.createdAt - a.createdAt), [byPlatform, tab]);
  const todayDelivered = orders.filter((o) => o.status === 'delivered' && Date.now() - o.createdAt < 86400000);

  return (
    <div className="px-4 pb-12 pt-4 sm:px-6">
      <PageHeader
        title="Online orders"
        subtitle="Swiggy, Zomato & website orders on one screen"
        actions={<>
          <span className="rounded-xl bg-white/50 px-3 py-2"><Toggle size="sm" checked={settings.autoAcceptOnline} onChange={(v) => updateSettings({ autoAcceptOnline: v })} label={<span className="text-xs">Auto-accept</span>} /></span>
          <span className="rounded-xl bg-white/50 px-3 py-2"><Toggle size="sm" checked={autoSim} onChange={setAutoSim} label={<span className="text-xs">Auto-simulate · 45s</span>} /></span>
          <Button onClick={simulate}><Plus size={16} strokeWidth={1.6} /> Simulate order</Button>
        </>}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {(['swiggy', 'zomato', 'website'] as P[]).map((p) => {
          const ps = PLATFORM_STYLE[p];
          const on = settings.storeOnline[p];
          const rev = todayDelivered.filter((o) => o.platform === p).reduce((a, o) => a + o.total, 0);
          return (
            <div key={p} className={clsx('glass flex items-center gap-3.5 rounded-3xl p-4', !on && 'opacity-70')}>
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 text-slate-800"><Zap size={18} strokeWidth={1.6} /><span className={clsx('absolute right-1.5 top-1.5 h-2 w-2 rounded-full', ps.dot)} /></div>
              <div className="flex-1">
                <div className="text-[15px] text-slate-900">{ps.label}</div>
                <div className="text-xs text-slate-500">Today: {todayDelivered.filter((o) => o.platform === p).length} orders · {inr(rev)}</div>
              </div>
              <button onClick={() => { toggleStore(p); toast(`${ps.label} store ${on ? 'offline' : 'online'}`, on ? 'info' : 'success'); }}
                className={clsx('flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition', on ? 'bg-white/80 text-brand-700' : 'bg-black/[.06] text-slate-500')}>
                <Power size={12} strokeWidth={1.8} /> {on ? 'Online' : 'Offline'}
              </button>
            </div>
          );
        })}
      </div>

      <Tabs value={view} onChange={setView} className="mb-4" tabs={[{ id: 'orders', label: 'Live orders', count: placedCount }, { id: 'menu', label: 'Online menu' }]} />

      {view === 'menu' ? <OnlineMenu /> : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Tabs value={tab} onChange={setTab} tabs={[
              { id: 'new', label: 'New', count: byPlatform.filter((o) => TAB_STATUSES.new.includes(o.status)).length },
              { id: 'preparing', label: 'Preparing', count: byPlatform.filter((o) => TAB_STATUSES.preparing.includes(o.status)).length },
              { id: 'ready', label: 'Food ready', count: byPlatform.filter((o) => TAB_STATUSES.ready.includes(o.status)).length },
              { id: 'picked-up', label: 'Picked up', count: byPlatform.filter((o) => TAB_STATUSES['picked-up'].includes(o.status)).length },
              { id: 'delivered', label: 'Delivered', count: byPlatform.filter((o) => TAB_STATUSES.delivered.includes(o.status)).length },
              { id: 'rejected', label: 'Rejected', count: byPlatform.filter((o) => TAB_STATUSES.rejected.includes(o.status)).length },
            ]} />
            <Select value={platform} onChange={(e) => setPlatform(e.target.value as 'all' | P)} className="!w-40">
              <option value="all">All platforms</option>
              <option value="swiggy">Swiggy</option>
              <option value="zomato">Zomato</option>
              <option value="website">Website</option>
            </Select>
          </div>
          {list.length === 0 ? (
            <Card><Empty icon={<Bike size={36} strokeWidth={1.2} />} title="No orders here" hint="Use “Simulate order” to push a test order from an aggregator." /></Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {list.map((o) => (
                <OrderCard key={o.id} o={o} onAccept={() => { setPrep(settings.defaultPrepTime); setAccepting(o); }} onReject={() => { setReason(REJECT_REASONS[0]); setRejecting(o); }} />
              ))}
            </div>
          )}
        </>
      )}

      <Modal open={!!accepting} onClose={() => setAccepting(null)} title={`Accept order #${accepting?.platformOrderId}`} size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setAccepting(null)}>Cancel</Button>
          <Button variant="success" onClick={() => {
            if (!accepting) return;
            // 'accepted' creates the POS order + KOT; then move straight to preparing with the chosen prep time
            setStatus(accepting.id, 'accepted');
            setStatus(accepting.id, 'preparing', { prepTime: prep + Math.round((Date.now() - accepting.createdAt) / 60000) });
            toast('Order accepted · KOT sent to kitchen');
            setAccepting(null);
          }}>Accept & send KOT</Button>
        </>}>
        <p className="mb-3 text-sm text-slate-600">Food preparation time</p>
        <div className="grid grid-cols-4 gap-2">
          {[10, 15, 20, 30].map((m) => (
            <button key={m} onClick={() => setPrep(m)} className={clsx('rounded-2xl py-3.5 text-sm transition', prep === m ? 'bg-white/90 text-slate-900 shadow-[inset_0_0_0_1.5px_#1a9157]' : 'bg-white/50 text-slate-600 hover:bg-white/80')}>{m} min</button>
          ))}
        </div>
      </Modal>

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Reject order" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setRejecting(null)}>Back</Button>
          <Button variant="danger" onClick={() => { if (rejecting) { setStatus(rejecting.id, 'rejected', { instructions: `Rejected: ${reason}` }); toast('Order rejected', 'info'); } setRejecting(null); }}>Reject order</Button>
        </>}>
        <div className="space-y-2">
          {REJECT_REASONS.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2.5 rounded-2xl bg-white/50 px-3.5 py-2.5 text-sm hover:bg-white/80">
              <input className="accent-brand-600" type="radio" checked={reason === r} onChange={() => setReason(r)} /> {r}
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
}
