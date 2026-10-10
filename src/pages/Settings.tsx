import { Download, Plus, Printer, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { taxes } from '../data/seed';
import { inr, uid } from '../lib/billing';
import { useOutlet, useStore } from '../store/useStore';
import type { Area, Outlet, Settings as SettingsT, Station, Table } from '../types';
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, Toggle } from '../components/ui';

type Tab = 'bill' | 'taxes' | 'areas' | 'stations' | 'online' | 'data';

export default function Settings() {
  const [tab, setTab] = useState<Tab>('bill');
  return (
    <div className="px-4 pb-12 pt-2 sm:px-6">
      <PageHeader title="Settings" subtitle="Configure outlet, billing, taxes, floor plan, printers and online ordering" />
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[
        { id: 'bill', label: 'Outlet & Bill' },
        { id: 'taxes', label: 'Taxes' },
        { id: 'areas', label: 'Areas & Tables' },
        { id: 'stations', label: 'Kitchen Stations & Printers' },
        { id: 'online', label: 'Online Ordering' },
        { id: 'data', label: 'Data & Backup' },
      ]} />
      {tab === 'bill' && <OutletBill />}
      {tab === 'taxes' && <Taxes />}
      {tab === 'areas' && <AreasTables />}
      {tab === 'stations' && <Stations />}
      {tab === 'online' && <OnlineSettings />}
      {tab === 'data' && <DataBackup />}
    </div>
  );
}

function Section({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Card title={title}>
      <div className="p-4">{children}</div>
      {footer && <div className="flex justify-end px-4 py-3">{footer}</div>}
    </Card>
  );
}

function OutletBill() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const outlet = useOutlet();
  const toast = useStore((s) => s.toast);
  const [st, setSt] = useState<SettingsT>(settings);
  const [o, setO] = useState<Outlet>(outlet);

  const save = () => {
    update(st);
    useStore.setState((s) => ({ outlets: s.outlets.map((x) => (x.id === o.id ? o : x)) }));
    toast('Settings saved');
  };

  const sample = [{ n: 'Paneer Tikka', q: 1, p: 280 }, { n: 'Butter Naan', q: 2, p: 60 }, { n: 'Masala Chai', q: 2, p: 60 }];
  const sub = sample.reduce((a, x) => a + x.q * x.p, 0);
  const tax = sub * 0.05;
  const raw = sub + tax;
  const total = st.roundOff ? Math.round(raw) : raw;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <Section title="Outlet details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Restaurant brand name"><Input value={st.restaurantName} onChange={(e) => setSt({ ...st, restaurantName: e.target.value })} /></Field>
            <Field label="Outlet name"><Input value={o.name} onChange={(e) => setO({ ...o, name: e.target.value })} /></Field>
            <Field label="Address" className="sm:col-span-2"><Input value={o.address} onChange={(e) => setO({ ...o, address: e.target.value })} /></Field>
            <Field label="Phone"><Input value={o.phone} onChange={(e) => setO({ ...o, phone: e.target.value })} /></Field>
            <Field label="GSTIN"><Input value={o.gstin} onChange={(e) => setO({ ...o, gstin: e.target.value.toUpperCase() })} /></Field>
            <Field label="FSSAI Lic. No."><Input value={o.fssai} onChange={(e) => setO({ ...o, fssai: e.target.value })} /></Field>
          </div>
        </Section>
        <Section title="Bill format" footer={<Button onClick={save}>Save changes</Button>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bill footer message" className="sm:col-span-2"><Textarea rows={2} value={st.billFooter} onChange={(e) => setSt({ ...st, billFooter: e.target.value })} /></Field>
            <Field label="UPI ID for payment QR"><Input value={st.upiId} onChange={(e) => setSt({ ...st, upiId: e.target.value })} /></Field>
            <Field label="KOT print copies"><Input type="number" min={1} max={5} value={st.kotPrintCopies} onChange={(e) => setSt({ ...st, kotPrintCopies: +e.target.value })} /></Field>
            <Toggle checked={st.showLogo} onChange={(v) => setSt({ ...st, showLogo: v })} label="Print logo on bill" />
            <Toggle checked={st.printQrOnBill} onChange={(v) => setSt({ ...st, printQrOnBill: v })} label="Print dynamic UPI QR on bill" />
            <Toggle checked={st.roundOff} onChange={(v) => setSt({ ...st, roundOff: v })} label="Round off bill total" />
          </div>
        </Section>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold text-slate-500">Live bill preview</div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 font-mono text-[11px] leading-relaxed text-slate-800 shadow-sm">
          {st.showLogo && <div className="text-center text-2xl">🍽️</div>}
          <div className="text-center text-sm font-bold">{st.restaurantName}</div>
          <div className="text-center">{o.name}</div>
          <div className="text-center">{o.address}</div>
          <div className="text-center">Ph: {o.phone}</div>
          <div className="text-center">GSTIN: {o.gstin}</div>
          <div className="my-1 border-t border-dashed border-slate-400" />
          <div className="flex justify-between"><span>Bill #1234</span><span>Table A4</span></div>
          <div className="my-1 border-t border-dashed border-slate-400" />
          {sample.map((x) => (
            <div key={x.n} className="flex justify-between"><span>{x.n} x{x.q}</span><span>{(x.q * x.p).toFixed(2)}</span></div>
          ))}
          <div className="my-1 border-t border-dashed border-slate-400" />
          <div className="flex justify-between"><span>Sub Total</span><span>{sub.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>CGST 2.5%</span><span>{(tax / 2).toFixed(2)}</span></div>
          <div className="flex justify-between"><span>SGST 2.5%</span><span>{(tax / 2).toFixed(2)}</span></div>
          {st.roundOff && <div className="flex justify-between"><span>Round off</span><span>{(total - raw).toFixed(2)}</span></div>}
          <div className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{inr(total, st.roundOff ? 0 : 2)}</span></div>
          {st.printQrOnBill && (
            <div className="mt-2 flex flex-col items-center">
              <div className="grid h-20 w-20 grid-cols-7 gap-px bg-white p-1">
                {Array.from({ length: 49 }, (_, i) => <span key={i} className={(i * 7 + (i % 5)) % 3 === 0 || [0, 1, 7, 8, 5, 6, 12, 13, 35, 36, 42, 43].includes(i) ? 'bg-slate-900' : 'bg-white'} />)}
              </div>
              <div>Scan to pay · {st.upiId}</div>
            </div>
          )}
          <div className="mt-2 text-center">{st.billFooter}</div>
          <div className="text-center">FSSAI: {o.fssai}</div>
        </div>
      </div>
    </div>
  );
}

