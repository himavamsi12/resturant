import { AlertTriangle, ArrowRightLeft, Download, Package, Pencil, Plus, ShoppingCart, SlidersHorizontal, Trash2, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, DataTable, Empty, Field, Input, Modal, PageHeader, Select, StatCard, Tabs, VegMark, clsx, type BadgeColor } from '../components/ui';
import { downloadCSV, fmtDateTime, inr, startOfDay, uid } from '../lib/billing';
import { useStore } from '../store/useStore';
import type { RawMaterial, StockLog, StockTransfer } from '../types';

type Tab = 'stock' | 'recipes' | 'logs' | 'ck' | 'dayend';

export default function Inventory() {
  const [tab, setTab] = useState<Tab>('stock');
  const low = useStore((s) => s.rawMaterials.filter((r) => r.stock <= r.minStock).length);
  const pendingTr = useStore((s) => s.transfers.filter((t) => t.status === 'requested' || t.status === 'dispatched').length);
  return (
    <div className="px-4 pb-12 pt-2 sm:px-6">
      <PageHeader title="Inventory" subtitle="Raw materials, recipes with auto-deduction, central kitchen & day-end stock" />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[
        { id: 'stock', label: 'Stock', count: low || undefined },
        { id: 'recipes', label: 'Recipes' },
        { id: 'logs', label: 'Stock Movements' },
        { id: 'ck', label: 'Central Kitchen', count: pendingTr || undefined },
        { id: 'dayend', label: 'Day-end Report' },
      ]} />
      {tab === 'stock' && <StockTab />}
      {tab === 'recipes' && <RecipesTab />}
      {tab === 'logs' && <LogsTab />}
      {tab === 'ck' && <CentralKitchenTab />}
      {tab === 'dayend' && <DayEndTab />}
    </div>
  );
}

const fmtQty = (n: number, unit: string) => `${+n.toFixed(3)} ${unit}`;

/* ---------------- Stock ---------------- */

