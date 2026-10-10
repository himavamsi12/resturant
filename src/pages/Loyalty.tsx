import { Award, Coins, Edit2, Plus, TicketPercent, Trash2, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { inr, uid } from '../lib/billing';
import { useStore } from '../store/useStore';
import type { Coupon, Customer } from '../types';
import {
  Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, SearchInput, Select, StatCard, Tabs, Toggle,
} from '../components/ui';

type Tab = 'program' | 'wallet' | 'coupons';

export default function Loyalty() {
  const [tab, setTab] = useState<Tab>('program');
  const customers = useStore((s) => s.customers);
  const coupons = useStore((s) => s.coupons);
  const pointValue = useStore((s) => s.settings.pointValue);
  const totalPoints = customers.reduce((a, c) => a + c.points, 0);
  const totalDue = customers.reduce((a, c) => a + Math.max(0, c.wallet), 0);

  return (
    <div className="px-4 pb-12 pt-2 sm:px-6">
      <PageHeader title="Loyalty & Coupons" subtitle="Reward points, customer wallet / dues and discount coupons" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Points Outstanding" value={totalPoints.toLocaleString('en-IN')} icon={<Coins size={16} />} tone="yellow" />
        <StatCard label="Liability" value={inr(totalPoints * pointValue)} sub="Value of unredeemed points" icon={<Award size={16} />} tone="purple" />
        <StatCard label="Pending Dues" value={inr(totalDue)} sub={`${customers.filter((c) => c.wallet > 0).length} customers`} icon={<Wallet size={16} />} tone="red" />
        <StatCard label="Active Coupons" value={coupons.filter((c) => c.active).length} sub={`${coupons.reduce((a, c) => a + c.usage, 0)} total uses`} icon={<TicketPercent size={16} />} tone="green" />
      </div>
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[
        { id: 'program', label: 'Loyalty Program' },
        { id: 'wallet', label: 'Wallet & Dues', count: customers.filter((c) => c.wallet !== 0).length },
        { id: 'coupons', label: 'Coupons', count: coupons.length },
      ]} />
      {tab === 'program' && <Program />}
      {tab === 'wallet' && <WalletTab />}
      {tab === 'coupons' && <Coupons />}
    </div>
  );
}

