import { ArrowRightLeft, CalendarPlus, Clock, Combine, Pencil, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, clsx, DataTable, Field, Input, Modal, PageHeader, Pills, Select, Tabs, Textarea, type BadgeColor } from '../components/ui';
import { fmtDateTime, inr, uid } from '../lib/billing';
import { useStore } from '../store/useStore';
import type { Reservation, Table, TableStatus } from '../types';

const STATUS: Record<TableStatus, { label: string; card: string; dot: string }> = {
  blank: { label: 'Blank', card: 'bg-white/40 hover:bg-white/75', dot: 'bg-black/15' },
  running: { label: 'Running', card: 'bg-white/80 hover:bg-white/95', dot: 'bg-sky-500' },
  printed: { label: 'Printed', card: 'bg-white/80 hover:bg-white/95', dot: 'bg-brand-600' },
  paid: { label: 'Paid', card: 'bg-white/80 hover:bg-white/95', dot: 'bg-amber-500' },
  reserved: { label: 'Reserved', card: 'bg-white/60 hover:bg-white/85', dot: 'bg-violet-500' },
};

export default function Tables() {
  const [tab, setTab] = useState<'floor' | 'reservations'>('floor');
  const upcoming = useStore((s) => s.reservations.filter((r) => r.status === 'booked').length);
  return (
    <div className="px-4 pb-12 pt-4 sm:px-6">
      <PageHeader title="Tables" subtitle="Live floor plan, table moves & merges, and reservations" />
      <Tabs tabs={[{ id: 'floor', label: 'Floor plan' }, { id: 'reservations', label: 'Reservations', count: upcoming }]} value={tab} onChange={setTab} className="mb-5" />
      {tab === 'floor' ? <FloorPlan /> : <Reservations />}
    </div>
  );
}

