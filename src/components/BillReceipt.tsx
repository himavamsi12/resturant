import { Printer } from 'lucide-react';
import type { Kot, Order } from '../types';
import { useOutlet, useStore } from '../store/useStore';
import { fmtDateTime, inr } from '../lib/billing';
import { Button, Modal } from './ui';

const Row = ({ l, r, bold }: { l: string; r: string; bold?: boolean }) => (
  <div className={`flex justify-between ${bold ? 'font-bold' : ''}`}><span>{l}</span><span>{r}</span></div>
);
const Dash = () => <div className="my-1.5 border-t border-dashed border-slate-400" />;

/** 80mm thermal-style bill. */
export function BillReceipt({ order }: { order: Order }) {
  const settings = useStore((s) => s.settings);
  const outlet = useOutlet();
  const customer = useStore((s) => s.customers.find((c) => c.id === order.customerId));
  const table = useStore((s) => s.tables.find((t) => t.id === order.tableId));
  const staff = useStore((s) => s.staff.find((x) => x.id === order.staffId));
  const upiUrl = `upi://pay?pa=${settings.upiId}&pn=${encodeURIComponent(settings.restaurantName)}&am=${order.total}`;

  return (
    <div className="print-area mx-auto w-[300px] bg-[#fff] p-3 font-mono text-[11px] leading-snug text-black">
      <div className="text-center">
        {settings.showLogo && <div className="text-2xl">🍽️</div>}
        <div className="text-sm font-bold">{settings.restaurantName}</div>
        <div>{outlet.name}</div>
        <div>{outlet.address}</div>
        <div>Ph: {outlet.phone}</div>
        <div>GSTIN: {outlet.gstin}</div>
        <div>FSSAI: {outlet.fssai}</div>
      </div>
      <Dash />
      <div className="text-center font-bold">{order.status === 'open' ? 'ESTIMATE' : 'TAX INVOICE'}</div>
      <Row l={`Bill No: ${order.billNo ?? '—'}`} r={order.orderType.toUpperCase()} />
      <div>{fmtDateTime(order.settledAt || order.createdAt)}</div>
      {table && <Row l={`Table: ${table.name}`} r={order.pax ? `Pax: ${order.pax}` : ''} />}
      {order.tokenNo && <div>Token: #{order.tokenNo}</div>}
      {staff && <div>Cashier: {staff.name}</div>}
      {customer && <div>Customer: {customer.name} ({customer.phone})</div>}
      {order.note && <div>Note: {order.note}</div>}
      <Dash />
      <div className="flex font-bold"><span className="flex-1">Item</span><span className="w-8 text-right">Qty</span><span className="w-14 text-right">Price</span><span className="w-16 text-right">Amt</span></div>
      <Dash />
      {order.items.map((l) => (
        <div key={l.lineId}>
          <div className="flex">
            <span className="flex-1">{l.name}{l.variation ? ` (${l.variation})` : ''}</span>
            <span className="w-8 text-right">{l.qty}</span>
            <span className="w-14 text-right">{l.unitPrice.toFixed(2)}</span>
            <span className="w-16 text-right">{(l.unitPrice * l.qty).toFixed(2)}</span>
          </div>
          {l.addons.length > 0 && <div className="pl-2 text-[10px]">+ {l.addons.map((a) => a.name).join(', ')}</div>}
        </div>
      ))}
      <Dash />
      <Row l={`Sub Total (${order.items.reduce((a, l) => a + l.qty, 0)} items)`} r={order.subtotal.toFixed(2)} />
      {order.discountAmount > 0 && <Row l={`Discount${order.discount?.coupon ? ` (${order.discount.coupon})` : ''}`} r={'-' + order.discountAmount.toFixed(2)} />}
      {order.serviceCharge > 0 && <Row l="Service Charge" r={order.serviceCharge.toFixed(2)} />}
      {order.tax > 0 && <><Row l="CGST" r={(order.tax / 2).toFixed(2)} /><Row l="SGST" r={(order.tax / 2).toFixed(2)} /></>}
      {!!order.packagingCharge && <Row l="Packaging" r={order.packagingCharge.toFixed(2)} />}
      {!!order.deliveryCharge && <Row l="Delivery" r={order.deliveryCharge.toFixed(2)} />}
      {order.roundOff !== 0 && <Row l="Round Off" r={order.roundOff.toFixed(2)} />}
      <Dash />
      <div className="text-sm"><Row l="GRAND TOTAL" r={inr(order.total, 2)} bold /></div>
      <Dash />
      {order.payments.length > 0 && (
        <>
          {order.payments.map((p, i) => <Row key={i} l={`Paid – ${p.mode.toUpperCase()}`} r={p.amount.toFixed(2)} />)}
          <Dash />
        </>
      )}
      {settings.printQrOnBill && order.status !== 'settled' && (
        <div className="my-2 flex flex-col items-center gap-1">
          <FakeQr seed={upiUrl} />
          <div>Scan to pay via UPI · {settings.upiId}</div>
        </div>
      )}
      {customer && <div className="text-center">Loyalty points balance: {customer.points}</div>}
      <div className="mt-1 text-center">{settings.billFooter}</div>
    </div>
  );
}

/** Deterministic QR-looking pattern (visual placeholder – no external lib). */
export function FakeQr({ seed, size = 112 }: { seed: string; size?: number }) {
  const n = 21;
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const cells: boolean[] = [];
  for (let i = 0; i < n * n; i++) { h = (h * 1103515245 + 12345) >>> 0; cells.push(((h >> 16) & 1) === 1); }
  const finder = (x: number, y: number) => {
    for (const [fx, fy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      if (x >= fx && x < fx + 7 && y >= fy && y < fy + 7) {
        const dx = x - fx, dy = y - fy;
        return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
      }
    }
    return null;
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#fff" />
      {cells.map((c, i) => {
        const x = i % n, y = Math.floor(i / n);
        const f = finder(x, y);
        return (f ?? c) ? <rect key={i} x={x} y={y} width={1} height={1} fill="#000" /> : null;
      })}
    </svg>
  );
}

export function KotTicket({ kot, printable = true }: { kot: Kot; printable?: boolean }) {
  const station = useStore((s) => s.stations.find((x) => x.id === kot.station));
  return (
    <div className={`${printable ? 'print-area ' : ''}mx-auto w-[300px] bg-[#fff] p-3 font-mono text-[12px] text-black`}>
      <div className="text-center text-sm font-bold">KOT #{kot.kotNo}</div>
      <div className="text-center">{station?.name}</div>
      <Dash />
      <Row l={kot.tableName ? kot.tableName : kot.orderType.toUpperCase()} r={fmtDateTime(kot.createdAt)} />
      <Row l={kot.orderType.toUpperCase()} r={kot.platform.toUpperCase()} />
      <Dash />
      {kot.items.map((it, i) => (
        <div key={i} className="mb-1">
          <div className="flex font-bold"><span className="w-8">{it.qty} x</span><span className="flex-1">{it.name}{it.variation ? ` (${it.variation})` : ''}</span></div>
          {it.addons.length > 0 && <div className="pl-8">+ {it.addons.join(', ')}</div>}
          {it.note && <div className="pl-8 italic">** {it.note}</div>}
        </div>
      ))}
      <Dash />
    </div>
  );
}

export function ReceiptModal({ order, kots, onClose }: { order?: Order; kots?: Kot[]; onClose: () => void }) {
  const open = !!order || !!kots?.length;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kots?.length ? 'KOT preview' : `Bill ${order?.billNo ? '#' + order.billNo : 'preview'}`}
      size="sm"
      footer={<><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => window.print()}><Printer size={16} strokeWidth={1.6} /> Print</Button></>}
    >
      <div className="rounded-2xl bg-white/45 p-4">
        {kots?.length ? (
          <div className="print-area space-y-3">{kots.map((k) => <div key={k.id} className="shadow-[0_12px_30px_-18px_rgba(0,0,0,.4)]"><KotTicket kot={k} printable={false} /></div>)}</div>
        ) : order ? <div className="shadow-[0_12px_30px_-18px_rgba(0,0,0,.4)]"><BillReceipt order={order} /></div> : null}
      </div>
    </Modal>
  );
}
