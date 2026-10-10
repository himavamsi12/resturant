import {
  Ban, Banknote, ChefHat, ClipboardList, CreditCard, Gift, LayoutGrid, Minus, NotebookPen, Pause, Percent, Plus, Printer,
  Receipt, Scissors, Search, Smartphone, Trash2, User, Users, Wallet, X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FakeQr, ReceiptModal } from '../components/BillReceipt';
import { Badge, Button, clsx, Empty, Field, Input, Modal, Pills, Select, Textarea, VegMark } from '../components/ui';
import { fmtTime, inr, minsAgo, uid } from '../lib/billing';
import { useStore } from '../store/useStore';
import type { CartItem, Customer, Kot, MenuItem, Order, Payment, PaymentMode, Variation } from '../types';

type PosType = 'dine-in' | 'takeaway' | 'delivery';

const sig = (l: Pick<CartItem, 'itemId' | 'variation' | 'addons' | 'note'>) =>
  `${l.itemId}|${l.variation || ''}|${l.addons.map((a) => a.name).sort().join(',')}|${l.note || ''}`;

export default function Billing() {
  const [params, setParams] = useSearchParams();
  const s = useStore();
  const { menuItems, categories, tables, areas, toast } = s;

  const [orderId, setOrderId] = useState<string>();
  const [draftType, setDraftType] = useState<PosType>('dine-in');
  const [draftTable, setDraftTable] = useState<string>();
  const [draftPax, setDraftPax] = useState(2);
  const [draftCustomer, setDraftCustomer] = useState<string>();

  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const [itemModal, setItemModal] = useState<MenuItem>();
  const [tablePicker, setTablePicker] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [runningOpen, setRunningOpen] = useState(false);
  const [receiptId, setReceiptId] = useState<string>();
  const [kotPreview, setKotPreview] = useState<Kot[]>();
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void }>();
  const [noteLine, setNoteLine] = useState<string>();

  const order = s.orders.find((o) => o.id === orderId);
  const orderType: Order['orderType'] = order?.orderType ?? draftType;
  const tableId = order ? order.tableId : draftTable;
  const table = tables.find((t) => t.id === tableId);
  const areaId = table?.areaId;
  const area = areas.find((a) => a.id === areaId);
  const customerId = order?.customerId ?? draftCustomer;
  const customer = s.customers.find((c) => c.id === customerId);

  const reset = (type?: PosType) => {
    setOrderId(undefined);
    setDraftTable(undefined);
    setDraftCustomer(undefined);
    setDraftPax(2);
    if (type) setDraftType(type);
    if (params.toString()) setParams({}, { replace: true });
  };

  // Load from ?order= or ?table=
  useEffect(() => {
    const oid = params.get('order');
    const tid = params.get('table');
    const st = useStore.getState();
    if (oid) {
      const o = st.orders.find((x) => x.id === oid);
      if (o && (o.status === 'open' || o.status === 'billed')) setOrderId(o.id);
    } else if (tid) {
      const t = st.tables.find((x) => x.id === tid);
      if (!t) return;
      if (t.orderId) setOrderId(t.orderId);
      else { setOrderId(undefined); setDraftType('dine-in'); setDraftTable(t.id); setDraftPax(Math.min(2, t.seats)); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  // If current order got settled / merged elsewhere, drop it
  useEffect(() => {
    if (orderId && (!order || (order.status !== 'open' && order.status !== 'billed'))) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, order?.status]);

  const ratio = (m: MenuItem) => (orderType === 'dine-in' && areaId && m.areaPrices[areaId] ? m.areaPrices[areaId] / m.price : 1);
  const priceFor = (m: MenuItem, v?: Variation) => Math.round((v?.price ?? m.price) * ratio(m));

  const visibleItems = useMemo(() => {
    const term = q.trim().toLowerCase();
    return menuItems.filter((m) => {
      if (term) return m.name.toLowerCase().includes(term) || m.shortCode.toLowerCase().startsWith(term);
      return cat === 'all' || m.categoryId === cat;
    });
  }, [menuItems, q, cat]);

  const activeCats = [...categories].filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder);

  // ---------- cart mutations ----------
  const setItems = (items: CartItem[]) => {
    if (!order) return;
    const patch: Partial<Order> = { items };
    if (order.status === 'billed') {
      patch.status = 'open';
      useStore.setState((st) => ({ tables: st.tables.map((t) => (t.orderId === order.id ? { ...t, status: 'running' } : t)) }));
    }
    s.updateOrder(order.id, patch);
  };

  const addLine = (m: MenuItem, v?: Variation, addons: { name: string; price: number }[] = [], note?: string) => {
    if (!m.available) return toast(`${m.name} is out of stock`, 'error');
    if (orderType === 'dine-in' && !tableId) {
      toast('Select a table first', 'error');
      setTablePicker(true);
      return;
    }
    const line: CartItem = {
      lineId: uid('l'), itemId: m.id, name: m.name, qty: 1,
      unitPrice: priceFor(m, v) + addons.reduce((a, x) => a + x.price, 0),
      variation: v?.name, addons, note: note || undefined, kotSent: 0, taxGroup: m.taxGroup, station: m.station,
    };
    if (order) {
      const ex = order.items.find((l) => sig(l) === sig(line));
      setItems(ex ? order.items.map((l) => (l === ex ? { ...l, qty: l.qty + 1 } : l)) : [...order.items, line]);
    } else {
      const id = s.createOrder({
        orderType: draftType, platform: 'pos', tableId: draftType === 'dine-in' ? draftTable : undefined,
        areaId: draftType === 'dine-in' ? table?.areaId : undefined, pax: draftType === 'dine-in' ? draftPax : undefined,
        customerId: draftCustomer, items: [line],
      });
      setOrderId(id);
    }
  };

  const onItemClick = (m: MenuItem) => {
    if (!m.available) return toast(`${m.name} is marked out of stock`, 'error');
    if (m.variations.length || m.addonGroupIds.length) setItemModal(m);
    else addLine(m);
  };

  const changeQty = (l: CartItem, delta: number) => {
    if (!order) return;
    const nq = l.qty + delta;
    const apply = () => {
      const items = nq <= 0 ? order.items.filter((x) => x.lineId !== l.lineId) : order.items.map((x) => (x.lineId === l.lineId ? { ...x, qty: nq, kotSent: Math.min(x.kotSent, nq) } : x));
      setItems(items);
    };
    if (delta < 0 && nq < l.kotSent) setConfirm({ message: `“${l.name}” was already sent to the kitchen. Void ${l.kotSent - Math.max(nq, 0)} qty?`, onConfirm: apply });
    else apply();
  };
  const removeLine = (l: CartItem) => {
    if (!order) return;
    const apply = () => setItems(order.items.filter((x) => x.lineId !== l.lineId));
    if (l.kotSent > 0) setConfirm({ message: `“${l.name}” was already sent to the kitchen. Void this item?`, onConfirm: apply });
    else apply();
  };
  const setLineNote = (l: CartItem, note: string) => order && setItems(order.items.map((x) => (x.lineId === l.lineId ? { ...x, note: note || undefined } : x)));

  // ---------- actions ----------
  const hasItems = !!order?.items.length;
  const pendingKot = !!order?.items.some((l) => l.qty > l.kotSent);

  const doKot = (silent = false) => {
    if (!order) return 0;
    const n = s.sendKot(order.id);
    if (!silent) toast(n ? `${n} KOT${n > 1 ? 's' : ''} sent to kitchen` : 'No new items for KOT', n ? 'success' : 'info');
    return n;
  };
  const doKotPrint = () => {
    const n = doKot();
    if (n) setKotPreview(useStore.getState().kots.slice(-n));
  };
  const doPrintBill = () => {
    if (!order || !hasItems) return;
    if (pendingKot) doKot(true);
    s.printBill(order.id);
    setReceiptId(order.id);
  };
  const doSettle = () => { if (order && hasItems) setPayOpen(true); };
  const doHold = () => {
    if (!order) return;
    if (pendingKot) doKot(true);
    toast(`Order ${table ? 'for ' + table.name : order.tokenNo ? '#' + order.tokenNo : ''} saved & held`, 'info');
    reset();
  };
  const doSave = () => { if (order) { toast('Order saved'); } };

  const onSettled = (payments: Payment[]) => {
    if (!order) return;
    if (order.discount?.coupon) {
      const code = order.discount.coupon;
      useStore.setState((st) => ({ coupons: st.coupons.map((c) => (c.code === code ? { ...c, usage: c.usage + 1 } : c)) }));
    }
    if (pendingKot) doKot(true);
    s.settleOrder(order.id, payments);
    toast(`Bill #${useStore.getState().orders.find((o) => o.id === order.id)?.billNo} settled`);
    setPayOpen(false);
    setReceiptId(order.id);
    reset();
  };

  // ---------- keyboard shortcuts ----------
  const handlers = useRef({ doKot, doPrintBill, doSettle });
  handlers.current = { doKot, doPrintBill, doSettle };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'F2') { e.preventDefault(); handlers.current.doKot(); }
      if (e.key === 'F3') { e.preventDefault(); handlers.current.doPrintBill(); }
      if (e.key === 'F4') { e.preventDefault(); handlers.current.doSettle(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const onSearchEnter = () => {
    const term = q.trim().toLowerCase();
    if (!term) return;
    const exact = menuItems.find((m) => m.shortCode.toLowerCase() === term);
    const target = exact || (visibleItems.length === 1 ? visibleItems[0] : undefined);
    if (target) { onItemClick(target); setQ(''); }
  };

  const running = s.orders.filter((o) => o.status === 'open' || o.status === 'billed').sort((a, b) => b.createdAt - a.createdAt);

  const switchType = (t: PosType) => {
    if (order) reset(t);
    else { setDraftType(t); if (t !== 'dine-in') setDraftTable(undefined); }
  };

  const pickTable = (tid: string) => {
    const t = tables.find((x) => x.id === tid)!;
    setTablePicker(false);
    if (t.orderId && t.orderId !== order?.id) { setOrderId(t.orderId); return; }
    if (order?.tableId && order.tableId !== tid) { s.moveTable(order.tableId, tid); return; }
    if (order && !order.tableId) {
      s.updateOrder(order.id, { tableId: tid, areaId: t.areaId });
      useStore.setState((st) => ({ tables: st.tables.map((x) => (x.id === tid ? { ...x, status: 'running', orderId: order.id } : x)) }));
      return;
    }
    setDraftTable(tid);
    setDraftPax(Math.min(draftPax, t.seats) || 2);
  };

  const receiptOrder = s.orders.find((o) => o.id === receiptId);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-4 pb-4 pt-2 sm:px-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Pills<PosType>
          options={[{ id: 'dine-in', label: 'Dine In' }, { id: 'takeaway', label: 'Takeaway' }, { id: 'delivery', label: 'Delivery' }]}
          value={(orderType === 'online' ? 'delivery' : orderType) as PosType}
          onChange={switchType}
        />
        {orderType === 'online' && <Badge>Online · {order?.platform}</Badge>}
        {orderType === 'dine-in' && (
          <>
            <Button variant={table ? 'outline' : 'primary'} size="sm" onClick={() => setTablePicker(true)}>
              <LayoutGrid size={14} strokeWidth={1.6} /> {table ? `Table ${table.name}` : 'Select table'}
            </Button>
            {area && <span className="text-xs text-slate-500">{area.name}{area.serviceCharge ? ` · SC ${area.serviceCharge}%` : ''}</span>}
            <label className="flex items-center gap-1.5 rounded-xl bg-white/55 px-2.5 py-1 text-xs text-slate-500">
              <Users size={14} strokeWidth={1.6} />
              <input
                type="number" min={1} value={order?.pax ?? draftPax}
                onChange={(e) => { const v = Math.max(1, +e.target.value || 1); if (order) s.updateOrder(order.id, { pax: v }); else setDraftPax(v); }}
                className="w-10 bg-transparent py-0.5 text-sm text-slate-900 outline-none"
              />
            </label>
          </>
        )}
        {order?.tokenNo && <Badge>Token #{order.tokenNo}</Badge>}
        {order?.billNo && <Badge color="green">Bill #{order.billNo}</Badge>}
        {order && <span className="text-xs text-slate-400">Started {fmtTime(order.createdAt)}</span>}
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-[11px] text-slate-400 xl:inline">F1 Search · F2 KOT · F3 Bill · F4 Settle</span>
          <Button variant="outline" size="sm" onClick={() => setRunningOpen(true)}><ClipboardList size={14} strokeWidth={1.6} /> Running · {running.length}</Button>
          <Button variant="outline" size="sm" onClick={() => reset()}><Plus size={14} strokeWidth={1.6} /> New</Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* Categories */}
        <div className="glass no-scrollbar flex shrink-0 gap-1 overflow-x-auto rounded-3xl p-2 lg:w-48 lg:flex-col lg:overflow-y-auto">
          {[{ id: 'all', name: 'All Items' }, ...activeCats].map((c) => (
            <button
              key={c.id}
              onClick={() => { setCat(c.id); setQ(''); }}
              className={clsx('flex shrink-0 items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-left text-sm transition',
                cat === c.id && !q ? 'bg-black/[.09] text-slate-900' : 'text-slate-600 hover:bg-white/70')}
            >
              {c.name}
              <span className="text-[11px] text-slate-400">{c.id === 'all' ? menuItems.length : menuItems.filter((m) => m.categoryId === c.id).length}</span>
            </button>
          ))}
        </div>

        {/* Items */}
        <div className="flex min-h-[50vh] min-w-0 flex-1 flex-col gap-3 lg:min-h-0">
          <div className="glass flex items-center gap-2.5 rounded-2xl px-4 py-2.5">
            <Search size={16} strokeWidth={1.6} className="text-slate-400" />
            <input
              ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSearchEnter(); if (e.key === 'Escape') setQ(''); }}
              placeholder="Search item or short code (e.g. PBM) and press Enter"
              className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-slate-400"
            />
            {q && <button onClick={() => setQ('')} className="text-slate-400 hover:text-slate-700"><X size={16} /></button>}
          </div>
          <div className="flex-1 overflow-y-auto pb-2 pr-1">
            {visibleItems.length === 0 ? <Empty title="No items match" hint="Try a different name or short code" /> : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {visibleItems.map((m) => {
                  const inCart = order?.items.filter((l) => l.itemId === m.id).reduce((a, l) => a + l.qty, 0) || 0;
                  return (
                    <button
                      key={m.id} onClick={() => onItemClick(m)}
                      className={clsx('relative flex min-h-[104px] flex-col rounded-2xl p-3.5 text-left transition active:scale-[0.98]',
                        !m.available && 'cursor-not-allowed opacity-40', inCart ? 'bg-white/90 shadow-[inset_0_0_0_1.5px_#1a9157]' : 'bg-white/55 hover:bg-white/85')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 text-sm leading-snug text-slate-900">{m.name}</span>
                        <span className="mt-0.5 text-base opacity-70 grayscale-[.3]">{m.image}</span>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <span className="flex items-center gap-1.5 text-sm text-slate-900"><VegMark veg={m.veg} />{m.variations.length ? <span className="text-xs text-slate-400">from</span> : null}{inr(priceFor(m, m.variations[0]))}</span>
                        <span className="text-[10px] tracking-wide text-slate-400">{m.shortCode}</span>
                      </div>
                      {!m.available && <span className="absolute inset-x-0 top-1/2 text-center text-[11px] text-red-600">Out of stock</span>}
                      {inCart > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] text-white">{inCart}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="glass flex w-full shrink-0 flex-col overflow-hidden rounded-3xl lg:w-[390px]">
          <CustomerBox
            customer={customer}
            orderType={orderType}
            address={order?.note}
            onAttach={(id) => (order ? s.updateOrder(order.id, { customerId: id }) : setDraftCustomer(id))}
            onDetach={() => (order ? s.updateOrder(order.id, { customerId: undefined, loyaltyRedeemed: 0 }) : setDraftCustomer(undefined))}
            onAddress={(v) => order && s.updateOrder(order.id, { note: v })}
          />

          <div className="min-h-[160px] flex-1 overflow-y-auto">
            {!order?.items.length ? (
              <Empty icon={<Receipt size={36} strokeWidth={1.2} />} title="Cart is empty" hint={orderType === 'dine-in' && !table ? 'Select a table, then tap items to add.' : 'Tap items or type a short code to add.'} />
            ) : (
              <ul className="space-y-1 px-2 py-2">
                {order.items.map((l) => (
                  <li key={l.lineId} className="rounded-2xl px-3 py-2.5 hover:bg-white/40">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm text-slate-900">
                          <span className="truncate">{l.name}</span>
                          {l.kotSent > 0 && <span title={`${l.kotSent} sent to kitchen`}><ChefHat size={13} strokeWidth={1.6} className={l.kotSent >= l.qty ? 'text-brand-600' : 'text-amber-500'} /></span>}
                        </div>
                        {(l.variation || l.addons.length > 0) && (
                          <div className="text-xs text-slate-500">{[l.variation, ...l.addons.map((a) => '+' + a.name)].filter(Boolean).join(' · ')}</div>
                        )}
                        {l.note && noteLine !== l.lineId && <div className="text-xs italic text-amber-700">“{l.note}”</div>}
                        <div className="text-xs text-slate-400">{inr(l.unitPrice)} each</div>
                      </div>
                      <div className="flex items-center gap-0.5 rounded-xl bg-white/60 p-0.5">
                        <button onClick={() => changeQty(l, -1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-900"><Minus size={13} /></button>
                        <span className="w-6 text-center text-sm">{l.qty}</span>
                        <button onClick={() => changeQty(l, 1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-900"><Plus size={13} /></button>
                      </div>
                      <div className="w-16 text-right text-sm text-slate-900">{inr(l.unitPrice * l.qty)}</div>
                    </div>
                    <div className="mt-1 flex gap-3 text-xs">
                      <button onClick={() => setNoteLine(noteLine === l.lineId ? undefined : l.lineId)} className="flex items-center gap-1 text-slate-400 hover:text-slate-700"><NotebookPen size={12} /> Note</button>
                      <button onClick={() => removeLine(l)} className="flex items-center gap-1 text-slate-400 hover:text-red-600"><Trash2 size={12} /> Remove</button>
                    </div>
                    {noteLine === l.lineId && (
                      <input
                        autoFocus defaultValue={l.note} placeholder="e.g. less spicy, no onion"
                        onKeyDown={(e) => { if (e.key === 'Enter') { setLineNote(l, (e.target as HTMLInputElement).value); setNoteLine(undefined); } }}
                        onBlur={(e) => { setLineNote(l, e.target.value); setNoteLine(undefined); }}
                        className="mt-1.5 w-full rounded-xl bg-white/70 px-3 py-1.5 text-xs outline-none focus:shadow-[inset_0_0_0_1.5px_#1a9157]"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Totals */}
          {order && hasItems && (
            <div className="mx-3 rounded-2xl bg-white/45 px-4 py-3 text-sm">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setDiscountOpen(true)}><Percent size={13} /> {order.discount ? 'Edit discount' : 'Discount'}</Button>
                <Button variant="outline" size="sm" disabled={!customer || customer.points <= 0} onClick={() => setRedeemOpen(true)}><Gift size={13} /> Redeem pts</Button>
                <Button variant="outline" size="sm" disabled={order.items.length < 2} onClick={() => setSplitOpen(true)}><Scissors size={13} /> Split</Button>
              </div>
              <TotalRow l="Sub Total" r={inr(order.subtotal, 2)} />
              {order.discountAmount > 0 && (
                <TotalRow
                  l={<span className="flex items-center gap-1">Discount{order.discount?.coupon ? ` (${order.discount.coupon})` : order.discount?.type === 'percent' ? ` (${order.discount.value}%)` : ''}{order.loyaltyRedeemed ? ' + points' : ''}
                    <button className="text-slate-400 hover:text-red-600" onClick={() => s.updateOrder(order.id, { discount: undefined, loyaltyRedeemed: 0 })}><X size={12} /></button></span>}
                  r={'−' + inr(order.discountAmount, 2)} className="text-emerald-700"
                />
              )}
              {order.serviceCharge > 0 && <TotalRow l={`Service Charge (${area?.serviceCharge}%)`} r={inr(order.serviceCharge, 2)} />}
              <TotalRow l="CGST" r={inr(order.tax / 2, 2)} />
              <TotalRow l="SGST" r={inr(order.tax / 2, 2)} />
              {!!order.packagingCharge && <TotalRow l="Packaging" r={inr(order.packagingCharge, 2)} />}
              {!!order.deliveryCharge && <TotalRow l="Delivery Charge" r={inr(order.deliveryCharge, 2)} />}
              {order.roundOff !== 0 && <TotalRow l="Round Off" r={order.roundOff.toFixed(2)} />}
              <div className="mt-2 flex items-baseline justify-between border-t border-black/[.06] pt-2 text-slate-900"><span className="text-sm">Total</span><span className="text-[26px] font-light tracking-tight">{inr(order.total)}</span></div>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-4 gap-1.5 p-3">
            <Button variant="outline" size="sm" disabled={!hasItems} onClick={doSave}>Save</Button>
            <Button variant="outline" size="sm" disabled={!order} onClick={doHold}><Pause size={13} /> Hold</Button>
            <Button variant="danger" size="sm" disabled={!order} onClick={() => setCancelOpen(true)}><Ban size={13} strokeWidth={1.6} /> Cancel</Button>
            <Button variant="outline" size="sm" disabled={!pendingKot} onClick={() => doKot()}><ChefHat size={13} /> KOT</Button>
            <Button variant="outline" className="col-span-2" disabled={!pendingKot} onClick={doKotPrint}><ChefHat size={15} strokeWidth={1.6} /> KOT & Print</Button>
            <Button variant="outline" className="col-span-2" disabled={!hasItems} onClick={doPrintBill}><Printer size={15} strokeWidth={1.6} /> Print bill</Button>
            <Button className="col-span-4" size="lg" disabled={!hasItems} onClick={doSettle}>
              <Wallet size={18} strokeWidth={1.6} /> Settle {order && hasItems ? inr(order.total) : ''}
            </Button>
          </div>
        </div>
      </div>

      {/* ---------- Modals ---------- */}
      {itemModal && (
        <ItemOptionsModal
          item={itemModal} priceFor={priceFor} onClose={() => setItemModal(undefined)}
          onAdd={(v, addons, note) => { addLine(itemModal, v, addons, note); setItemModal(undefined); }}
        />
      )}

      <Modal open={tablePicker} onClose={() => setTablePicker(false)} title="Select Table" size="lg">
        <TablePicker currentId={tableId} onPick={pickTable} />
      </Modal>

      {order && discountOpen && <DiscountModal order={order} onClose={() => setDiscountOpen(false)} />}
      {order && customer && redeemOpen && <RedeemModal order={order} customer={customer} onClose={() => setRedeemOpen(false)} />}
      {order && payOpen && <PaymentModal order={order} customer={customer} onClose={() => setPayOpen(false)} onSettle={onSettled} />}

      {order && cancelOpen && (
        <CancelModal
          onClose={() => setCancelOpen(false)}
          onConfirm={(reason) => { s.cancelOrder(order.id, reason); toast('Order cancelled', 'info'); setCancelOpen(false); reset(); }}
        />
      )}

      {order && splitOpen && (
        <SplitModal
          order={order} onClose={() => setSplitOpen(false)}
          onSplit={(ids, openNew) => {
            const nid = s.splitOrder(order.id, ids);
            setSplitOpen(false);
            if (!nid) return toast('Select some (not all) items to split', 'error');
            toast('Bill split into a new order');
            if (openNew) setOrderId(nid);
          }}
        />
      )}

      <Modal open={runningOpen} onClose={() => setRunningOpen(false)} title={`Running Orders (${running.length})`} size="lg">
        {running.length === 0 ? <Empty title="No running orders" /> : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {running.map((o) => {
              const t = tables.find((x) => x.id === o.tableId);
              return (
                <button key={o.id} onClick={() => { setOrderId(o.id); setRunningOpen(false); if (params.toString()) setParams({}, { replace: true }); }}
                  className={clsx('rounded-2xl bg-white/55 p-4 text-left transition hover:bg-white/85', o.id === orderId && 'shadow-[inset_0_0_0_1.5px_#1a9157]')}>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-900">{t ? `Table ${t.name}` : o.tokenNo ? `Token #${o.tokenNo}` : o.note || 'Order'}</span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500"><span className={clsx('h-2 w-2 rounded-full', o.status === 'billed' ? 'bg-brand-600' : 'bg-sky-500')} />{o.status === 'billed' ? 'Printed' : 'Running'}</span>
                  </div>
                  <div className="mt-1 text-xs capitalize text-slate-500">{o.orderType} · {o.platform} · {o.items.reduce((a, l) => a + l.qty, 0)} items</div>
                  <div className="mt-1 flex justify-between text-sm"><span className="text-slate-900">{inr(o.total)}</span><span className="text-xs text-slate-400">{minsAgo(o.createdAt)}</span></div>
                </button>
              );
            })}
          </div>
        )}
      </Modal>

      <ReceiptModal order={kotPreview ? undefined : receiptOrder} kots={kotPreview} onClose={() => { setReceiptId(undefined); setKotPreview(undefined); }} />

      <Modal
        open={!!confirm} onClose={() => setConfirm(undefined)} title="Please confirm" size="sm"
        footer={<><Button variant="outline" onClick={() => setConfirm(undefined)}>No</Button><Button variant="danger" onClick={() => { confirm?.onConfirm(); setConfirm(undefined); }}>Yes, void</Button></>}
      >
        <p className="text-sm text-slate-600">{confirm?.message}</p>
      </Modal>
    </div>
  );
}

function TotalRow({ l, r, className }: { l: ReactNode; r: ReactNode; className?: string }) {
  return <div className={clsx('flex justify-between py-0.5 text-slate-600', className)}><span>{l}</span><span>{r}</span></div>;
}

// ---------------------------------------------------------------------------

function CustomerBox({ customer, orderType, address, onAttach, onDetach, onAddress }: {
  customer?: Customer; orderType: Order['orderType']; address?: string;
  onAttach: (id: string) => void; onDetach: () => void; onAddress: (v: string) => void;
}) {
  const findOrCreate = useStore((s) => s.findOrCreateCustomer);
  const customers = useStore((s) => s.customers);
  const toast = useStore((s) => s.toast);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const match = phone.length >= 4 ? customers.filter((c) => c.phone.includes(phone)).slice(0, 4) : [];

  if (customer) {
    return (
      <div className="mx-3 mt-3 rounded-2xl bg-white/55 px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-slate-700"><User size={16} strokeWidth={1.6} /></div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-slate-900">{customer.name} <span className="font-normal text-slate-400">· {customer.phone}</span></div>
            <div className="flex flex-wrap gap-1 text-[11px]">
              <Badge color="green">{customer.points} pts</Badge>
              <Badge>{customer.visits} visits</Badge>
              {customer.labels.slice(0, 2).map((l) => <Badge key={l}>{l}</Badge>)}
            </div>
          </div>
          <button onClick={onDetach} className="text-slate-400 hover:text-red-600"><X size={16} /></button>
        </div>
        {(orderType === 'delivery') && (
          <input defaultValue={address} onBlur={(e) => onAddress(e.target.value)} placeholder="Delivery address" className="mt-2 w-full rounded-xl bg-white/70 px-3 py-1.5 text-xs outline-none" />
        )}
      </div>
    );
  }
  const attach = () => {
    if (!/^\d{10}$/.test(phone)) return toast('Enter a 10-digit phone number', 'error');
    onAttach(findOrCreate(phone, name.trim() || undefined));
    setPhone(''); setName('');
  };
  return (
    <div className="relative px-3 pt-3">
      <div className="flex gap-1.5">
        <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} onKeyDown={(e) => e.key === 'Enter' && attach()} placeholder="Customer phone" className="w-32 rounded-xl bg-white/60 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:bg-white/90" />
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && attach()} placeholder="Name" className="min-w-0 flex-1 rounded-xl bg-white/60 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:bg-white/90" />
        <Button size="sm" variant="outline" onClick={attach}><User size={14} strokeWidth={1.6} /></Button>
      </div>
      {match.length > 0 && (
        <div className="absolute inset-x-3 top-full z-10 mt-1 rounded-2xl bg-[#f2f2f2]/95 p-1 shadow-[0_20px_40px_-20px_rgba(0,0,0,.4)] backdrop-blur-xl">
          {match.map((c) => (
            <button key={c.id} onClick={() => { onAttach(c.id); setPhone(''); }} className="flex w-full justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-white/80">
              <span>{c.name}</span><span className="text-slate-400">{c.phone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemOptionsModal({ item, priceFor, onClose, onAdd }: {
  item: MenuItem; priceFor: (m: MenuItem, v?: Variation) => number; onClose: () => void;
  onAdd: (v: Variation | undefined, addons: { name: string; price: number }[], note: string) => void;
}) {
  const groups = useStore((s) => s.addonGroups).filter((g) => item.addonGroupIds.includes(g.id));
  const [vId, setVId] = useState(item.variations[0]?.id);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState('');
  const v = item.variations.find((x) => x.id === vId);
  const addons = groups.flatMap((g) => g.items.filter((a) => picked[g.id]?.includes(a.id)).map((a) => ({ name: a.name, price: a.price })));
  const total = priceFor(item, v) + addons.reduce((a, x) => a + x.price, 0);
  const unmetMin = groups.find((g) => (picked[g.id]?.length || 0) < g.min);

  const toggle = (gid: string, aid: string, max: number) => setPicked((p) => {
    const cur = p[gid] || [];
    if (cur.includes(aid)) return { ...p, [gid]: cur.filter((x) => x !== aid) };
    if (cur.length >= max) return p;
    return { ...p, [gid]: [...cur, aid] };
  });

  return (
    <Modal
      open onClose={onClose} title={<span className="flex items-center gap-2"><VegMark veg={item.veg} /> {item.image} {item.name}</span>}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!!unmetMin} onClick={() => onAdd(v, addons, note)}>Add to order · {inr(total)}</Button></>}
    >
      {item.variations.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs text-slate-500">Choose variation</div>
          <div className="grid grid-cols-2 gap-2">
            {item.variations.map((x) => (
              <button key={x.id} onClick={() => setVId(x.id)} className={clsx('flex justify-between rounded-2xl px-3.5 py-2.5 text-sm transition', vId === x.id ? 'bg-white/90 text-slate-900 shadow-[inset_0_0_0_1.5px_#1a9157]' : 'bg-white/50 text-slate-700 hover:bg-white/80')}>
                <span>{x.name}</span><span>{inr(priceFor(item, x))}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {groups.map((g) => (
        <div key={g.id} className="mb-4">
          <div className="mb-2 text-xs text-slate-500">{g.name} <span className="text-slate-400">({g.min ? `min ${g.min}, ` : ''}max {g.max})</span></div>
          <div className="space-y-1">
            {g.items.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center justify-between rounded-2xl bg-white/50 px-3.5 py-2.5 text-sm hover:bg-white/80">
                <span className="flex items-center gap-2.5"><input className="accent-brand-600" type="checkbox" checked={!!picked[g.id]?.includes(a.id)} onChange={() => toggle(g.id, a.id, g.max)} />{a.name}</span>
                <span className="text-slate-500">+{inr(a.price)}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <Field label="Cooking instructions"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
    </Modal>
  );
}

function TablePicker({ currentId, onPick }: { currentId?: string; onPick: (id: string) => void }) {
  const areas = useStore((s) => s.areas);
  const tables = useStore((s) => s.tables);
  const orders = useStore((s) => s.orders);
  const [areaId, setAreaId] = useState(areas[0]?.id);
  const color: Record<string, string> = {
    blank: 'bg-sky-500', running: 'bg-sky-500', printed: 'bg-brand-600', paid: 'bg-amber-500', reserved: 'bg-violet-500',
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1">
        {areas.map((a) => (
          <button key={a.id} onClick={() => setAreaId(a.id)} className={clsx('rounded-xl px-4 py-2 text-sm transition', areaId === a.id ? 'bg-black/[.09] text-slate-900' : 'bg-white/50 text-slate-600 hover:bg-white/80')}>{a.name}</button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {tables.filter((t) => t.areaId === areaId).map((t) => {
          const o = orders.find((x) => x.id === t.orderId);
          return (
            <button key={t.id} onClick={() => onPick(t.id)} className={clsx('relative rounded-2xl p-3 text-center transition', t.status === 'blank' ? 'bg-white/50 hover:bg-white/85' : 'bg-white/80', currentId === t.id && 'shadow-[inset_0_0_0_1.5px_#1a9157]')}>
              {t.status !== 'blank' && <span className={clsx('absolute right-2.5 top-2.5 h-2 w-2 rounded-full', color[t.status])} />}
              <div className="text-xl font-light text-slate-900">{t.name}</div>
              <div className="text-[11px] text-slate-500">{t.seats} seats</div>
              <div className="text-[11px] capitalize text-slate-600">{o ? inr(o.total) : t.status}</div>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-400">Pick a blank table to start, or an occupied table to open its order. Picking a blank table while an order is open moves the order.</p>
    </div>
  );
}

function DiscountModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const updateOrder = useStore((s) => s.updateOrder);
  const coupons = useStore((s) => s.coupons);
  const [mode, setMode] = useState<'percent' | 'flat' | 'coupon'>(order.discount?.coupon ? 'coupon' : order.discount?.type || 'percent');
  const [value, setValue] = useState(order.discount && !order.discount.coupon ? String(order.discount.value) : '');
  const [reason, setReason] = useState(order.discount?.reason || '');
  const [code, setCode] = useState(order.discount?.coupon || '');
  const [err, setErr] = useState('');

  const apply = () => {
    setErr('');
    if (mode === 'coupon') {
      const c = coupons.find((x) => x.code.toUpperCase() === code.trim().toUpperCase());
      if (!c) return setErr('Invalid coupon code');
      if (!c.active) return setErr('This coupon is not active');
      if (order.subtotal < c.minOrder) return setErr(`Minimum order of ${inr(c.minOrder)} required`);
      let amt = c.type === 'percent' ? (order.subtotal * c.value) / 100 : c.value;
      const capped = c.maxDiscount !== undefined && amt > c.maxDiscount;
      if (capped) amt = c.maxDiscount!;
      updateOrder(order.id, {
        discount: c.type === 'percent' && !capped
          ? { type: 'percent', value: c.value, coupon: c.code, reason: `Coupon ${c.code}` }
          : { type: 'flat', value: Math.round(amt), coupon: c.code, reason: `Coupon ${c.code}` },
      });
    } else {
      const v = parseFloat(value);
      if (!(v > 0)) return setErr('Enter a valid value');
      if (mode === 'percent' && v > 100) return setErr('Percent cannot exceed 100');
      if (mode === 'flat' && v > order.subtotal) return setErr('Discount exceeds subtotal');
      updateOrder(order.id, { discount: { type: mode, value: v, reason: reason || undefined } });
    }
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Apply Discount" size="sm"
      footer={<>{order.discount && <Button variant="danger" onClick={() => { updateOrder(order.id, { discount: undefined }); onClose(); }}>Remove</Button>}<Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={apply}>Apply</Button></>}>
      <Pills options={[{ id: 'percent', label: '% Percent' }, { id: 'flat', label: '₹ Flat' }, { id: 'coupon', label: 'Coupon' }]} value={mode} onChange={setMode} />
      <div className="mt-4 space-y-3">
        {mode === 'coupon' ? (
          <>
            <Field label="Coupon code"><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. WELCOME10" autoFocus /></Field>
            <div className="space-y-1">
              {coupons.filter((c) => c.active).map((c) => (
                <button key={c.id} onClick={() => setCode(c.code)} className="flex w-full items-center justify-between rounded-xl bg-white/50 px-3 py-2 text-left text-xs hover:bg-white/80">
                  <span className="tracking-wide text-slate-900">{c.code}</span>
                  <span className="text-slate-500">{c.type === 'percent' ? `${c.value}%` : inr(c.value)} off · min {inr(c.minOrder)}{c.maxDiscount ? ` · max ${inr(c.maxDiscount)}` : ''}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <Field label={mode === 'percent' ? 'Discount %' : 'Discount amount (₹)'}>
              <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
            </Field>
            <div className="flex gap-1">
              {(mode === 'percent' ? [5, 10, 15, 20] : [50, 100, 200]).map((v) => (
                <button key={v} onClick={() => setValue(String(v))} className="rounded-lg bg-white/55 px-3 py-1.5 text-xs hover:bg-white/90">{mode === 'percent' ? `${v}%` : inr(v)}</button>
              ))}
            </div>
            <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Regular customer, complaint" /></Field>
          </>
        )}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <p className="text-xs text-slate-400">Subtotal: {inr(order.subtotal, 2)}</p>
      </div>
    </Modal>
  );
}

function RedeemModal({ order, customer, onClose }: { order: Order; customer: Customer; onClose: () => void }) {
  const updateOrder = useStore((s) => s.updateOrder);
  const pointValue = useStore((s) => s.settings.pointValue);
  const baseDiscount = order.discountAmount - (order.loyaltyRedeemed || 0);
  const maxPts = Math.min(customer.points, Math.floor((order.subtotal - baseDiscount) / pointValue));
  const [pts, setPts] = useState(String(Math.round((order.loyaltyRedeemed || 0) / pointValue) || maxPts));
  const n = Math.max(0, Math.min(maxPts, Math.floor(+pts || 0)));
  return (
    <Modal open onClose={onClose} title="Redeem Loyalty Points" size="sm"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => { updateOrder(order.id, { loyaltyRedeemed: +(n * pointValue).toFixed(2) }); onClose(); }}>Redeem {inr(n * pointValue, 2)}</Button></>}>
      <p className="text-sm text-slate-600">{customer.name} has <b>{customer.points}</b> points (1 pt = {inr(pointValue, 2)}).</p>
      <Field label={`Points to redeem (max ${maxPts})`} className="mt-3">
        <Input type="number" value={pts} min={0} max={maxPts} onChange={(e) => setPts(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

const MODES: { id: Exclude<PaymentMode, 'online'>; label: string; icon: ReactNode }[] = [
  { id: 'cash', label: 'Cash', icon: <Banknote size={18} strokeWidth={1.6} /> },
  { id: 'card', label: 'Card', icon: <CreditCard size={18} strokeWidth={1.6} /> },
  { id: 'upi', label: 'UPI', icon: <Smartphone size={18} strokeWidth={1.6} /> },
  { id: 'wallet', label: 'Wallet', icon: <Wallet size={18} strokeWidth={1.6} /> },
  { id: 'due', label: 'Due', icon: <NotebookPen size={18} strokeWidth={1.6} /> },
];

function PaymentModal({ order, customer, onClose, onSettle }: { order: Order; customer?: Customer; onClose: () => void; onSettle: (p: Payment[]) => void }) {
  const upiId = useStore((s) => s.settings.upiId);
  const [rows, setRows] = useState<Payment[]>([{ mode: 'cash', amount: order.total }]);
  const [split, setSplit] = useState(false);
  const [tendered, setTendered] = useState('');
  const paid = rows.reduce((a, r) => a + (+r.amount || 0), 0);
  const remaining = +(order.total - paid).toFixed(2);
  const cashAmt = rows.filter((r) => r.mode === 'cash').reduce((a, r) => a + r.amount, 0);
  const change = (+tendered || 0) - cashAmt;
  const needsCustomer = rows.some((r) => r.mode === 'due' || r.mode === 'wallet') && !customer;
  const upiAmt = rows.filter((r) => r.mode === 'upi').reduce((a, r) => a + r.amount, 0);
  const err = needsCustomer ? 'Attach a customer for Due / Wallet payments' : Math.abs(remaining) > 0.01 ? `Payments must add up to ${inr(order.total)} (remaining ${inr(remaining, 2)})` : '';

  return (
    <Modal open onClose={onClose} title={`Settle Bill · ${inr(order.total)}`} size="md"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="success" disabled={!!err} onClick={() => onSettle(rows.filter((r) => r.amount > 0))}>Settle & Close</Button></>}>
      {!split ? (
        <div className="grid grid-cols-5 gap-2">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setRows([{ mode: m.id, amount: order.total }])}
              className={clsx('flex flex-col items-center gap-1.5 rounded-2xl py-3.5 text-xs transition', rows[0].mode === m.id ? 'bg-white/90 text-slate-900 shadow-[inset_0_0_0_1.5px_#1a9157]' : 'bg-white/50 text-slate-600 hover:bg-white/80')}>
              {m.icon}{m.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-2">
              <Select value={r.mode} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, mode: e.target.value as PaymentMode } : x)))} className="!w-32">
                {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </Select>
              <Input type="number" value={r.amount} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: +e.target.value } : x)))} />
              {rows.length > 1 && <Button variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}><X size={16} /></Button>}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRows([...rows, { mode: 'card', amount: Math.max(0, remaining) }])}><Plus size={14} /> Add payment</Button>
        </div>
      )}
      <button className="mt-3 text-xs text-brand-700 hover:underline" onClick={() => { setSplit(!split); setRows([{ mode: rows[0].mode, amount: order.total }]); }}>
        {split ? '← Single payment mode' : 'Split / part payment across modes →'}
      </button>

      {cashAmt > 0 && (
        <div className="mt-4 rounded-2xl bg-white/50 p-4">
          <Field label="Cash tendered by customer">
            <Input type="number" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder={String(cashAmt)} />
          </Field>
          <div className="mt-2 flex gap-1">
            {[cashAmt, Math.ceil(cashAmt / 100) * 100, Math.ceil(cashAmt / 500) * 500, 2000].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
              <button key={v} onClick={() => setTendered(String(v))} className="rounded-lg bg-white/70 px-3 py-1.5 text-xs hover:bg-white">{inr(v)}</button>
            ))}
          </div>
          {+tendered > 0 && <div className={clsx('mt-2 text-sm', change < 0 ? 'text-red-600' : 'text-brand-700')}>{change < 0 ? `Short by ${inr(-change, 2)}` : `Return change: ${inr(change, 2)}`}</div>}
        </div>
      )}
      {upiAmt > 0 && (
        <div className="mt-4 flex items-center gap-4 rounded-2xl bg-white/50 p-4">
          <FakeQr seed={`${upiId}-${order.id}-${upiAmt}`} size={96} />
          <div className="text-sm">
            <div className="text-slate-900">Scan & pay {inr(upiAmt, 2)}</div>
            <div className="text-slate-500">UPI ID: {upiId}</div>
            <div className="mt-1 text-xs text-slate-400">Confirm payment received before settling.</div>
          </div>
        </div>
      )}
      {customer && rows.some((r) => r.mode === 'wallet' || r.mode === 'due') && (
        <p className="mt-3 text-xs text-slate-500">{customer.name} · wallet / due balance: {inr(customer.wallet, 2)}</p>
      )}
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
    </Modal>
  );
}

function CancelModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (r: string) => void }) {
  const reasons = ['Customer left', 'Wrong order', 'Delay in service', 'Item not available', 'Duplicate order'];
  const [reason, setReason] = useState(reasons[0]);
  const [other, setOther] = useState('');
  return (
    <Modal open onClose={onClose} title="Cancel Order" size="sm"
      footer={<><Button variant="outline" onClick={onClose}>Back</Button><Button variant="danger" onClick={() => onConfirm(reason === 'Other' ? other || 'Other' : reason)}>Cancel order</Button></>}>
      <div className="space-y-1.5">
        {[...reasons, 'Other'].map((r) => (
          <label key={r} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm hover:bg-white/50"><input className="accent-brand-600" type="radio" checked={reason === r} onChange={() => setReason(r)} />{r}</label>
        ))}
        {reason === 'Other' && <Textarea rows={2} value={other} onChange={(e) => setOther(e.target.value)} placeholder="Reason…" />}
      </div>
    </Modal>
  );
}

function SplitModal({ order, onClose, onSplit }: { order: Order; onClose: () => void; onSplit: (ids: string[], openNew: boolean) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const amt = order.items.filter((l) => sel.includes(l.lineId)).reduce((a, l) => a + l.qty * l.unitPrice, 0);
  const invalid = !sel.length || sel.length === order.items.length;
  return (
    <Modal open onClose={onClose} title="Split Bill" size="sm"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="outline" disabled={invalid} onClick={() => onSplit(sel, false)}>Split</Button><Button disabled={invalid} onClick={() => onSplit(sel, true)}>Split & open new</Button></>}>
      <p className="mb-2 text-sm text-slate-500">Select items to move to a separate bill.</p>
      <div className="space-y-1">
        {order.items.map((l) => (
          <label key={l.lineId} className="flex cursor-pointer items-center justify-between rounded-2xl bg-white/50 px-3.5 py-2.5 text-sm hover:bg-white/80">
            <span className="flex items-center gap-2.5">
              <input className="accent-brand-600" type="checkbox" checked={sel.includes(l.lineId)} onChange={() => setSel(sel.includes(l.lineId) ? sel.filter((x) => x !== l.lineId) : [...sel, l.lineId])} />
              {l.qty} × {l.name}{l.variation ? ` (${l.variation})` : ''}
            </span>
            <span>{inr(l.qty * l.unitPrice)}</span>
          </label>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-900">New bill subtotal: {inr(amt)}</p>
    </Modal>
  );
}