function Taxes() {
  const items = useStore((s) => s.menuItems);
  return (
    <Card title="Tax slabs (GST)">
      <DataTable rows={taxes} rowKey={(t) => t.id} cols={[
        { key: 'name', header: 'Tax', render: (t) => <span className="font-medium">{t.name}</span> },
        { key: 'rate', header: 'Total rate', render: (t) => `${t.rate}%` },
        { key: 'split', header: 'Split', render: (t) => (t.rate ? `CGST ${t.rate / 2}% + SGST ${t.rate / 2}%` : '—') },
        { key: 'items', header: 'Menu items', className: 'text-right', render: (t) => items.filter((m) => m.taxGroup === t.id).length },
      ]} />
      <div className="border-t p-4 text-sm text-slate-700">
        Restaurants (non-hotel) are charged GST at 5% without input tax credit. Packaged goods like mineral water attract 18%. Tax is applied per item based on its tax group — change an item’s tax group under <b>Menu</b>. Inter-state supplies use IGST at the full rate.
      </div>
    </Card>
  );
}

function AreasTables() {
  const areas = useStore((s) => s.areas);
  const tables = useStore((s) => s.tables);
  const upsertArea = useStore((s) => s.upsertArea);
  const deleteArea = useStore((s) => s.deleteArea);
  const upsertTable = useStore((s) => s.upsertTable);
  const deleteTable = useStore((s) => s.deleteTable);
  const toast = useStore((s) => s.toast);
  const [area, setArea] = useState<Area | null>(null);
  const [table, setTable] = useState<Table | null>(null);

  const saveArea = () => {
    if (!area?.name.trim()) return toast('Area name required', 'error');
    upsertArea({ ...area, name: area.name.trim() });
    toast('Area saved');
    setArea(null);
  };
  const saveTable = () => {
    if (!table?.name.trim()) return toast('Table name required', 'error');
    if (tables.some((t) => t.name.toLowerCase() === table.name.trim().toLowerCase() && t.id !== table.id)) return toast('Table name already exists', 'error');
    upsertTable({ ...table, name: table.name.trim() });
    toast('Table saved');
    setTable(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end"><Button onClick={() => setArea({ id: uid('ar'), name: '', serviceCharge: 0 })}><Plus size={16} /> Add Area</Button></div>
      {areas.map((a) => {
        const ts = tables.filter((t) => t.areaId === a.id);
        return (
          <Card key={a.id} title={<span>{a.name} <Badge color="blue">Service charge {a.serviceCharge}%</Badge> <Badge>{ts.length} tables · {ts.reduce((x, t) => x + t.seats, 0)} seats</Badge></span>}
            actions={<>
              <Button size="sm" variant="outline" onClick={() => setTable({ id: uid('t'), name: '', areaId: a.id, seats: 4, status: 'blank' })}><Plus size={13} /> Table</Button>
              <Button size="sm" variant="ghost" onClick={() => setArea(a)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => {
                if (ts.some((t) => t.orderId)) return toast('Area has running tables', 'error');
                if (confirm(`Delete ${a.name} and its ${ts.length} tables?`)) { deleteArea(a.id); toast('Area deleted'); }
              }}><Trash2 size={14} /></Button>
            </>}>
            <div className="flex flex-wrap gap-2 p-4">
              {ts.length === 0 && <span className="text-sm text-slate-400">No tables yet</span>}
              {ts.map((t) => (
                <button key={t.id} onClick={() => setTable(t)} className="flex h-16 w-20 flex-col items-center justify-center rounded-2xl bg-white/55 hover:bg-white/85">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-[11px] text-slate-500">{t.seats} seats</span>
                </button>
              ))}
            </div>
          </Card>
        );
      })}

      <Modal open={!!area} onClose={() => setArea(null)} size="sm" title="Dine-in Area" footer={<><Button variant="outline" onClick={() => setArea(null)}>Cancel</Button><Button onClick={saveArea}>Save</Button></>}>
        {area && <div className="space-y-3">
          <Field label="Area name"><Input autoFocus value={area.name} onChange={(e) => setArea({ ...area, name: e.target.value })} placeholder="e.g. Private Dining" /></Field>
          <Field label="Service charge %"><Input type="number" min={0} max={20} value={area.serviceCharge} onChange={(e) => setArea({ ...area, serviceCharge: +e.target.value })} /></Field>
        </div>}
      </Modal>
      <Modal open={!!table} onClose={() => setTable(null)} size="sm" title="Table" footer={<>
        {table && tables.some((t) => t.id === table.id) && <Button variant="danger" className="mr-auto" onClick={() => {
          if (table.orderId) return toast('Table has a running order', 'error');
          deleteTable(table.id); toast('Table deleted'); setTable(null);
        }}>Delete</Button>}
        <Button variant="outline" onClick={() => setTable(null)}>Cancel</Button><Button onClick={saveTable}>Save</Button></>}>
        {table && <div className="space-y-3">
          <Field label="Table name / number"><Input autoFocus value={table.name} onChange={(e) => setTable({ ...table, name: e.target.value })} /></Field>
          <Field label="Seats"><Input type="number" min={1} value={table.seats} onChange={(e) => setTable({ ...table, seats: +e.target.value })} /></Field>
          <Field label="Area">
            <Select value={table.areaId} onChange={(e) => setTable({ ...table, areaId: e.target.value })}>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        </div>}
      </Modal>
    </div>
  );
}

function Stations() {
  const stations = useStore((s) => s.stations);
  const items = useStore((s) => s.menuItems);
  const upsert = useStore((s) => s.upsertStation);
  const toast = useStore((s) => s.toast);
  const [edit, setEdit] = useState<Station | null>(null);

  return (
    <Card title="Kitchen stations & KOT printers" actions={<Button size="sm" onClick={() => setEdit({ id: uid('st'), name: '', printer: '' })}><Plus size={14} /> Add Station</Button>}>
      <DataTable rows={stations} rowKey={(s) => s.id} cols={[
        { key: 'name', header: 'Station', render: (s) => <span className="font-medium">{s.name}</span> },
        { key: 'printer', header: 'Printer', render: (s) => s.printer || <span className="text-slate-400">Not assigned</span> },
        { key: 'items', header: 'Items routed', className: 'text-right', render: (s) => items.filter((m) => m.station === s.id).length },
        { key: 'act', header: '', className: 'text-right', render: (s) => (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="outline" onClick={() => toast(`Test KOT sent to ${s.printer || s.name}`, 'info')}><Printer size={13} /> Test print</Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(s)}>Edit</Button>
          </div>
        ) },
      ]} />
      <Modal open={!!edit} onClose={() => setEdit(null)} size="sm" title="Kitchen Station" footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
        <Button onClick={() => { if (!edit?.name.trim()) return toast('Name required', 'error'); upsert(edit); toast('Station saved'); setEdit(null); }}>Save</Button></>}>
        {edit && <div className="space-y-3">
          <Field label="Station name"><Input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Printer" hint="Model and IP address of the network thermal printer"><Input value={edit.printer} onChange={(e) => setEdit({ ...edit, printer: e.target.value })} placeholder="EPSON TM-T82 (192.168.1.30)" /></Field>
        </div>}
      </Modal>
    </Card>
  );
}

