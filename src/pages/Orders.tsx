import { Ban, Download, ExternalLink, Printer, Receipt } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReceiptModal } from '../components/BillReceipt';
import { Badge, Button, Card, clsx, DataTable, Field, Input, Modal, PageHeader, Pills, Select, StatCard, type BadgeColor } from '../components/ui';
import { downloadCSV, fmtDateTime, inr, startOfDay } from '../lib/billing';
import { useStore } from '../store/useStore';
import type { Order } from '../types';

type Range = 'today' | 'yesterday' | '7d' | '30d' | 'all';
const DAY = 86400000;

const statusColor: Record<Order['status'], BadgeColor> = { open: 'blue', billed: 'yellow', settled: 'green', cancelled: 'red' };
const statusLabel: Record<Order['status'], string> = { open: 'Running', billed: 'Printed', settled: 'Settled', cancelled: 'Cancelled' };
const statusDot: Record<Order['status'], string> = { open: 'bg-sky-500', billed: 'bg-amber-500', settled: 'bg-brand-600', cancelled: 'bg-red-500' };
const platformDot: Record<string, string> = { swiggy: 'bg-orange-500', zomato: 'bg-red-500', website: 'bg-sky-500', 'scan-order': 'bg-violet-500', kiosk: 'bg-violet-500', pos: 'bg-slate-400', captain: 'bg-slate-400' };

