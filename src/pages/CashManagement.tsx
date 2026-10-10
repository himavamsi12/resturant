import { Lock, Plus, Printer, Trash2, Unlock, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Card, DataTable, Empty, Field, Input, PageHeader, Pills, Select, StatCard, Tabs, clsx } from '../components/ui';
import { EXPENSE_CATEGORIES } from '../data/seed';
import { fmtDate, fmtDateTime, fmtTime, inr, startOfDay } from '../lib/billing';
import { useStore } from '../store/useStore';
import type { Expense, Order, PaymentMode, Shift } from '../types';

const DAY = 86400000;
const MODES: PaymentMode[] = ['cash', 'card', 'upi', 'wallet', 'due', 'online'];
type Tab = 'shift' | 'expenses' | 'dayend';

const toInput = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fromInput = (v: string) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };

/** Collections by payment mode for orders settled in [from, to). */
function collections(orders: Order[], from: number, to: number) {
  const by: Record<string, number> = {};
  orders.filter((o) => o.status === 'settled' && (o.settledAt || o.createdAt) >= from && (o.settledAt || o.createdAt) < to)
    .forEach((o) => o.payments.forEach((p) => { by[p.mode] = (by[p.mode] || 0) + p.amount; }));
  return by;
}

function shiftExpected(sh: Shift, orders: Order[], expenses: Expense[]) {
  const end = sh.closedAt || Date.now();
  const by = collections(orders, sh.openedAt, end);
  const cashExp = expenses.filter((e) => e.mode === 'cash' && e.at >= sh.openedAt && e.at < end).reduce((s, e) => s + e.amount, 0);
  return { by, cashExp, expected: sh.openingCash + (by.cash || 0) - cashExp };
}

export default function CashManagement() {
  const [tab, setTab] = useState<Tab>('shift');
  return (
    <div className="px-4 pb-12 pt-2 sm:px-6">
      <PageHeader title="Cash & Expenses" subtitle="Cash drawer shifts, petty expenses and day-end closing." />
      <Tabs<Tab> value={tab} onChange={setTab} className="mb-5" tabs={[
        { id: 'shift', label: 'Shift / Cash Drawer' }, { id: 'expenses', label: 'Expenses' }, { id: 'dayend', label: 'Day End (Z-Report)' },
      ]} />
      {tab === 'shift' && <ShiftTab />}
      {tab === 'expenses' && <ExpensesTab />}
      {tab === 'dayend' && <DayEndTab />}
    </div>
  );
}