function Program() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const customers = useStore((s) => s.customers);
  const upsert = useStore((s) => s.upsertCustomer);
  const toast = useStore((s) => s.toast);
  const [earn, setEarn] = useState(settings.loyaltyEarnPercent);
  const [val, setVal] = useState(settings.pointValue);
  const [custId, setCustId] = useState('');
  const [pts, setPts] = useState('');
  const [q, setQ] = useState('');

  const leaders = useMemo(() => [...customers].sort((a, b) => b.points - a.points).slice(0, 15), [customers]);
  const matches = q ? customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q)).slice(0, 6) : [];
  const selected = customers.find((c) => c.id === custId);

  const apply = (sign: 1 | -1) => {
    const n = parseInt(pts, 10);
    if (!selected || !n || n <= 0) return toast('Pick a customer and enter points', 'error');
    if (sign < 0 && n > selected.points) return toast(`${selected.name} only has ${selected.points} points`, 'error');
    upsert({ ...selected, points: selected.points + sign * n });
    toast(sign > 0 ? `Awarded ${n} pts to ${selected.name}` : `Redeemed ${n} pts (${inr(n * settings.pointValue)}) for ${selected.name}`);
    setPts('');
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <div className="space-y-5">
        <Card title="Program Settings">
          <div className="space-y-3 p-4">
            <Field label="Points earned per ₹100 spent"><Input type="number" min={0} value={earn} onChange={(e) => setEarn(+e.target.value)} /></Field>
            <Field label="Value of 1 point (₹)"><Input type="number" min={0} step={0.1} value={val} onChange={(e) => setVal(+e.target.value)} /></Field>
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              A ₹1,000 bill earns <b>{Math.floor(10 * earn)} points</b> worth <b>{inr(Math.floor(10 * earn) * val, 2)}</b> — an effective cashback of <b>{(earn * val).toFixed(1)}%</b>.
            </div>
            <Button className="w-full" onClick={() => { update({ loyaltyEarnPercent: earn, pointValue: val }); toast('Loyalty settings saved'); }}>Save Settings</Button>
          </div>
        </Card>
        <Card title="Award / Redeem Points">
          <div className="space-y-3 p-4">
            <Field label="Customer">
              {selected ? (
                <div className="flex items-center justify-between rounded-xl bg-white/55 px-3 py-2 text-sm">
                  <span><b>{selected.name}</b> · {selected.points} pts</span>
                  <button className="text-xs text-brand-600" onClick={() => { setCustId(''); setQ(''); }}>Change</button>
                </div>
              ) : (
                <div className="relative">
                  <Input placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
                  {matches.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-2xl bg-[#efefef]/95 backdrop-blur-xl shadow-[0_20px_40px_-20px_rgba(0,0,0,.4)]">
                      {matches.map((c) => <button key={c.id} onClick={() => setCustId(c.id)} className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50">{c.name} <span className="text-slate-400">{c.phone}</span></button>)}
                    </div>
                  )}
                </div>
              )}
            </Field>
            <Field label="Points"><Input type="number" min={1} value={pts} onChange={(e) => setPts(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="success" onClick={() => apply(1)}>Award</Button>
              <Button variant="outline" onClick={() => apply(-1)}>Redeem</Button>
            </div>
          </div>
        </Card>
      </div>
      <Card title="Points Leaderboard">
        <DataTable rows={leaders} rowKey={(c) => c.id} cols={[
          { key: 'rank', header: '#', render: (c) => { const i = leaders.indexOf(c); return i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1; } },
          { key: 'name', header: 'Customer', render: (c) => <div><div className="font-medium">{c.name}</div><div className="text-xs text-slate-500">{c.phone}</div></div> },
          { key: 'tier', header: 'Tier', render: (c) => <Badge color={c.points > 500 ? 'purple' : c.points > 200 ? 'yellow' : 'gray'}>{c.points > 500 ? 'Gold' : c.points > 200 ? 'Silver' : 'Bronze'}</Badge> },
          { key: 'visits', header: 'Visits', className: 'text-right', render: (c) => c.visits },
          { key: 'spent', header: 'Spent', className: 'text-right', render: (c) => inr(c.totalSpent) },
          { key: 'pts', header: 'Points', className: 'text-right font-semibold', render: (c) => c.points },
          { key: 'val', header: 'Worth', className: 'text-right', render: (c) => inr(c.points * settings.pointValue) },
        ]} />
      </Card>
    </div>
  );
}

function WalletTab() {
  const customers = useStore((s) => s.customers);
  const upsert = useStore((s) => s.upsertCustomer);
  const toast = useStore((s) => s.toast);
  const [q, setQ] = useState('');
  const [paying, setPaying] = useState<Customer | null>(null);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'collect' | 'topup'>('collect');

  const rows = customers
    .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q))
    .sort((a, b) => b.wallet - a.wallet);

  const submit = () => {
    const n = parseFloat(amount);
    if (!paying || !n || n <= 0) return toast('Enter an amount', 'error');
    // wallet > 0 means customer owes (due); negative means prepaid credit balance
    upsert({ ...paying, wallet: +(paying.wallet - n).toFixed(2) });
    toast(mode === 'collect' ? `Received ${inr(n)} from ${paying.name}` : `Added ${inr(n)} credit to ${paying.name}`);
    setPaying(null); setAmount('');
  };

  return (
    <Card actions={<SearchInput value={q} onChange={setQ} placeholder="Search customer…" />} title="Customer Wallet & Dues">
      <DataTable rows={rows} rowKey={(c) => c.id} cols={[
        { key: 'name', header: 'Customer', render: (c) => <div><div className="font-medium">{c.name}</div><div className="text-xs text-slate-500">{c.phone}</div></div> },
        { key: 'st', header: 'Status', render: (c) => c.wallet > 0 ? <Badge color="red">Due</Badge> : c.wallet < 0 ? <Badge color="green">Credit</Badge> : <Badge>Settled</Badge> },
        { key: 'bal', header: 'Balance', className: 'text-right font-semibold', render: (c) => <span className={c.wallet > 0 ? 'text-red-600' : c.wallet < 0 ? 'text-brand-700' : ''}>{inr(Math.abs(c.wallet))}</span> },
        { key: 'act', header: '', className: 'text-right', render: (c) => (
          <div className="flex justify-end gap-1">
            {c.wallet > 0 && <Button size="sm" variant="success" onClick={() => { setPaying(c); setMode('collect'); setAmount(String(c.wallet)); }}>Receive Payment</Button>}
            <Button size="sm" variant="outline" onClick={() => { setPaying(c); setMode('topup'); setAmount(''); }}>Add Credit</Button>
          </div>
        ) },
      ]} />
      <Modal open={!!paying} onClose={() => setPaying(null)} size="sm" title={mode === 'collect' ? 'Receive Due Payment' : 'Add Wallet Credit'}
        footer={<><Button variant="outline" onClick={() => setPaying(null)}>Cancel</Button><Button onClick={submit}>Confirm</Button></>}>
        {paying && <>
          <p className="mb-3 text-sm text-slate-600">{paying.name} — current {paying.wallet > 0 ? 'due' : 'credit'}: <b>{inr(Math.abs(paying.wallet))}</b></p>
          <Field label="Amount (₹)"><Input type="number" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        </>}
      </Modal>
    </Card>
  );
}

const blankCoupon = (): Coupon => ({ id: uid('cp'), code: '', type: 'percent', value: 10, minOrder: 0, active: true, usage: 0 });

function Coupons() {
  const coupons = useStore((s) => s.coupons);
  const upsert = useStore((s) => s.upsertCoupon);
  const del = useStore((s) => s.deleteCoupon);
  const toast = useStore((s) => s.toast);
  const [edit, setEdit] = useState<Coupon | null>(null);

  const save = () => {
    if (!edit) return;
    const code = edit.code.trim().toUpperCase();
    if (!code || edit.value <= 0) return toast('Code and value are required', 'error');
    if (edit.type === 'percent' && edit.value > 100) return toast('Percent cannot exceed 100', 'error');
    if (coupons.some((c) => c.code === code && c.id !== edit.id)) return toast('Coupon code already exists', 'error');
    upsert({ ...edit, code });
    toast('Coupon saved');
    setEdit(null);
  };

  return (
    <Card title="Discount Coupons" actions={<Button size="sm" onClick={() => setEdit(blankCoupon())}><Plus size={14} /> New Coupon</Button>}>
      <DataTable rows={coupons} rowKey={(c) => c.id} cols={[
        { key: 'code', header: 'Code', render: (c) => <span className="rounded bg-brand-500/10 px-2 py-0.5 font-mono text-sm font-bold text-brand-700">{c.code}</span> },
        { key: 'off', header: 'Discount', render: (c) => (c.type === 'percent' ? `${c.value}% off` : `${inr(c.value)} off`) + (c.maxDiscount ? ` (max ${inr(c.maxDiscount)})` : '') },
        { key: 'min', header: 'Min Order', render: (c) => (c.minOrder ? inr(c.minOrder) : '—') },
        { key: 'use', header: 'Used', className: 'text-right', render: (c) => c.usage },
        { key: 'active', header: 'Active', render: (c) => <Toggle size="sm" checked={c.active} onChange={(v) => upsert({ ...c, active: v })} /> },
        { key: 'act', header: '', className: 'text-right', render: (c) => (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEdit(c)}><Edit2 size={14} /></Button>
            <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete coupon ${c.code}?`)) { del(c.id); toast('Coupon deleted'); } }}><Trash2 size={14} /></Button>
          </div>
        ) },
      ]} />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit && coupons.some((c) => c.id === edit.id) ? 'Edit Coupon' : 'New Coupon'}
        footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        {edit && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Coupon Code" className="sm:col-span-2"><Input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase().replace(/\s/g, '') })} placeholder="e.g. WEEKEND15" /></Field>
            <Field label="Type">
              <Select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as Coupon['type'] })}>
                <option value="percent">Percentage</option><option value="flat">Flat amount</option>
              </Select>
            </Field>
            <Field label={edit.type === 'percent' ? 'Discount %' : 'Discount ₹'}><Input type="number" value={edit.value} onChange={(e) => setEdit({ ...edit, value: +e.target.value })} /></Field>
            <Field label="Minimum order ₹"><Input type="number" value={edit.minOrder} onChange={(e) => setEdit({ ...edit, minOrder: +e.target.value })} /></Field>
            <Field label="Max discount ₹" hint="Leave empty for no cap"><Input type="number" value={edit.maxDiscount ?? ''} disabled={edit.type === 'flat'} onChange={(e) => setEdit({ ...edit, maxDiscount: e.target.value ? +e.target.value : undefined })} /></Field>
            <div className="sm:col-span-2"><Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Active" /></div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