function StockTab() {
  const s = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [edit, setEdit] = useState<RawMaterial | null>(null);
  const [adjust, setAdjust] = useState<RawMaterial | null>(null);

  const cats = [...new Set(s.rawMaterials.map((r) => r.category))];
  const low = s.rawMaterials.filter((r) => r.stock <= r.minStock);
  const value = s.rawMaterials.reduce((a, r) => a + Math.max(0, r.stock) * r.costPerUnit, 0);
  const rows = s.rawMaterials
    .filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()))
    .filter((r) => !cat || r.category === cat)
    .filter((r) => !onlyLow || r.stock <= r.minStock);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Raw materials" value={s.rawMaterials.length} icon={<Package size={16} />} tone="blue" />
        <StatCard label="Low stock" value={low.length} sub="At or below minimum level" icon={<AlertTriangle size={16} />} tone={low.length ? 'red' : 'green'} />
        <StatCard label="Stock value" value={inr(value)} sub="At last purchase cost" icon={<Wallet size={16} />} tone="green" />
      </div>
      {low.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 glass rounded-2xl px-4 py-3 text-sm text-slate-800">
          <AlertTriangle size={18} />
          <span className="flex-1"><b>Low stock alert:</b> {low.map((r) => r.name).join(', ')}</span>
          <Button size="sm" onClick={() => nav('/purchase')}><ShoppingCart size={14} /> Raise PO</Button>
        </div>
      )}
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search raw material" className="max-w-xs" />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="!w-auto">
            <option value="">All categories</option>
            {cats.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Low stock only</label>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => downloadCSV('stock', [['Material', 'Category', 'Stock', 'Unit', 'Min', 'Cost/unit', 'Value'], ...s.rawMaterials.map((r) => [r.name, r.category, r.stock, r.unit, r.minStock, r.costPerUnit, Math.round(r.stock * r.costPerUnit)])])}><Download size={15} /> Export</Button>
            <Button onClick={() => setEdit({ id: uid('r'), name: '', unit: 'kg', stock: 0, minStock: 0, costPerUnit: 0, category: cats[0] || 'Grocery' })}><Plus size={15} /> Add material</Button>
          </div>
        </div>
        <DataTable rows={rows} rowKey={(r) => r.id} cols={[
          { key: 'n', header: 'Material', render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-slate-400">{r.category}</div></div> },
          { key: 'st', header: 'Stock level', render: (r) => {
            const pct = Math.min(100, (r.stock / Math.max(r.minStock * 3, 0.001)) * 100);
            const lowish = r.stock <= r.minStock;
            return (
              <div className="w-48">
                <div className="flex justify-between text-xs"><b className={lowish ? 'text-red-600' : ''}>{fmtQty(r.stock, r.unit)}</b><span className="text-slate-400">min {r.minStock}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className={clsx('h-1.5 rounded-full', lowish ? 'bg-red-500' : pct < 60 ? 'bg-slate-500' : 'bg-brand-600')} style={{ width: `${Math.max(pct, 2)}%` }} /></div>
              </div>
            );
          } },
          { key: 's', header: 'Status', render: (r) => r.stock <= 0 ? <Badge color="red">Out of stock</Badge> : r.stock <= r.minStock ? <Badge color="orange">Low</Badge> : <Badge color="green">OK</Badge> },
          { key: 'c', header: 'Cost / unit', render: (r) => `${inr(r.costPerUnit)}/${r.unit}` },
          { key: 'v', header: 'Value', render: (r) => inr(Math.max(0, r.stock) * r.costPerUnit) },
          { key: 'x', header: '', className: 'text-right', render: (r) => (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="outline" onClick={() => setAdjust(r)}><SlidersHorizontal size={13} /> Adjust</Button>
              <Button size="sm" variant="ghost" onClick={() => setEdit(r)}><Pencil size={14} /></Button>
              <Button size="sm" variant="ghost" onClick={() => {
                if (s.recipes.some((rc) => rc.ingredients.some((i) => i.rawMaterialId === r.id))) return s.toast('Used in recipes — remove it there first', 'error');
                s.deleteRawMaterial(r.id); s.toast('Material deleted');
              }}><Trash2 size={14} className="text-red-500" /></Button>
            </div>
          ) },
        ]} />
      </Card>
      {edit && <MaterialModal rm={edit} onClose={() => setEdit(null)} />}
      {adjust && <AdjustModal rm={adjust} onClose={() => setAdjust(null)} />}
    </div>
  );
}

