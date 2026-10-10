import { Cake, Download, Edit2, Gift, Plus, Repeat, Trash2, TrendingUp, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CUSTOMER_LABELS } from '../data/seed';
import { downloadCSV, fmtDate, inr, uid } from '../lib/billing';
import { useStore } from '../store/useStore';
import type { Customer } from '../types';
import {
  Badge, Button, Card, clsx, DataTable, Field, Input, Modal, PageHeader, SearchInput, Select, StatCard, Textarea, Toggle,
} from '../components/ui';

type SortKey = 'spent' | 'visits' | 'last' | 'name';

const blank = (): Customer => ({ id: uid('cu'), name: '', phone: '', labels: [], points: 0, wallet: 0, visits: 0, totalSpent: 0, createdAt: Date.now() });

/** Days until the next occurrence of a YYYY-MM-DD anniversary (ignoring year). */
function daysUntil(date?: string) {
  if (!date) return Infinity;
  const [, m, d] = date.split('-').map(Number);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let next = new Date(now.getFullYear(), m - 1, d);
  if (next < now) next = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - now.getTime()) / 86400000);
}

export default function Customers() {
  const customers = useStore((s) => s.customers);
  const deleteCustomer = useStore((s) => s.deleteCustomer);
  const toast = useStore((s) => s.toast);
  const [q, setQ] = useState('');
  const [label, setLabel] = useState('all');
  const [sort, setSort] = useState<SortKey>('spent');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const allLabels = useMemo(() => Array.from(new Set([...CUSTOMER_LABELS, ...customers.flatMap((c) => c.labels)])), [customers]);

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const newThisMonth = customers.filter((c) => c.createdAt >= monthStart.getTime()).length;
  const withVisits = customers.filter((c) => c.visits > 0);
  const repeat = withVisits.length ? (customers.filter((c) => c.visits > 1).length / withVisits.length) * 100 : 0;
  const totalSpent = customers.reduce((a, c) => a + c.totalSpent, 0);
  const totalVisits = customers.reduce((a, c) => a + c.visits, 0);

  const rows = useMemo(() => {
    const ql = q.toLowerCase();
    const list = customers.filter((c) => (label === 'all' || c.labels.includes(label)) && (!ql || c.name.toLowerCase().includes(ql) || c.phone.includes(ql) || c.email?.toLowerCase().includes(ql)));
    const by: Record<SortKey, (a: Customer, b: Customer) => number> = {
      spent: (a, b) => b.totalSpent - a.totalSpent,
      visits: (a, b) => b.visits - a.visits,
      last: (a, b) => (b.lastVisit || 0) - (a.lastVisit || 0),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return [...list].sort(by[sort]);
  }, [customers, q, label, sort]);

  const birthdays = useMemo(() => customers
    .flatMap((c) => [
      { c, kind: 'Birthday', days: daysUntil(c.birthday) },
      { c, kind: 'Anniversary', days: daysUntil(c.anniversary) },
    ])
    .filter((x) => x.days <= 30)
    .sort((a, b) => a.days - b.days)
    .slice(0, 8), [customers]);

  const exportCsv = () => {
    downloadCSV('customers', [
      ['Name', 'Phone', 'Email', 'Birthday', 'Anniversary', 'Labels', 'Visits', 'Total Spent', 'Points', 'Wallet', 'Last Visit'],
      ...rows.map((c) => [c.name, c.phone, c.email || '', c.birthday || '', c.anniversary || '', c.labels.join('|'), c.visits, c.totalSpent, c.points, c.wallet, c.lastVisit ? fmtDate(c.lastVisit) : '']),
    ]);
    toast(`Exported ${rows.length} customers`);
  };

  return (
    <div className="px-4 pb-12 pt-2 sm:px-6">
      <PageHeader
        title="Customer Relationship Management"
        subtitle="Unified customer data from dine-in, captain app, website & aggregator orders"
        actions={<>
          <Button variant="outline" onClick={exportCsv}><Download size={16} /> Export CSV</Button>
          <Button onClick={() => setEditing(blank())}><UserPlus size={16} /> Add Customer</Button>
        </>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Customers" value={customers.length} icon={<Users size={16} />} tone="blue" />
        <StatCard label="New This Month" value={newThisMonth} icon={<Plus size={16} />} tone="green" />
        <StatCard label="Repeat Rate" value={`${repeat.toFixed(0)}%`} sub="Customers with 2+ visits" icon={<Repeat size={16} />} tone="purple" />
        <StatCard label="Avg Spend / Visit" value={inr(totalVisits ? totalSpent / totalVisits : 0)} icon={<TrendingUp size={16} />} tone="orange" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <SearchInput value={q} onChange={setQ} placeholder="Search name, phone, email…" />
            <Select value={label} onChange={(e) => setLabel(e.target.value)} className="!w-auto">
              <option value="all">All labels</option>
              {allLabels.map((l) => <option key={l}>{l}</option>)}
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="!w-auto">
              <option value="spent">Sort: Total spend</option>
              <option value="visits">Sort: Visits</option>
              <option value="last">Sort: Last visit</option>
              <option value="name">Sort: Name</option>
            </Select>
            <span className="ml-auto text-xs text-slate-500">{rows.length} customers</span>
          </div>
          <DataTable
            rows={rows}
            rowKey={(c) => c.id}
            onRowClick={(c) => setProfileId(c.id)}
            cols={[
              { key: 'name', header: 'Customer', render: (c) => (
                <div>
                  <div className="font-medium text-slate-900">{c.name} {c.dndPromo && <Badge color="gray">DND</Badge>}</div>
                  <div className="text-xs text-slate-500">{c.phone}</div>
                </div>
              ) },
              { key: 'labels', header: 'Labels', render: (c) => <div className="flex flex-wrap gap-1">{c.labels.map((l) => <Badge key={l} color={l === 'VIP' ? 'purple' : l === 'Corporate' ? 'blue' : 'gray'}>{l}</Badge>)}</div> },
              { key: 'visits', header: 'Visits', className: 'text-right', render: (c) => c.visits },
              { key: 'spent', header: 'Spent', className: 'text-right', render: (c) => inr(c.totalSpent) },
              { key: 'points', header: 'Points', className: 'text-right', render: (c) => c.points },
              { key: 'last', header: 'Last Visit', render: (c) => (c.lastVisit ? fmtDate(c.lastVisit) : '—') },
              { key: 'act', header: '', className: 'text-right', render: (c) => (
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Edit2 size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Delete ${c.name}?`)) { deleteCustomer(c.id); toast('Customer deleted'); } }}><Trash2 size={14} /></Button>
                </div>
              ) },
            ]}
          />
        </Card>

        <Card title={<span className="flex items-center gap-1.5"><Cake size={16} className="text-brand-600" /> Upcoming Special Days</span>}>
          <div className="divide-y divide-slate-100">
            {birthdays.length === 0 && <p className="p-4 text-sm text-slate-400">No birthdays or anniversaries in the next 30 days.</p>}
            {birthdays.map(({ c, kind, days }) => (
              <button key={c.id + kind} onClick={() => setProfileId(c.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                <span className="text-xl">{kind === 'Birthday' ? '🎂' : '💍'}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-800">{c.name}</div>
                  <div className="text-xs text-slate-500">{kind}</div>
                </div>
                <Badge color={days === 0 ? 'red' : days <= 7 ? 'yellow' : 'gray'}>{days === 0 ? 'Today' : `in ${days}d`}</Badge>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {editing && <CustomerForm customer={editing} labels={allLabels} onClose={() => setEditing(null)} />}
      {profileId && <CustomerProfile id={profileId} onClose={() => setProfileId(null)} onEdit={(c) => { setProfileId(null); setEditing(c); }} />}
    </div>
  );
}

function CustomerForm({ customer, labels, onClose }: { customer: Customer; labels: string[]; onClose: () => void }) {
  const upsert = useStore((s) => s.upsertCustomer);
  const customers = useStore((s) => s.customers);
  const toast = useStore((s) => s.toast);
  const [c, setC] = useState<Customer>(customer);
  const [custom, setCustom] = useState('');
  const isNew = !customers.some((x) => x.id === customer.id);

  const toggleLabel = (l: string) => setC({ ...c, labels: c.labels.includes(l) ? c.labels.filter((x) => x !== l) : [...c.labels, l] });

  const save = () => {
    if (!c.name.trim() || !/^\d{10}$/.test(c.phone)) return toast('Name and a 10-digit phone are required', 'error');
    if (customers.some((x) => x.phone === c.phone && x.id !== c.id)) return toast('Another customer already has this phone', 'error');
    upsert({ ...c, name: c.name.trim() });
    toast(isNew ? 'Customer added' : 'Customer updated');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add Customer' : 'Edit Customer'} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name *"><Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} autoFocus /></Field>
        <Field label="Phone *"><Input value={c.phone} maxLength={10} onChange={(e) => setC({ ...c, phone: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label="Email" className="sm:col-span-2"><Input type="email" value={c.email || ''} onChange={(e) => setC({ ...c, email: e.target.value })} /></Field>
        <Field label="Birthday"><Input type="date" value={c.birthday || ''} onChange={(e) => setC({ ...c, birthday: e.target.value })} /></Field>
        <Field label="Anniversary"><Input type="date" value={c.anniversary || ''} onChange={(e) => setC({ ...c, anniversary: e.target.value })} /></Field>
      </div>
      <Field label="Labels" className="mt-3">
        <div className="flex flex-wrap gap-1.5">
          {Array.from(new Set([...labels, ...c.labels])).map((l) => (
            <button key={l} type="button" onClick={() => toggleLabel(l)}
              className={clsx('rounded-full border px-2.5 py-1 text-xs font-medium', c.labels.includes(l) ? 'border-brand-600 bg-brand-500/10 text-brand-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50')}>
              {l}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input placeholder="Custom label…" value={custom} onChange={(e) => setCustom(e.target.value)} />
          <Button variant="outline" type="button" onClick={() => { const v = custom.trim(); if (v && !c.labels.includes(v)) setC({ ...c, labels: [...c.labels, v] }); setCustom(''); }}>Add</Button>
        </div>
      </Field>
      <Field label="Notes" className="mt-3"><Textarea rows={2} value={c.notes || ''} onChange={(e) => setC({ ...c, notes: e.target.value })} placeholder="Allergies, preferences, special discount…" /></Field>
      <div className="mt-3"><Toggle checked={!!c.dndPromo} onChange={(v) => setC({ ...c, dndPromo: v })} label="Do not send promotional messages (DND)" /></div>
    </Modal>
  );
}

function CustomerProfile({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (c: Customer) => void }) {
  const c = useStore((s) => s.customers.find((x) => x.id === id));
  const allOrders = useStore((s) => s.orders);
  const allFeedback = useStore((s) => s.feedbacks);
  const upsert = useStore((s) => s.upsertCustomer);
  const toast = useStore((s) => s.toast);
  const pointValue = useStore((s) => s.settings.pointValue);
  const [pts, setPts] = useState('');
  const [note, setNote] = useState('');

  const orders = useMemo(() => allOrders.filter((o) => o.customerId === id).sort((a, b) => b.createdAt - a.createdAt), [allOrders, id]);
  const feedback = allFeedback.filter((f) => f.customerId === id);
  const favourites = useMemo(() => {
    const m: Record<string, number> = {};
    orders.filter((o) => o.status === 'settled').forEach((o) => o.items.forEach((l) => { m[l.name] = (m[l.name] || 0) + l.qty; }));
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [orders]);

  if (!c) return null;

  const adjust = (sign: 1 | -1) => {
    const n = parseInt(pts, 10);
    if (!n || n <= 0) return toast('Enter points', 'error');
    if (sign < 0 && n > c.points) return toast('Not enough points', 'error');
    upsert({ ...c, points: c.points + sign * n });
    toast(sign > 0 ? `${n} bonus points awarded` : `${n} points deducted`);
    setPts('');
  };

  const addNote = () => {
    if (!note.trim()) return;
    upsert({ ...c, notes: [c.notes, `${fmtDate(Date.now())}: ${note.trim()}`].filter(Boolean).join('\n') });
    toast('Note saved — shown at billing');
    setNote('');
  };

  return (
    <Modal open onClose={onClose} size="lg" title={
      <span className="flex items-center gap-2">{c.name} {c.labels.map((l) => <Badge key={l}>{l}</Badge>)}</span>
    } footer={<Button variant="outline" onClick={() => onEdit(c)}><Edit2 size={14} /> Edit details</Button>}>
      <div className="mb-4 text-sm text-slate-500">
        📞 {c.phone} {c.email && <>· ✉️ {c.email}</>} {c.birthday && <>· 🎂 {fmtDate(new Date(c.birthday).getTime())}</>} {c.anniversary && <>· 💍 {fmtDate(new Date(c.anniversary).getTime())}</>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Visits" value={c.visits} />
        <StatCard label="Total Spent" value={inr(c.totalSpent)} />
        <StatCard label="Points" value={c.points} sub={`Worth ${inr(c.points * pointValue)}`} />
        <StatCard label={c.wallet > 0 ? 'Due Amount' : 'Wallet'} value={inr(Math.abs(c.wallet))} tone={c.wallet > 0 ? 'red' : 'gray'} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white/55 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Gift size={15} /> Loyalty points</div>
          <div className="flex gap-2">
            <Input type="number" min={1} placeholder="Points" value={pts} onChange={(e) => setPts(e.target.value)} />
            <Button variant="success" onClick={() => adjust(1)}>Award</Button>
            <Button variant="outline" onClick={() => adjust(-1)}>Deduct</Button>
          </div>
          <div className="mt-3 text-sm font-semibold">Special note / discount</div>
          <div className="mt-1 flex gap-2">
            <Input placeholder="e.g. 10% off next visit" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button variant="outline" onClick={addNote}>Save</Button>
          </div>
          {c.notes && <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white/55 p-2 font-sans text-xs text-slate-800">{c.notes}</pre>}
        </div>
        <div className="rounded-2xl bg-white/55 p-3">
          <div className="mb-2 text-sm font-semibold">Favourite items</div>
          {favourites.length === 0 && <p className="text-sm text-slate-400">No orders yet</p>}
          {favourites.map(([name, qty]) => (
            <div key={name} className="flex justify-between py-1 text-sm"><span>{name}</span><span className="text-slate-500">×{qty}</span></div>
          ))}
          {feedback.length > 0 && <>
            <div className="mb-1 mt-3 text-sm font-semibold">Feedback</div>
            {feedback.map((f) => <div key={f.id} className="text-sm"><span className="text-slate-800">{'★'.repeat(f.rating)}</span> <span className="text-slate-600">{f.comment}</span></div>)}
          </>}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-sm font-semibold">Order history ({orders.length})</div>
        <div className="max-h-64 overflow-y-auto rounded-2xl bg-white/55">
          <DataTable rows={orders.slice(0, 50)} rowKey={(o) => o.id} empty="No orders" cols={[
            { key: 'bill', header: 'Bill', render: (o) => (o.billNo ? `#${o.billNo}` : '—') },
            { key: 'date', header: 'Date', render: (o) => fmtDate(o.createdAt) },
            { key: 'type', header: 'Type', render: (o) => <span className="capitalize">{o.orderType}</span> },
            { key: 'items', header: 'Items', render: (o) => <span className="text-xs">{o.items.map((l) => `${l.name}×${l.qty}`).join(', ')}</span> },
            { key: 'total', header: 'Total', className: 'text-right', render: (o) => inr(o.total) },
            { key: 'st', header: 'Status', render: (o) => <Badge color={o.status === 'settled' ? 'green' : o.status === 'cancelled' ? 'red' : 'yellow'}>{o.status}</Badge> },
          ]} />
        </div>
      </div>
    </Modal>
  );
}
