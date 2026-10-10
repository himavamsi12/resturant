import { AlertTriangle, CheckCircle2, Download, FileUp, Shuffle, XCircle } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, DataTable, Field, Input, PageHeader, Pills, Select, StatCard } from '../components/ui';
import { downloadCSV, fmtDateTime, inr, startOfDay } from '../lib/billing';
import { useStore } from '../store/useStore';

const DAY = 86400000;
const DEFAULT_COMMISSION: Record<string, number> = { swiggy: 22, zomato: 20, website: 0 };
type Plat = 'swiggy' | 'zomato' | 'website';
type Status = 'Matched' | 'Short paid' | 'Excess paid' | 'Missing' | 'Pending';

interface Row {
  key: string;
  platform: Plat;
  billNo?: number;
  at: number;
  gross: number;
  base: number;
  commissionPct: number;
  commission: number;
  gstOnCommission: number;
  pgFee: number;
  tcs: number;
  tds: number;
  expected: number;
  received?: number;
  diff?: number;
  status: Status;
}

const r2 = (n: number) => +n.toFixed(2);

export default function Reconciliation() {
  const orders = useStore((s) => s.orders);
  const onlineOrders = useStore((s) => s.onlineOrders);
  const toast = useStore((s) => s.toast);

  const [range, setRange] = useState<'7d' | '30d' | 'all'>('7d');
  const [platform, setPlatform] = useState<'all' | Plat>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [tcsPct, setTcsPct] = useState(1);
  const [tdsPct, setTdsPct] = useState(1);
  const [pgPct, setPgPct] = useState(2);
  const [payouts, setPayouts] = useState<Record<string, number> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const from = range === 'all' ? 0 : startOfDay() - (range === '7d' ? 6 : 29) * DAY;

  const base: Omit<Row, 'received' | 'diff' | 'status'>[] = useMemo(() => orders
    .filter((o) => o.orderType === 'online' && o.status === 'settled' && o.createdAt >= from && ['swiggy', 'zomato', 'website'].includes(o.platform))
    .map((o) => {
      const plat = o.platform as Plat;
      const oo = onlineOrders.find((x) => x.posOrderId === o.id);
      const key = oo?.platformOrderId || `${plat.slice(0, 3).toUpperCase()}-${o.billNo}`;
      const pct = oo?.commission ?? DEFAULT_COMMISSION[plat];
      const taxable = o.subtotal - o.discountAmount;
      const b = taxable + (o.packagingCharge || 0); // commission is charged on food value + packaging
      const commission = (b * pct) / 100;
      const gstOnCommission = commission * 0.18;
      const pgFee = plat === 'website' ? (o.total * pgPct) / 100 : 0;
      const tcs = plat === 'website' ? 0 : (taxable * tcsPct) / 100;
      const tds = plat === 'website' ? 0 : (taxable * tdsPct) / 100;
      return {
        key, platform: plat, billNo: o.billNo, at: o.createdAt, gross: o.total, base: r2(b), commissionPct: pct,
        commission: r2(commission), gstOnCommission: r2(gstOnCommission), pgFee: r2(pgFee), tcs: r2(tcs), tds: r2(tds),
        expected: r2(o.total - commission - gstOnCommission - pgFee - tcs - tds),
      };
    })
    .sort((a, b) => b.at - a.at), [orders, onlineOrders, from, tcsPct, tdsPct, pgPct]);

  const rows: Row[] = useMemo(() => base.map((r) => {
    if (!payouts) return { ...r, status: 'Pending' as Status };
    const received = payouts[r.key];
    if (received === undefined) return { ...r, status: 'Missing' as Status, diff: -r.expected };
    const diff = r2(received - r.expected);
    return { ...r, received, diff, status: (Math.abs(diff) <= 1 ? 'Matched' : diff < 0 ? 'Short paid' : 'Excess paid') as Status };
  }), [base, payouts]);

  const visible = rows.filter((r) => (platform === 'all' || r.platform === platform) && (statusFilter === 'all' || r.status === statusFilter));

  const simulate = () => {
    const p: Record<string, number> = {};
    base.forEach((r, i) => {
      const roll = (i * 9301 + 49297) % 233280 / 233280; // deterministic pseudo-random
      if (roll < 0.07) return; // missing
      if (roll < 0.17) { p[r.key] = r2(r.expected - (15 + Math.round(roll * 400))); return; } // short paid
      if (roll < 0.2) { p[r.key] = r2(r.expected + 25); return; } // excess
      p[r.key] = r.expected;
    });
    setPayouts(p);
    toast(`Simulated payout sheet for ${Object.keys(p).length} orders`, 'info');
  };

  const upload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const p: Record<string, number> = {};
      String(reader.result).split(/\r?\n/).forEach((line) => {
        const [id, amt] = line.split(',').map((x) => x.replace(/"/g, '').trim());
        const n = parseFloat(amt);
        if (id && !isNaN(n)) p[id] = n;
      });
      if (!Object.keys(p).length) { toast('No valid rows found. Expected "orderId,amount".', 'error'); return; }
      setPayouts(p);
      toast(`Loaded ${Object.keys(p).length} payout rows`);
    };
    reader.readAsText(file);
  };

  const sumBy = (rs: Row[], k: keyof Row) => r2(rs.reduce((s, r) => s + ((r[k] as number) || 0), 0));
  const platRows = (['swiggy', 'zomato', 'website'] as Plat[]).map((p) => {
    const rs = rows.filter((r) => r.platform === p);
    return {
      p, count: rs.length, gross: sumBy(rs, 'gross'), commission: sumBy(rs, 'commission'), gst: sumBy(rs, 'gstOnCommission'),
      other: r2(sumBy(rs, 'tcs') + sumBy(rs, 'tds') + sumBy(rs, 'pgFee')), expected: sumBy(rs, 'expected'), received: sumBy(rs, 'received'),
      issues: rs.filter((r) => r.status !== 'Matched' && r.status !== 'Pending').length,
    };
  });

  const totalExpected = sumBy(rows, 'expected');
  const totalReceived = sumBy(rows, 'received');
  const counts = (st: Status) => rows.filter((r) => r.status === st).length;

  const exportRows = () => downloadCSV('online_reconciliation', [
    ['Order ID', 'Platform', 'Bill #', 'Date', 'Gross', 'Commission %', 'Commission', 'GST on commission', 'PG fee', 'TCS', 'TDS', 'Expected payout', 'Received', 'Difference', 'Status'],
    ...visible.map((r) => [r.key, r.platform, r.billNo || '', fmtDateTime(r.at), r.gross, r.commissionPct, r.commission, r.gstOnCommission, r.pgFee, r.tcs, r.tds, r.expected, r.received ?? '', r.diff ?? '', r.status]),
  ]);
  const exportTemplate = () => downloadCSV('payout_template', [['orderId', 'amount'], ...base.map((r) => [r.key, r.expected])]);

  const statusBadge = (s: Status) => {
    const color = s === 'Matched' ? 'green' : s === 'Pending' ? 'gray' : s === 'Missing' ? 'red' : s === 'Short paid' ? 'orange' : 'blue';
    return <Badge color={color}>{s}</Badge>;
  };

  return (
    <div className="px-4 pb-12 pt-2 sm:px-6">
      <PageHeader
        title="Online Order Reconciliation"
        subtitle="Compare expected aggregator payouts (after commission, GST & deductions) with actual settlements."
        actions={
          <>
            <Pills value={range} onChange={setRange} options={[{ id: '7d', label: '7 Days' }, { id: '30d', label: '30 Days' }, { id: 'all', label: 'All' }]} />
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}><FileUp size={15} /> Upload payout CSV</Button>
            <Button variant="secondary" onClick={simulate}><Shuffle size={15} /> Simulate payout sheet</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Online orders" value={rows.length} sub={`Gross ${inr(sumBy(rows, 'gross'))}`} />
        <StatCard label="Commission + GST" value={inr(sumBy(rows, 'commission') + sumBy(rows, 'gstOnCommission'))} tone="orange" />
        <StatCard label="Expected payout" value={inr(totalExpected)} tone="blue" />
        <StatCard label="Received" value={payouts ? inr(totalReceived) : '—'} sub={payouts ? `Difference ${inr(totalReceived - totalExpected)}` : 'Upload or simulate a payout sheet'} tone="green" />
        <StatCard label="Discrepancies" value={payouts ? counts('Short paid') + counts('Missing') + counts('Excess paid') : '—'}
          sub={payouts ? `${counts('Matched')} matched · ${counts('Short paid')} short · ${counts('Missing')} missing` : ''} tone="red"
          icon={<AlertTriangle size={16} />} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Platform summary" className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-black/[.06] text-left text-xs text-slate-500">
                {['Platform', 'Orders', 'Gross', 'Commission', 'GST on comm.', 'TCS/TDS/PG', 'Expected', 'Received', 'Issues'].map((h, i) => <th key={h} className={`px-3 py-2 ${i ? 'text-right' : ''}`}>{h}</th>)}
              </tr></thead>
              <tbody>
                {platRows.map((p) => (
                  <tr key={p.p} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium capitalize">{p.p} <span className="text-xs text-slate-400">({DEFAULT_COMMISSION[p.p]}%)</span></td>
                    <td className="px-3 py-2 text-right">{p.count}</td>
                    <td className="px-3 py-2 text-right">{inr(p.gross, 2)}</td>
                    <td className="px-3 py-2 text-right text-red-600">−{inr(p.commission, 2)}</td>
                    <td className="px-3 py-2 text-right text-red-600">−{inr(p.gst, 2)}</td>
                    <td className="px-3 py-2 text-right text-red-600">−{inr(p.other, 2)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{inr(p.expected, 2)}</td>
                    <td className="px-3 py-2 text-right">{payouts ? inr(p.received, 2) : '—'}</td>
                    <td className="px-3 py-2 text-right">{payouts ? (p.issues ? <Badge color="red">{p.issues}</Badge> : <Badge color="green">0</Badge>) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Deduction settings">
          <div className="grid grid-cols-3 gap-3 p-4">
            <Field label="TCS %"><Input type="number" step="0.1" min={0} value={tcsPct} onChange={(e) => setTcsPct(+e.target.value || 0)} /></Field>
            <Field label="TDS %"><Input type="number" step="0.1" min={0} value={tdsPct} onChange={(e) => setTdsPct(+e.target.value || 0)} /></Field>
            <Field label="PG fee % (web)"><Input type="number" step="0.1" min={0} value={pgPct} onChange={(e) => setPgPct(+e.target.value || 0)} /></Field>
            <p className="col-span-3 text-xs leading-relaxed text-slate-500">
              Commission is applied on food value + packaging; GST of 18% applies on commission. TCS/TDS are applied to aggregator orders on taxable value. Adjust these to match your aggregator agreement.
            </p>
            <Button variant="ghost" size="sm" className="col-span-3" onClick={exportTemplate}><Download size={14} /> Download payout CSV template</Button>
          </div>
        </Card>
      </div>

      <Card className="mt-4" title="Order-level reconciliation" actions={
        <>
          <Select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)} className="!w-auto !py-1.5 text-xs">
            <option value="all">All platforms</option><option value="swiggy">Swiggy</option><option value="zomato">Zomato</option><option value="website">Website</option>
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="!w-auto !py-1.5 text-xs">
            {['all', 'Matched', 'Short paid', 'Excess paid', 'Missing', 'Pending'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
          </Select>
          <Button size="sm" variant="outline" onClick={exportRows}><Download size={14} /> Export</Button>
        </>
      }>
        <DataTable
          rows={visible}
          rowKey={(r) => r.key}
          empty="No settled online orders in this period."
          cols={[
            { key: 'id', header: 'Order ID', render: (r) => <span className="font-mono text-xs">{r.key}</span> },
            { key: 'p', header: 'Platform', render: (r) => <span className="capitalize">{r.platform}</span> },
            { key: 'at', header: 'Date', render: (r) => <span className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(r.at)}</span> },
            { key: 'g', header: 'Gross', className: 'text-right', render: (r) => inr(r.gross, 2) },
            { key: 'c', header: 'Comm.', className: 'text-right', render: (r) => <span className="text-slate-500">{inr(r.commission + r.gstOnCommission, 2)}</span> },
            { key: 'd', header: 'TCS/TDS/PG', className: 'text-right', render: (r) => <span className="text-slate-500">{inr(r.tcs + r.tds + r.pgFee, 2)}</span> },
            { key: 'e', header: 'Expected', className: 'text-right', render: (r) => <b>{inr(r.expected, 2)}</b> },
            { key: 'r', header: 'Received', className: 'text-right', render: (r) => (r.received !== undefined ? inr(r.received, 2) : '—') },
            { key: 'df', header: 'Diff', className: 'text-right', render: (r) => (r.diff !== undefined ? <span className={Math.abs(r.diff) <= 1 ? 'text-slate-400' : r.diff < 0 ? 'font-semibold text-red-600' : 'font-semibold text-slate-600'}>{r.diff > 0 ? '+' : ''}{inr(r.diff, 2)}</span> : '—') },
            { key: 's', header: 'Status', render: (r) => (
              <span className="inline-flex items-center gap-1">
                {r.status === 'Matched' ? <CheckCircle2 size={14} className="text-brand-700" /> : r.status === 'Missing' ? <XCircle size={14} className="text-red-500" /> : null}
                {statusBadge(r.status)}
              </span>
            ) },
          ]}
        />
      </Card>
    </div>
  );
}