function MaterialModal({ rm, onClose }: { rm: RawMaterial; onClose: () => void }) {
  const s = useStore();
  const [r, setR] = useState(rm);
  const isNew = !s.rawMaterials.some((x) => x.id === rm.id);
  return (
    <Modal open onClose={onClose} title={isNew ? 'Add raw material' : `Edit · ${rm.name}`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!r.name.trim()} onClick={() => { s.upsertRawMaterial(r); s.toast('Saved'); onClose(); }}>Save</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" className="col-span-2"><Input value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field>
        <Field label="Category"><Input value={r.category} list="rm-cats" onChange={(e) => setR({ ...r, category: e.target.value })} />
          <datalist id="rm-cats">{[...new Set(s.rawMaterials.map((x) => x.category))].map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Unit">
          <Select value={r.unit} onChange={(e) => setR({ ...r, unit: e.target.value as RawMaterial['unit'] })}>
            {['kg', 'g', 'ltr', 'ml', 'pcs'].map((u) => <option key={u}>{u}</option>)}
          </Select>
        </Field>
        {isNew && <Field label="Opening stock"><Input type="number" value={r.stock} onChange={(e) => setR({ ...r, stock: +e.target.value })} /></Field>}
        <Field label="Minimum stock (alert level)"><Input type="number" value={r.minStock} onChange={(e) => setR({ ...r, minStock: +e.target.value })} /></Field>
        <Field label="Cost per unit (₹)"><Input type="number" value={r.costPerUnit} onChange={(e) => setR({ ...r, costPerUnit: +e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function AdjustModal({ rm, onClose }: { rm: RawMaterial; onClose: () => void }) {
  const s = useStore();
  const [dir, setDir] = useState<'add' | 'remove'>('remove');
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState<StockLog['reason']>('wastage');
  const [note, setNote] = useState('');
  const change = dir === 'add' ? qty : -qty;
  return (
    <Modal open onClose={onClose} title={`Adjust stock · ${rm.name}`} size="sm"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={qty <= 0} onClick={() => { s.adjustStock(rm.id, change, reason, note); s.toast(`Stock ${dir === 'add' ? 'added' : 'reduced'}`); onClose(); }}>Save</Button></>}>
      <div className="space-y-3">
        <div className="flex gap-2">
          {(['add', 'remove'] as const).map((d) => (
            <Button key={d} className="flex-1" variant={dir === d ? 'secondary' : 'outline'} onClick={() => { setDir(d); setReason(d === 'add' ? 'adjustment' : 'wastage'); }}>{d === 'add' ? '+ Add' : '− Remove'}</Button>
          ))}
        </div>
        <Field label={`Quantity (${rm.unit})`}><Input type="number" autoFocus value={qty || ''} onChange={(e) => setQty(+e.target.value)} /></Field>
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value as StockLog['reason'])}>
            <option value="wastage">Wastage / spoilage</option>
            <option value="adjustment">Physical count adjustment</option>
            <option value="return">Return to vendor</option>
          </Select>
        </Field>
        <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
        <p className="text-sm text-slate-500">Current: <b>{fmtQty(rm.stock, rm.unit)}</b> → New: <b>{fmtQty(rm.stock + change, rm.unit)}</b></p>
      </div>
    </Modal>
  );
}

/* ---------------- Recipes ---------------- */

function RecipesTab() {
  const s = useStore();
  const [itemId, setItemId] = useState(s.menuItems[0]?.id || '');
  const item = s.menuItems.find((m) => m.id === itemId);
  const saved = s.recipes.find((r) => r.itemId === itemId);
  const [ings, setIngs] = useState(saved?.ingredients || []);
  const [loadedFor, setLoadedFor] = useState(itemId);
  if (loadedFor !== itemId) { setLoadedFor(itemId); setIngs(saved?.ingredients || []); }

  const rmBy = (id: string) => s.rawMaterials.find((r) => r.id === id);
  const cost = ings.reduce((a, i) => a + i.qty * (rmBy(i.rawMaterialId)?.costPerUnit || 0), 0);
  const pct = item?.price ? (cost / item.price) * 100 : 0;
  const missing = s.menuItems.filter((m) => !s.recipes.some((r) => r.itemId === m.id && r.ingredients.length));
  const costOf = (id: string) => (s.recipes.find((r) => r.itemId === id)?.ingredients || []).reduce((a, i) => a + i.qty * (rmBy(i.rawMaterialId)?.costPerUnit || 0), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Menu items" className="lg:col-span-1">
        <div className="max-h-[560px] divide-y overflow-y-auto">
          {s.menuItems.map((m) => {
            const has = s.recipes.some((r) => r.itemId === m.id && r.ingredients.length);
            const c = costOf(m.id);
            return (
              <button key={m.id} onClick={() => setItemId(m.id)} className={clsx('flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-slate-50', m.id === itemId && 'bg-brand-500/10')}>
                <VegMark veg={m.veg} />
                <span className="flex-1">{m.name}</span>
                {has ? <span className="text-xs text-slate-500">{((c / m.price) * 100).toFixed(0)}%</span> : <Badge color="yellow">No recipe</Badge>}
              </button>
            );
          })}
        </div>
      </Card>
      <div className="space-y-4 lg:col-span-2">
        {item && (
          <Card title={<span>{item.image} Recipe · {item.name}</span>} actions={<Button size="sm" onClick={() => { s.upsertRecipe({ itemId, ingredients: ings.filter((i) => i.rawMaterialId && i.qty > 0) }); s.toast('Recipe saved — stock will auto-deduct on every sale'); }}>Save recipe</Button>}>
            <div className="p-4">
              <div className="mb-3 grid gap-3 sm:grid-cols-3">
                <StatCard label="Food cost / portion" value={inr(cost, 2)} />
                <StatCard label="Selling price" value={inr(item.price)} />
                <StatCard label="Food cost %" value={`${pct.toFixed(1)}%`} tone={pct > 35 ? 'red' : 'green'} sub={pct > 35 ? 'Above 35% target' : 'Within target'} />
              </div>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500"><th className="py-2">Raw material</th><th>Qty / portion</th><th>Cost</th><th /></tr></thead>
                <tbody>
                  {ings.map((ing, i) => {
                    const rm = rmBy(ing.rawMaterialId);
                    return (
                      <tr key={i} className="border-t">
                        <td className="py-2 pr-2">
                          <Select value={ing.rawMaterialId} onChange={(e) => setIngs(ings.map((x, j) => (j === i ? { ...x, rawMaterialId: e.target.value } : x)))}>
                            {s.rawMaterials.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.unit})</option>)}
                          </Select>
                        </td>
                        <td className="pr-2"><div className="flex items-center gap-1"><Input type="number" step="0.001" className="!w-28" value={ing.qty} onChange={(e) => setIngs(ings.map((x, j) => (j === i ? { ...x, qty: +e.target.value } : x)))} /><span className="text-xs text-slate-400">{rm?.unit}</span></div></td>
                        <td>{inr(ing.qty * (rm?.costPerUnit || 0), 2)}</td>
                        <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setIngs(ings.filter((_, j) => j !== i))}><Trash2 size={14} /></Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {ings.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No ingredients yet.</p>}
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setIngs([...ings, { rawMaterialId: s.rawMaterials[0].id, qty: 0.1 }])}><Plus size={13} /> Add ingredient</Button>
            </div>
          </Card>
        )}
        <Card title={`Items without recipe (${missing.length})`}>
          <div className="flex flex-wrap gap-2 p-4">
            {missing.length === 0 ? <span className="text-sm text-slate-500">All items have recipes 🎉</span> : missing.map((m) => (
              <button key={m.id} onClick={() => setItemId(m.id)} className="rounded-full bg-white/60 px-3 py-1 text-xs text-slate-800 hover:bg-white/90">{m.name}</button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Logs ---------------- */

const reasonColor: Record<StockLog['reason'], BadgeColor> = { sale: 'blue', purchase: 'green', wastage: 'red', adjustment: 'gray', 'transfer-in': 'purple', 'transfer-out': 'orange', return: 'yellow' };

function LogsTab() {
  const s = useStore();
  const [reason, setReason] = useState('');
  const [rm, setRm] = useState('');
  const rows = s.stockLogs.filter((l) => (!reason || l.reason === reason) && (!rm || l.rawMaterialId === rm)).slice(0, 500);
  const rmBy = (id: string) => s.rawMaterials.find((r) => r.id === id);
  return (
    <Card>
      <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
        <Select value={reason} onChange={(e) => setReason(e.target.value)} className="!w-auto">
          <option value="">All reasons</option>
          {Object.keys(reasonColor).map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        <Select value={rm} onChange={(e) => setRm(e.target.value)} className="!w-auto">
          <option value="">All materials</option>
          {s.rawMaterials.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        <Button variant="outline" className="ml-auto" onClick={() => downloadCSV('stock-movements', [['Time', 'Material', 'Change', 'Unit', 'Reason', 'Note'], ...rows.map((l) => [fmtDateTime(l.at), rmBy(l.rawMaterialId)?.name || '', l.change, rmBy(l.rawMaterialId)?.unit || '', l.reason, l.note || ''])])}><Download size={15} /> Export</Button>
      </div>
      <DataTable rows={rows} rowKey={(l) => l.id} empty="No stock movements yet — settle a bill, receive a PO or adjust stock." cols={[
        { key: 't', header: 'Time', render: (l) => <span className="text-xs">{fmtDateTime(l.at)}</span> },
        { key: 'm', header: 'Material', render: (l) => rmBy(l.rawMaterialId)?.name || '—' },
        { key: 'c', header: 'Change', render: (l) => <b className={l.change >= 0 ? 'text-brand-700' : 'text-red-600'}>{l.change >= 0 ? '+' : ''}{+l.change.toFixed(3)} {rmBy(l.rawMaterialId)?.unit}</b> },
        { key: 'r', header: 'Reason', render: (l) => <Badge color={reasonColor[l.reason]}>{l.reason}</Badge> },
        { key: 'n', header: 'Note', render: (l) => <span className="text-xs text-slate-500">{l.note}</span> },
      ]} />
    </Card>
  );
}

/* ---------------- Central kitchen ---------------- */

const trColor: Record<StockTransfer['status'], BadgeColor> = { requested: 'yellow', dispatched: 'blue', received: 'green', rejected: 'red' };

function CentralKitchenTab() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<{ rawMaterialId: string; qty: number }[]>([]);
  const outletName = (id: string) => s.outlets.find((o) => o.id === id)?.name || id;
  const rmBy = (id: string) => s.rawMaterials.find((r) => r.id === id);
  const ck = s.outlets.find((o) => o.isCentralKitchen);
  const here = s.outletId;

  const startRequest = () => {
    const low = s.rawMaterials.filter((r) => r.stock <= r.minStock);
    setLines(low.length ? low.map((r) => ({ rawMaterialId: r.id, qty: Math.ceil(r.minStock * 2 - r.stock) })) : [{ rawMaterialId: s.rawMaterials[0].id, qty: 1 }]);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 glass rounded-3xl p-4">
        <ArrowRightLeft className="text-brand-600" />
        <div className="flex-1 text-sm">
          <div className="font-semibold">{ck?.name}</div>
          <div className="text-slate-500">Supplies all outlets. Request stock from the central kitchen, or dispatch/receive transfers. Current outlet: <b>{outletName(here)}</b></div>
        </div>
        <Button onClick={startRequest} disabled={here === ck?.id}><Plus size={15} /> Request stock</Button>
      </div>
      <Card title="Stock transfers">
        {s.transfers.length === 0 ? <Empty title="No transfers yet" /> : (
          <DataTable rows={s.transfers} rowKey={(t) => t.id} cols={[
            { key: 'd', header: 'Created', render: (t) => <span className="text-xs">{fmtDateTime(t.createdAt)}</span> },
            { key: 'f', header: 'From → To', render: (t) => <span className="text-sm">{outletName(t.fromOutletId)} → <b>{outletName(t.toOutletId)}</b></span> },
            { key: 'i', header: 'Items', render: (t) => <span className="text-xs">{t.items.map((i) => `${rmBy(i.rawMaterialId)?.name} × ${i.qty}${rmBy(i.rawMaterialId)?.unit}`).join(', ')}</span> },
            { key: 's', header: 'Status', render: (t) => <Badge color={trColor[t.status]}>{t.status}</Badge> },
            { key: 'a', header: '', className: 'text-right', render: (t) => (
              <div className="flex justify-end gap-1">
                {t.status === 'requested' && <>
                  <Button size="sm" variant="outline" onClick={() => { s.setTransferStatus(t.id, 'dispatched'); s.toast('Marked dispatched'); }}>Dispatch</Button>
                  <Button size="sm" variant="danger" onClick={() => s.setTransferStatus(t.id, 'rejected')}>Reject</Button>
                </>}
                {t.status === 'dispatched' && <Button size="sm" variant="success" onClick={() => { s.setTransferStatus(t.id, 'received'); s.toast(t.toOutletId === here ? 'Received — stock updated' : 'Marked received'); }}>Receive</Button>}
              </div>
            ) },
          ]} />
        )}
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title="Request stock from central kitchen"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!lines.some((l) => l.qty > 0)} onClick={() => {
          s.createTransfer({ fromOutletId: ck?.id || 'ck', toOutletId: here, items: lines.filter((l) => l.qty > 0) });
          s.toast('Stock request sent to central kitchen'); setOpen(false);
        }}>Send request</Button></>}>
        {lines.map((l, i) => (
          <div key={i} className="mb-2 flex gap-2">
            <Select value={l.rawMaterialId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, rawMaterialId: e.target.value } : x)))}>
              {s.rawMaterials.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.unit}) — in stock {+r.stock.toFixed(2)}</option>)}
            </Select>
            <Input type="number" className="!w-28" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: +e.target.value } : x)))} />
            <Button variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setLines([...lines, { rawMaterialId: s.rawMaterials[0].id, qty: 1 }])}><Plus size={13} /> Add item</Button>
      </Modal>
    </div>
  );
}