function ShiftTab() {
  const shifts = useStore((s) => s.shifts);
  const orders = useStore((s) => s.orders);
  const expenses = useStore((s) => s.expenses);
  const staff = useStore((s) => s.staff);
  const openShift = useStore((s) => s.openShift);
  const closeShift = useStore((s) => s.closeShift);
  const toast = useStore((s) => s.toast);
  const [opening, setOpening] = useState('5000');
  const [counted, setCounted] = useState('');

  const current = shifts[0] && !shifts[0].closedAt ? shifts[0] : undefined;
  const cur = current ? shiftExpected(current, orders, expenses) : undefined;
  const variance = cur && counted !== '' ? +counted - cur.expected : undefined;
  const staffName = (id: string) => staff.find((s) => s.id === id)?.name || id;

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        {!current ? (
          <Card title="Open a new shift">
            <div className="flex flex-wrap items-end gap-3 p-4">
              <Field label="Opening cash in drawer (₹)"><Input type="number" min={0} value={opening} onChange={(e) => setOpening(e.target.value)} className="w-48" /></Field>
              <Button onClick={() => { openShift(+opening || 0); toast('Shift opened'); }}><Unlock size={16} /> Open shift</Button>
              <p className="w-full text-sm text-slate-500">No shift is currently open. Open a shift to start tracking the cash drawer for this terminal.</p>
            </div>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 glass rounded-2xl px-4 py-3 text-sm text-slate-800">
              <Badge color="green">Shift open</Badge>
              <span>Opened by <b>{staffName(current.staffId)}</b> at {fmtDateTime(current.openedAt)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label="Opening cash" value={inr(current.openingCash)} />
              <StatCard label="Cash sales" value={inr(cur!.by.cash || 0)} tone="green" />
              <StatCard label="Cash expenses" value={inr(cur!.cashExp)} tone="red" />
              <StatCard label="Expected in drawer" value={inr(cur!.expected)} tone="blue" icon={<Wallet size={16} />} />
            </div>
            <Card title="Collections this shift">
              <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3">
                {MODES.map((m) => (
                  <div key={m} className="bg-white p-3">
                    <div className="text-xs text-slate-500">{m}</div>
                    <div className="text-lg font-semibold">{inr(cur!.by[m] || 0)}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Close shift">
              <div className="flex flex-wrap items-end gap-3 p-4">
                <Field label="Counted cash in drawer (₹)"><Input type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} className="w-48" /></Field>
                {variance !== undefined && (
                  <div className={clsx('rounded-lg px-3 py-2 text-sm font-semibold', Math.abs(variance) < 1 ? 'bg-brand-500/10 text-brand-700' : variance < 0 ? 'bg-red-500/[.06] text-red-600' : 'bg-white/55 text-amber-700')}>
                    Variance: {variance > 0 ? '+' : ''}{inr(variance)} {Math.abs(variance) < 1 ? '(tallied)' : variance < 0 ? '(short)' : '(excess)'}
                  </div>
                )}
                <Button variant="secondary" disabled={counted === ''} onClick={() => { closeShift(+counted); setCounted(''); toast('Shift closed'); }}><Lock size={16} /> Close shift</Button>
              </div>
            </Card>
          </>
        )}
      </div>

      <Card title="Shift history" className="xl:col-span-1">
        {shifts.filter((s) => s.closedAt).length === 0 ? <Empty title="No closed shifts yet" /> : (
          <div className="divide-y divide-slate-100">
            {shifts.filter((s) => s.closedAt).map((sh) => {
              const e = shiftExpected(sh, orders, expenses);
              const v = (sh.closingCash || 0) - e.expected;
              return (
                <div key={sh.id} className="px-4 py-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{staffName(sh.staffId)}</span>
                    <span className={clsx('font-semibold', Math.abs(v) < 1 ? 'text-brand-700' : 'text-red-600')}>{v > 0 ? '+' : ''}{inr(v)}</span>
                  </div>
                  <div className="text-xs text-slate-500">{fmtDate(sh.openedAt)} · {fmtTime(sh.openedAt)} – {fmtTime(sh.closedAt!)}</div>
                  <div className="text-xs text-slate-500">Open {inr(sh.openingCash)} · Expected {inr(e.expected)} · Counted {inr(sh.closingCash || 0)}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function ExpensesTab() {
  const expenses = useStore((s) => s.expenses);
  const addExpense = useStore((s) => s.addExpense);
  const deleteExpense = useStore((s) => s.deleteExpense);
  const toast = useStore((s) => s.toast);
  const [form, setForm] = useState({ category: EXPENSE_CATEGORIES[0], amount: '', mode: 'cash' as PaymentMode, note: '' });
  const [cat, setCat] = useState('all');
  const [range, setRange] = useState<'today' | '7d' | '30d' | 'all'>('30d');

  const from = range === 'all' ? 0 : startOfDay() - (range === 'today' ? 0 : range === '7d' ? 6 : 29) * DAY;
  const list = expenses.filter((e) => e.at >= from && (cat === 'all' || e.category === cat)).sort((a, b) => b.at - a.at);
  const total = list.reduce((s, e) => s + e.amount, 0);
  const byCat = useMemo(() => {
    const m: Record<string, number> = {};
    list.forEach((e) => { m[e.category] = (m[e.category] || 0) + e.amount; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [list]);

  const submit = () => {
    const amt = +form.amount;
    if (!amt || amt <= 0) { toast('Enter a valid amount', 'error'); return; }
    addExpense({ category: form.category, amount: amt, mode: form.mode, note: form.note.trim() || form.category });
    setForm({ ...form, amount: '', note: '' });
    toast('Expense recorded');
  };

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4">
        <Card title="Add expense">
          <div className="space-y-3 p-4">
            <Field label="Category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (₹)"><Input type="number" min={0} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
              <Field label="Paid via">
                <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as PaymentMode })}>
                  {(['cash', 'upi', 'card'] as PaymentMode[]).map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Note"><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Gas cylinder refill" /></Field>
            <Button className="w-full" onClick={submit}><Plus size={16} /> Add expense</Button>
            <p className="text-xs text-slate-400">Cash expenses are deducted from the expected drawer cash of the open shift.</p>
          </div>
        </Card>
        <Card title="By category">
          <div className="space-y-2 p-4">
            {byCat.length === 0 && <p className="text-sm text-slate-400">No expenses</p>}
            {byCat.map(([k, v]) => (
              <div key={k}>
                <div className="mb-1 flex justify-between text-xs"><span className="font-medium">{k}</span><span>{inr(v)}</span></div>
                <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${(v / total) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="xl:col-span-2" title={<span>Expenses · <span className="text-brand-600">{inr(total)}</span></span>} actions={
        <>
          <Pills value={range} onChange={setRange} options={[{ id: 'today', label: 'Today' }, { id: '7d', label: '7D' }, { id: '30d', label: '30D' }, { id: 'all', label: 'All' }]} />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="!w-auto !py-1.5 text-xs">
            <option value="all">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </>
      }>
        <DataTable rows={list} rowKey={(e) => e.id} empty="No expenses for this filter" cols={[
          { key: 'at', header: 'Date', render: (e) => <span className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(e.at)}</span> },
          { key: 'c', header: 'Category', render: (e) => <Badge>{e.category}</Badge> },
          { key: 'n', header: 'Note', render: (e) => e.note },
          { key: 'm', header: 'Mode', render: (e) => <span className="text-xs">{e.mode}</span> },
          { key: 'a', header: 'Amount', className: 'text-right', render: (e) => <b>{inr(e.amount)}</b> },
          { key: 'x', header: '', className: 'w-10', render: (e) => <button onClick={() => { deleteExpense(e.id); toast('Expense deleted', 'info'); }} className="rounded p-1 text-slate-400 hover:bg-red-500/[.06] hover:text-red-600"><Trash2 size={15} /></button> },
        ]} />
      </Card>
    </div>
  );
}

function DayEndTab() {
  const orders = useStore((s) => s.orders);
  const expenses = useStore((s) => s.expenses);
  const settings = useStore((s) => s.settings);
  const outlet = useStore((s) => s.outlets.find((o) => o.id === s.outletId));
  const [date, setDate] = useState(toInput(Date.now()));

  const from = fromInput(date);
  const to = from + DAY;
  const day = orders.filter((o) => o.createdAt >= from && o.createdAt < to);
  const sales = day.filter((o) => o.status === 'settled');
  const cancelled = day.filter((o) => o.status === 'cancelled');
  const open = day.filter((o) => o.status === 'open' || o.status === 'billed');
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const gross = sum(sales.map((o) => o.subtotal));
  const disc = sum(sales.map((o) => o.discountAmount));
  const sc = sum(sales.map((o) => o.serviceCharge));
  const tax = sum(sales.map((o) => o.tax));
  const charges = sum(sales.map((o) => (o.packagingCharge || 0) + (o.deliveryCharge || 0)));
  const ro = sum(sales.map((o) => o.roundOff));
  const net = sum(sales.map((o) => o.total));
  const pay: Record<string, number> = {};
  sales.forEach((o) => o.payments.forEach((p) => { pay[p.mode] = (pay[p.mode] || 0) + p.amount; }));
  const types: Record<string, { n: number; amt: number }> = {};
  sales.forEach((o) => { const t = (types[o.orderType] ||= { n: 0, amt: 0 }); t.n++; t.amt += o.total; });
  const dayExp = expenses.filter((e) => e.at >= from && e.at < to);
  const cashExp = sum(dayExp.filter((e) => e.mode === 'cash').map((e) => e.amount));
  const pax = sum(sales.map((o) => o.pax || 0));
  const billNos = sales.map((o) => o.billNo || 0).filter(Boolean);

  const Line = ({ l, v, bold, neg }: { l: string; v: number | string; bold?: boolean; neg?: boolean }) => (
    <div className={clsx('flex justify-between py-0.5', bold && 'font-bold')}>
      <span>{l}</span><span className="tabular-nums">{typeof v === 'number' ? `${neg ? '−' : ''}${inr(Math.abs(v), 2)}` : v}</span>
    </div>
  );
  const Sep = () => <div className="my-1.5 border-t border-dashed border-slate-400" />;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-end gap-3 p-4">
            <Field label="Business date"><Input type="date" value={date} max={toInput(Date.now())} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
            <Button variant="outline" onClick={() => setDate(toInput(startOfDay() - DAY))}>Yesterday</Button>
            <Button variant="outline" onClick={() => setDate(toInput(Date.now()))}>Today</Button>
            <Button onClick={() => window.print()}><Printer size={16} /> Print Z-Report</Button>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Net sales" value={inr(net)} sub={`${sales.length} bills`} />
          <StatCard label="Avg bill" value={inr(sales.length ? net / sales.length : 0)} sub={pax ? `${pax} covers` : undefined} />
          <StatCard label="Cancelled" value={cancelled.length} sub={inr(sum(cancelled.map((o) => o.total)))} tone="red" />
          <StatCard label="Net cash" value={inr((pay.cash || 0) - cashExp)} sub="Cash sales − cash expenses" tone="green" />
        </div>
        {open.length > 0 && (
          <div className="glass rounded-2xl px-4 py-3 text-sm text-slate-800">
            ⚠️ {open.length} order(s) are still open/unsettled for this day ({inr(sum(open.map((o) => o.total)))}). Settle them before closing the day.
          </div>
        )}
      </div>

      <div className="print-area mx-auto w-[320px] rounded-lg border border-slate-200 bg-white p-5 font-mono text-[12px] leading-snug text-slate-800 shadow-sm">
        <div className="text-center">
          <div className="text-sm font-bold">{settings.restaurantName}</div>
          <div>{outlet?.name}</div>
          <div className="mt-1 font-bold">*** Z-REPORT / DAY END ***</div>
          <div>Date: {fmtDate(from)}</div>
          <div>Printed: {fmtDateTime(Date.now())}</div>
        </div>
        <Sep />
        <Line l="Bills" v={`${sales.length}`} />
        <Line l="Bill range" v={billNos.length ? `#${Math.min(...billNos)} – #${Math.max(...billNos)}` : '-'} />
        <Line l="Covers (pax)" v={`${pax}`} />
        <Sep />
        <Line l="Gross sales" v={gross} />
        <Line l="Discounts" v={disc} neg />
        <Line l="Service charge" v={sc} />
        <Line l="Packaging/Delivery" v={charges} />
        <Line l="CGST" v={tax / 2} />
        <Line l="SGST" v={tax / 2} />
        <Line l="Round off" v={ro.toFixed(2)} />
        <Sep />
        <Line l="NET SALES" v={net} bold />
        <Sep />
        <div className="font-bold">PAYMENT MODES</div>
        {Object.keys(pay).length === 0 && <div>-</div>}
        {Object.entries(pay).map(([k, v]) => <Line key={k} l={k.toUpperCase()} v={v} />)}
        <Sep />
        <div className="font-bold">ORDER TYPES</div>
        {Object.entries(types).map(([k, v]) => <Line key={k} l={`${k} (${v.n})`} v={v.amt} />)}
        <Sep />
        <Line l={`Cancelled (${cancelled.length})`} v={sum(cancelled.map((o) => o.total))} />
        <Line l={`Expenses (${dayExp.length})`} v={sum(dayExp.map((e) => e.amount))} />
        <Line l="  of which cash" v={cashExp} />
        <Sep />
        <Line l="NET CASH IN HAND" v={(pay.cash || 0) - cashExp} bold />
        <Sep />
        <div className="text-center">--- End of report ---</div>
      </div>
    </div>
  );
}