function FloorPlan() {
  const navigate = useNavigate();
  const areas = useStore((s) => s.areas);
  const tables = useStore((s) => s.tables);
  const orders = useStore((s) => s.orders);
  const reservations = useStore((s) => s.reservations);
  const moveTable = useStore((s) => s.moveTable);
  const mergeTables = useStore((s) => s.mergeTables);
  const toast = useStore((s) => s.toast);
  const [areaId, setAreaId] = useState<string>('all');
  const [mode, setMode] = useState<'move' | 'merge'>();
  const [source, setSource] = useState<Table>();
  const [, tick] = useState(0);

  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);

  const orderMap = useMemo(() => Object.fromEntries(orders.filter((o) => o.status === 'open' || o.status === 'billed').map((o) => [o.id, o])), [orders]);
  const shownAreas = areaId === 'all' ? areas : areas.filter((a) => a.id === areaId);
  const counts = tables.reduce((acc, t) => ({ ...acc, [t.status]: (acc[t.status] || 0) + 1 }), {} as Record<string, number>);
  const occupied = tables.filter((t) => t.orderId);
  const runningTotal = occupied.reduce((a, t) => a + (orderMap[t.orderId!]?.total || 0), 0);

  const cancelMode = () => { setMode(undefined); setSource(undefined); };

  const onTable = (t: Table) => {
    if (mode) {
      if (!source) {
        if (!t.orderId) return toast('Pick an occupied table first', 'error');
        return setSource(t);
      }
      if (t.id === source.id) return cancelMode();
      if (mode === 'move') {
        if (t.orderId) return toast('Destination must be a blank table', 'error');
        moveTable(source.id, t.id);
      } else {
        if (!t.orderId) return toast('Pick another occupied table to merge into', 'error');
        mergeTables(t.id, source.id);
      }
      return cancelMode();
    }
    navigate(t.orderId ? `/billing?order=${t.orderId}` : `/billing?table=${t.id}`);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Pills options={[{ id: 'all', label: 'All areas' }, ...areas.map((a) => ({ id: a.id, label: a.name }))]} value={areaId} onChange={setAreaId} />
        <div className="flex flex-wrap gap-3 text-xs">
          {(Object.keys(STATUS) as TableStatus[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5 text-slate-600"><span className={clsx('h-2 w-2 rounded-full', STATUS[k].dot)} />{STATUS[k].label} <span className="text-slate-400">{counts[k] || 0}</span></span>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant={mode === 'move' ? 'primary' : 'outline'} size="sm" onClick={() => (mode === 'move' ? cancelMode() : (setMode('move'), setSource(undefined)))}><ArrowRightLeft size={14} strokeWidth={1.6} /> Move table</Button>
          <Button variant={mode === 'merge' ? 'primary' : 'outline'} size="sm" onClick={() => (mode === 'merge' ? cancelMode() : (setMode('merge'), setSource(undefined)))}><Combine size={14} strokeWidth={1.6} /> Merge tables</Button>
        </div>
      </div>

      {mode && (
        <div className="glass mb-4 flex items-center justify-between rounded-2xl px-4 py-3 text-sm text-slate-700">
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand-600" />
            {mode === 'move' ? 'Move' : 'Merge'}: {!source ? 'select the occupied table to ' + (mode === 'move' ? 'move from' : 'merge') : `${source.name} → select ${mode === 'move' ? 'a blank destination table' : 'the table to merge into'}`}
          </span>
          <button onClick={cancelMode} className="text-slate-400 hover:text-slate-800"><X size={16} /></button>
        </div>
      )}

      <div className="mb-6 grid max-w-md grid-cols-2 gap-3">
        <div className="glass rounded-3xl p-4"><div className="text-xs text-slate-500">Occupied</div><div className="mt-1 text-[26px] font-light tracking-tight text-slate-900">{occupied.length}<span className="text-base text-slate-400"> / {tables.length}</span></div></div>
        <div className="glass rounded-3xl p-4"><div className="text-xs text-slate-500">Running value</div><div className="mt-1 text-[26px] font-light tracking-tight text-slate-900">{inr(runningTotal)}</div></div>
      </div>

      <div className="space-y-8">
        {shownAreas.map((a) => (
          <div key={a.id}>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-[17px] font-normal text-slate-900">{a.name}</h3>
              {a.serviceCharge > 0 && <Badge>SC {a.serviceCharge}%</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {tables.filter((t) => t.areaId === a.id).map((t) => {
                const o = t.orderId ? orderMap[t.orderId] : undefined;
                const mins = o ? Math.floor((Date.now() - o.createdAt) / 60000) : 0;
                const res = t.status === 'reserved' ? reservations.find((r) => r.tableId === t.id && r.status === 'booked') : undefined;
                return (
                  <button
                    key={t.id} onClick={() => onTable(t)}
                    className={clsx('relative flex aspect-square flex-col items-center justify-center rounded-3xl p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,.8)] transition',
                      STATUS[t.status].card, source?.id === t.id && 'shadow-[inset_0_0_0_2px_#1a9157]')}
                  >
                    <span className={clsx('absolute right-3 top-3 h-2 w-2 rounded-full', STATUS[t.status].dot)} title={STATUS[t.status].label} />
                    <span className="text-[26px] font-light tracking-tight text-slate-900">{t.name}</span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-500"><Users size={11} strokeWidth={1.6} /> {o?.pax ? `${o.pax}/` : ''}{t.seats}</span>
                    {o && (
                      <>
                        <span className="mt-1.5 text-sm text-slate-900">{inr(o.total)}</span>
                        <span className={clsx('flex items-center gap-0.5 text-[11px]', mins > 60 ? 'text-red-600' : 'text-slate-500')}><Clock size={10} strokeWidth={1.6} /> {mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`}</span>
                      </>
                    )}
                    {res && <span className="mt-1 max-w-full truncate text-[10px] text-slate-500">{res.customerName}</span>}
                    {t.mergedWith?.length ? <span className="absolute left-3 top-2.5 text-[10px] text-slate-500">+{t.mergedWith.join(',')}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const toLocal = (t: number) => new Date(t - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const resColor: Record<Reservation['status'], BadgeColor> = { booked: 'purple', seated: 'green', cancelled: 'red', 'no-show': 'gray' };

function Reservations() {
  const navigate = useNavigate();
  const reservations = useStore((s) => s.reservations);
  const tables = useStore((s) => s.tables);
  const upsert = useStore((s) => s.upsertReservation);
  const toast = useStore((s) => s.toast);
  const [filter, setFilter] = useState<'upcoming' | 'all'>('upcoming');
  const [edit, setEdit] = useState<Reservation>();

  const rows = reservations
    .filter((r) => filter === 'all' || r.status === 'booked')
    .sort((a, b) => a.at - b.at);

  const setStatus = (r: Reservation, status: Reservation['status']) => {
    upsert({ ...r, status });
    toast(`Reservation marked ${status}`, 'info');
    if (status === 'seated' && r.tableId) navigate(`/billing?table=${r.tableId}`);
  };

  return (
    <Card
      title={<Pills options={[{ id: 'upcoming', label: 'Upcoming' }, { id: 'all', label: 'All' }]} value={filter} onChange={setFilter} />}
      actions={<Button size="sm" onClick={() => setEdit({ id: uid('rs'), customerName: '', phone: '', pax: 2, at: Date.now() + 3600000, status: 'booked' })}><CalendarPlus size={14} strokeWidth={1.6} /> New reservation</Button>}
    >
      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        empty="No reservations"
        cols={[
          { key: 'when', header: 'Date & time', render: (r) => <span className="whitespace-nowrap">{fmtDateTime(r.at)}</span> },
          { key: 'name', header: 'Guest', render: (r) => <div><div className="text-slate-900">{r.customerName}</div><div className="text-xs text-slate-400">{r.phone}</div></div> },
          { key: 'pax', header: 'Pax', render: (r) => r.pax },
          { key: 'table', header: 'Table', render: (r) => tables.find((t) => t.id === r.tableId)?.name || <span className="text-slate-400">Unassigned</span> },
          { key: 'note', header: 'Note', render: (r) => <span className="text-xs text-slate-500">{r.note}</span> },
          { key: 'status', header: 'Status', render: (r) => <Badge color={resColor[r.status]}>{r.status}</Badge> },
          {
            key: 'act', header: '', className: 'text-right', render: (r) => (
              <div className="flex justify-end gap-1">
                {r.status === 'booked' && (
                  <>
                    <Button size="sm" variant="success" onClick={() => setStatus(r, 'seated')}>Seat</Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus(r, 'no-show')}>No-show</Button>
                    <Button size="sm" variant="danger" onClick={() => setStatus(r, 'cancelled')}>Cancel</Button>
                  </>
                )}
                <Button size="sm" variant="ghost" onClick={() => setEdit(r)}><Pencil size={14} strokeWidth={1.6} /></Button>
              </div>
            ),
          },
        ]}
      />
      {edit && <ReservationModal value={edit} onClose={() => setEdit(undefined)} onSave={(r) => { upsert(r); toast('Reservation saved'); setEdit(undefined); }} />}
    </Card>
  );
}

function ReservationModal({ value, onClose, onSave }: { value: Reservation; onClose: () => void; onSave: (r: Reservation) => void }) {
  const tables = useStore((s) => s.tables);
  const areas = useStore((s) => s.areas);
  const [r, setR] = useState(value);
  const valid = r.customerName.trim() && /^\d{10}$/.test(r.phone) && r.pax > 0;
  return (
    <Modal open onClose={onClose} title={value.customerName ? 'Edit reservation' : 'New reservation'}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={() => onSave(r)}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Guest name"><Input value={r.customerName} onChange={(e) => setR({ ...r, customerName: e.target.value })} autoFocus /></Field>
        <Field label="Phone (10 digits)"><Input value={r.phone} onChange={(e) => setR({ ...r, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></Field>
        <Field label="Date & time"><Input type="datetime-local" value={toLocal(r.at)} onChange={(e) => setR({ ...r, at: new Date(e.target.value).getTime() || r.at })} /></Field>
        <Field label="Guests"><Input type="number" min={1} value={r.pax} onChange={(e) => setR({ ...r, pax: +e.target.value })} /></Field>
        <Field label="Table" className="sm:col-span-2">
          <Select value={r.tableId || ''} onChange={(e) => setR({ ...r, tableId: e.target.value || undefined })}>
            <option value="">Assign later</option>
            {areas.map((a) => (
              <optgroup key={a.id} label={a.name}>
                {tables.filter((t) => t.areaId === a.id).map((t) => <option key={t.id} value={t.id}>{t.name} · {t.seats} seats{t.seats < r.pax ? ' (too small)' : ''}</option>)}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={r.status} onChange={(e) => setR({ ...r, status: e.target.value as Reservation['status'] })}>
            {(['booked', 'seated', 'cancelled', 'no-show'] as const).map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Special request" className="sm:col-span-2"><Textarea rows={2} value={r.note || ''} onChange={(e) => setR({ ...r, note: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