/* ---------------- Day-end ---------------- */

function DayEndTab() {
  const s = useStore();
  const today = startOfDay();
  const rows = useMemo(() => s.rawMaterials.map((r) => {
    const logs = s.stockLogs.filter((l) => l.rawMaterialId === r.id && l.at >= today);
    const sum = (k: StockLog['reason'][]) => logs.filter((l) => k.includes(l.reason)).reduce((a, l) => a + l.change, 0);
    const consumption = -sum(['sale']);
    const purchases = sum(['purchase', 'transfer-in']);
    const wastage = -sum(['wastage']);
    const other = sum(['adjustment', 'return', 'transfer-out']);
    const opening = r.stock + consumption - purchases + wastage - other;
    return { r, opening, consumption, purchases, wastage, other, closing: r.stock, costConsumed: consumption * r.costPerUnit, costWasted: wastage * r.costPerUnit };
  }), [s.rawMaterials, s.stockLogs, today]);

  const tot = rows.reduce((a, x) => ({ c: a.c + x.costConsumed, w: a.w + x.costWasted }), { c: 0, w: 0 });
  const n = (v: number) => +v.toFixed(3);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Consumption cost today" value={inr(tot.c)} tone="blue" />
        <StatCard label="Wastage cost today" value={inr(tot.w)} tone="red" />
        <StatCard label="Items consumed" value={rows.filter((x) => x.consumption > 0).length} />
      </div>
      <Card title={`Day-end inventory · ${new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' })}`} actions={
        <Button size="sm" variant="outline" onClick={() => downloadCSV(`day-end-inventory-${new Date().toISOString().slice(0, 10)}`, [
          ['Material', 'Unit', 'Opening', 'Purchased/In', 'Consumed', 'Wastage', 'Other adj.', 'Closing', 'Consumption cost'],
          ...rows.map((x) => [x.r.name, x.r.unit, n(x.opening), n(x.purchases), n(x.consumption), n(x.wastage), n(x.other), n(x.closing), Math.round(x.costConsumed)]),
        ])}><Download size={14} /> Export CSV</Button>
      }>
        <DataTable rows={rows} rowKey={(x) => x.r.id} cols={[
          { key: 'm', header: 'Material', render: (x) => x.r.name },
          { key: 'o', header: 'Opening', render: (x) => fmtQty(x.opening, x.r.unit) },
          { key: 'p', header: 'Purchased / In', render: (x) => x.purchases ? <span className="text-brand-700">+{n(x.purchases)}</span> : '—' },
          { key: 'c', header: 'Consumed', render: (x) => x.consumption ? <span className="text-slate-600">−{n(x.consumption)}</span> : '—' },
          { key: 'w', header: 'Wastage', render: (x) => x.wastage ? <span className="text-red-600">−{n(x.wastage)}</span> : '—' },
          { key: 'a', header: 'Other', render: (x) => x.other ? n(x.other) : '—' },
          { key: 'cl', header: 'Closing', render: (x) => <b className={x.closing <= x.r.minStock ? 'text-red-600' : ''}>{fmtQty(x.closing, x.r.unit)}</b> },
          { key: 'cc', header: 'Consumption cost', render: (x) => inr(x.costConsumed) },
        ]} />
      </Card>
    </div>
  );
}