function OnlineSettings() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const toast = useStore((s) => s.toast);
  const [st, setSt] = useState(settings);
  return (
    <div className="max-w-2xl">
      <Section title="Online ordering" footer={<Button onClick={() => { update(st); toast('Online settings saved'); }}>Save changes</Button>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Packaging charge (₹)"><Input type="number" min={0} value={st.packagingCharge} onChange={(e) => setSt({ ...st, packagingCharge: +e.target.value })} /></Field>
          <Field label="Delivery charge (₹)"><Input type="number" min={0} value={st.deliveryCharge} onChange={(e) => setSt({ ...st, deliveryCharge: +e.target.value })} /></Field>
          <Field label="Default preparation time (min)"><Input type="number" min={5} value={st.defaultPrepTime} onChange={(e) => setSt({ ...st, defaultPrepTime: +e.target.value })} /></Field>
          <div />
          <Field label="Opens at"><Input type="time" value={st.businessHours.open} onChange={(e) => setSt({ ...st, businessHours: { ...st.businessHours, open: e.target.value } })} /></Field>
          <Field label="Closes at"><Input type="time" value={st.businessHours.close} onChange={(e) => setSt({ ...st, businessHours: { ...st.businessHours, close: e.target.value } })} /></Field>
          <div className="sm:col-span-2"><Toggle checked={st.autoAcceptOnline} onChange={(v) => setSt({ ...st, autoAcceptOnline: v })} label="Auto-accept incoming online orders (KOT prints automatically)" /></div>
          <div className="space-y-2 sm:col-span-2">
            <div className="text-xs font-medium text-slate-600">Store status per platform</div>
            {(['swiggy', 'zomato', 'website'] as const).map((p) => (
              <Toggle key={p} checked={st.storeOnline[p]} onChange={(v) => setSt({ ...st, storeOnline: { ...st.storeOnline, [p]: v } })} label={<span className="capitalize">{p} — {st.storeOnline[p] ? 'Online' : 'Offline'}</span>} />
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}

function DataBackup() {
  const reset = useStore((s) => s.resetDemo);
  const toast = useStore((s) => s.toast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const dataOnly = () => Object.fromEntries(Object.entries(useStore.getState()).filter(([k, v]) => typeof v !== 'function' && k !== 'toasts' && k !== 'currentStaffId'));

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(dataOnly(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dineflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup downloaded');
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.menuItems) || !Array.isArray(parsed.orders)) throw new Error('bad');
      const allowed = Object.keys(dataOnly());
      const patch = Object.fromEntries(Object.entries(parsed).filter(([k]) => allowed.includes(k)));
      useStore.setState(patch);
      toast(`Backup restored (${Object.keys(patch).length} sections)`);
    } catch {
      toast('Invalid backup file', 'error');
    }
  };

  const s = useStore.getState();
  return (
    <div className="grid max-w-4xl gap-5 md:grid-cols-2">
      <Section title="Backup & restore">
        <p className="mb-3 text-sm text-slate-600">All data is stored locally in this browser. Download a JSON backup or restore one.</p>
        <ul className="mb-4 grid grid-cols-2 gap-1 text-xs text-slate-500">
          <li>{s.orders.length} orders</li><li>{s.menuItems.length} menu items</li>
          <li>{s.customers.length} customers</li><li>{s.rawMaterials.length} raw materials</li>
        </ul>
        <div className="flex gap-2">
          <Button onClick={exportJson}><Download size={16} /> Export backup</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload size={16} /> Import backup</Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
        </div>
      </Section>
      <Section title="Reset demo data">
        <p className="mb-4 text-sm text-slate-600">Restore the original sample menu, 30 days of order history, customers and inventory. All your changes will be lost.</p>
        <Button variant="danger" onClick={() => setConfirmReset(true)}><RotateCcw size={16} /> Reset demo data</Button>
      </Section>
      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} size="sm" title="Reset all data?"
        footer={<><Button variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button><Button onClick={() => { reset(); setConfirmReset(false); toast('Demo data reset'); }}>Yes, reset</Button></>}>
        <p className="text-sm text-slate-600">This permanently replaces all orders, menu, inventory, customers and settings with fresh demo data.</p>
      </Modal>
    </div>
  );
}