const Dot = ({ c, children }: { c: string; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs capitalize text-slate-600"><span className={clsx('h-2 w-2 rounded-full', c)} />{children}</span>
);

export default function Orders() {
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const tables = useStore((s) => s.tables);
  const [range, setRange] = useState<Range>('today');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(100);
  const [detailId, setDetailId] = useState<string>();

  const custMap = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, c])), [customers]);
  const tableMap = useMemo(() => Object.fromEntries(tables.map((t) => [t.id, t])), [tables]);

  const filtered = useMemo(() => {
    const today = startOfDay();
    const [from, to] = {
      today: [today, Infinity], yesterday: [today - DAY, today], '7d': [today - 6 * DAY, Infinity], '30d': [today - 29 * DAY, Infinity], all: [0, Infinity],
    }[range];
    const term = q.trim().toLowerCase();
    return orders
      .filter((o) => o.createdAt >= from && o.createdAt < to)
      .filter((o) => status === 'all' || o.status === status)
      .filter((o) => type === 'all' || o.orderType === type)
      .filter((o) => platform === 'all' || o.platform === platform)
      .filter((o) => {
        if (!term) return true;
        const c = o.customerId ? custMap[o.customerId] : undefined;
        return String(o.billNo || '').includes(term) || c?.name.toLowerCase().includes(term) || c?.phone.includes(term) || (o.note || '').toLowerCase().includes(term);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [orders, range, status, type, platform, q, custMap]);

  const settled = filtered.filter((o) => o.status === 'settled');
  const sales = settled.reduce((a, o) => a + o.total, 0);
  const cancelled = filtered.filter((o) => o.status === 'cancelled');
  const running = filtered.filter((o) => o.status === 'open' || o.status === 'billed');

  const exportCsv = () => downloadCSV(`orders-${range}`, [
    ['Bill No', 'Date', 'Type', 'Platform', 'Table', 'Customer', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Status', 'Payment'],
    ...filtered.map((o) => [o.billNo || '', fmtDateTime(o.createdAt), o.orderType, o.platform, o.tableId ? tableMap[o.tableId]?.name || '' : '',
      o.customerId ? custMap[o.customerId]?.name || '' : '', o.items.reduce((a, l) => a + l.qty, 0), o.subtotal, o.discountAmount, o.tax, o.total, o.status,
      o.payments.map((p) => `${p.mode}:${p.amount}`).join(' ')]),
  ]);

  return (
    <div className="px-4 pb-12 pt-4 sm:px-6">
      <PageHeader title="Orders" subtitle="All dine-in, takeaway, delivery and online orders" actions={<Button variant="outline" onClick={exportCsv}><Download size={16} strokeWidth={1.6} /> Export CSV</Button>} />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Orders" value={filtered.length} sub={`${running.length} running`} />
        <StatCard label="Net sales" value={inr(sales)} sub={`${settled.length} settled bills`} />
        <StatCard label="Avg. ticket" value={inr(settled.length ? sales / settled.length : 0)} />
        <StatCard label="Cancelled" value={cancelled.length} sub={inr(cancelled.reduce((a, o) => a + o.total, 0)) + ' value'} />
      </div>

      <Card>
        <div className="mx-5 flex flex-wrap items-center gap-2 border-b border-black/[.06] py-4">
          <Pills<Range> options={[{ id: 'today', label: 'Today' }, { id: 'yesterday', label: 'Yesterday' }, { id: '7d', label: '7 days' }, { id: '30d', label: '30 days' }, { id: 'all', label: 'All' }]} value={range} onChange={(v) => { setRange(v); setLimit(100); }} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-auto">
            <option value="all">All status</option><option value="open">Running</option><option value="billed">Printed</option><option value="settled">Settled</option><option value="cancelled">Cancelled</option>
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="!w-auto">
            <option value="all">All types</option><option value="dine-in">Dine-in</option><option value="takeaway">Takeaway</option><option value="delivery">Delivery</option><option value="online">Online</option>
          </Select>
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)} className="!w-auto">
            <option value="all">All platforms</option>
            {['pos', 'captain', 'swiggy', 'zomato', 'website', 'scan-order', 'kiosk'].map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bill no, customer, phone…" className="!w-56" />
        </div>
        <DataTable
          rows={filtered.slice(0, limit)}
          rowKey={(o) => o.id}
          onRowClick={(o) => setDetailId(o.id)}
          empty="No orders for these filters"
          cols={[
            { key: 'bill', header: 'Bill #', render: (o) => <span className="text-slate-900">{o.billNo ? `#${o.billNo}` : <span className="text-slate-400">—</span>}</span> },
            { key: 'time', header: 'Date & time', render: (o) => <span className="whitespace-nowrap text-xs">{fmtDateTime(o.createdAt)}</span> },
            { key: 'type', header: 'Type', render: (o) => <span className="capitalize">{o.orderType}{o.tableId ? ` · ${tableMap[o.tableId]?.name || ''}` : o.tokenNo ? ` · #${o.tokenNo}` : ''}</span> },
            { key: 'plat', header: 'Source', render: (o) => <Dot c={platformDot[o.platform] || 'bg-slate-400'}>{o.platform}</Dot> },
            { key: 'cust', header: 'Customer', render: (o) => (o.customerId ? custMap[o.customerId]?.name : <span className="text-slate-400">Walk-in</span>) },
            { key: 'items', header: 'Items', className: 'text-right', render: (o) => o.items.reduce((a, l) => a + l.qty, 0) },
            { key: 'pay', header: 'Payment', render: (o) => <span className="text-xs uppercase text-slate-500">{o.payments.map((p) => p.mode).join(' + ') || '—'}</span> },
            { key: 'total', header: 'Total', className: 'text-right', render: (o) => <span className="text-slate-900">{inr(o.total)}</span> },
            { key: 'status', header: 'Status', render: (o) => <Dot c={statusDot[o.status]}>{statusLabel[o.status]}</Dot> },
          ]}
        />
        {filtered.length > limit && (
          <div className="p-3 text-center"><Button variant="ghost" onClick={() => setLimit(limit + 100)}>Show more ({filtered.length - limit} remaining)</Button></div>
        )}
      </Card>

      {detailId && <OrderDetail id={detailId} onClose={() => setDetailId(undefined)} />}
    </div>
  );
}

function OrderDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const navigate = useNavigate();
  const order = useStore((s) => s.orders.find((o) => o.id === id));
  const customer = useStore((s) => s.customers.find((c) => c.id === order?.customerId));
  const table = useStore((s) => s.tables.find((t) => t.id === order?.tableId));
  const staff = useStore((s) => s.staff.find((x) => x.id === order?.staffId));
  const kots = useStore((s) => s.kots.filter((k) => k.orderId === id));
  const cancelOrder = useStore((s) => s.cancelOrder);
  const toast = useStore((s) => s.toast);
  const [printing, setPrinting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  if (!order) return null;
  const live = order.status === 'open' || order.status === 'billed';

  return (
    <>
      <Modal
        open={!printing} onClose={onClose} size="lg"
        title={<span className="flex items-center gap-2"><Receipt size={18} strokeWidth={1.6} /> {order.billNo ? `Bill #${order.billNo}` : 'Order'} <Badge color={statusColor[order.status]}>{statusLabel[order.status]}</Badge></span>}
        footer={
          <>
            {live && <Button variant="danger" onClick={() => setCancelling(true)}><Ban size={15} strokeWidth={1.6} /> Cancel order</Button>}
            {live && <Button variant="outline" onClick={() => navigate(`/billing?order=${order.id}`)}><ExternalLink size={15} strokeWidth={1.6} /> Open in billing</Button>}
            <Button onClick={() => setPrinting(true)}><Printer size={15} strokeWidth={1.6} /> {order.status === 'settled' ? 'Reprint' : 'Print'}</Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 text-sm">
            <Info l="Created" r={fmtDateTime(order.createdAt)} />
            {order.settledAt && <Info l={order.status === 'cancelled' ? 'Cancelled' : 'Settled'} r={fmtDateTime(order.settledAt)} />}
            <Info l="Type" r={<span className="capitalize">{order.orderType} · {order.platform}</span>} />
            {table && <Info l="Table" r={`${table.name}${order.pax ? ` · ${order.pax} pax` : ''}`} />}
            {order.tokenNo && <Info l="Token" r={`#${order.tokenNo}`} />}
            {staff && <Info l="Staff" r={staff.name} />}
            {customer && <Info l="Customer" r={`${customer.name} (${customer.phone})`} />}
            {order.note && <Info l="Note" r={order.note} />}
            {order.cancelReason && <Info l="Cancel reason" r={<span className="text-red-600">{order.cancelReason}</span>} />}
          </div>
          <div className="rounded-2xl bg-white/55 p-4 text-sm">
            <Info l="Subtotal" r={inr(order.subtotal, 2)} />
            {order.discountAmount > 0 && <Info l="Discount" r={'−' + inr(order.discountAmount, 2)} />}
            {order.serviceCharge > 0 && <Info l="Service charge" r={inr(order.serviceCharge, 2)} />}
            <Info l="Tax (GST)" r={inr(order.tax, 2)} />
            {!!order.packagingCharge && <Info l="Packaging" r={inr(order.packagingCharge, 2)} />}
            {!!order.deliveryCharge && <Info l="Delivery" r={inr(order.deliveryCharge, 2)} />}
            <div className="mt-1.5 flex items-baseline justify-between border-t border-black/[.06] pt-1.5"><span>Total</span><span className="text-[22px] font-light tracking-tight">{inr(order.total)}</span></div>
            {order.payments.map((p, i) => <Info key={i} l={`Paid · ${p.mode.toUpperCase()}`} r={inr(p.amount, 2)} />)}
          </div>
        </div>
        <table className="mt-4 w-full text-sm">
          <thead><tr className="border-b border-black/[.06] text-left text-xs text-slate-500"><th className="py-2 font-normal">Item</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {order.items.map((l) => (
              <tr key={l.lineId} className="border-b border-black/[.04] last:border-0">
                <td className="py-2">{l.name}{l.variation ? ` (${l.variation})` : ''}{l.addons.length > 0 && <div className="text-xs text-slate-500">+ {l.addons.map((a) => a.name).join(', ')}</div>}{l.note && <div className="text-xs italic text-amber-700">{l.note}</div>}</td>
                <td className="text-right">{l.qty}</td><td className="text-right">{inr(l.unitPrice)}</td><td className="text-right text-slate-900">{inr(l.unitPrice * l.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {kots.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-xs text-slate-500">KOTs</div>
            <div className="flex flex-wrap gap-3">{kots.map((k) => <Dot key={k.id} c={k.status === 'cancelled' ? 'bg-red-500' : k.status === 'served' ? 'bg-brand-600' : 'bg-amber-500'}>KOT #{k.kotNo} · {k.status}</Dot>)}</div>
          </div>
        )}
      </Modal>

      <ReceiptModal order={printing ? order : undefined} onClose={() => setPrinting(false)} />

      <Modal open={cancelling} onClose={() => setCancelling(false)} title="Cancel order" size="sm"
        footer={<><Button variant="outline" onClick={() => setCancelling(false)}>Back</Button><Button variant="danger" disabled={!reason.trim()} onClick={() => { cancelOrder(order.id, reason); toast('Order cancelled', 'info'); setCancelling(false); }}>Confirm cancel</Button></>}>
        <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer left" autoFocus /></Field>
      </Modal>
    </>
  );
}

const Info = ({ l, r }: { l: string; r: ReactNode }) => (
  <div className="flex justify-between gap-3 py-0.5"><span className="text-slate-500">{l}</span><span className="text-right text-slate-900">{r}</span></div>
);
