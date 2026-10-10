import { CheckCircle2, Pencil, Plus, Printer, ShoppingCart, Sparkles, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, Select, StatCard, Tabs, clsx, type BadgeColor } from '../components/ui';
import { fmtDate, fmtDateTime, inr, uid } from '../lib/billing';
import { useStore } from '../store/useStore';
import type { PurchaseOrder, Vendor } from '../types';

type Tab = 'compare' | 'pos' | 'vendors';

export default function Purchase() {
  const [tab, setTab] = useState<Tab>('compare');
  const open = useStore((s) => s.purchaseOrders.filter((p) => p.status === 'sent').length);
  return (
    <div className="px-4 pb-12 pt-2 sm:px-6">
      <PageHeader title="Purchase Manager" subtitle="Compare vendor prices, build a best-match cart and track purchase orders — stock updates on receipt" />
      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={[
        { id: 'compare', label: 'Price Compare' },
        { id: 'pos', label: 'Purchase Orders', count: open || undefined },
        { id: 'vendors', label: 'Vendors' },
      ]} />
      {tab === 'compare' && <CompareTab onPlaced={() => setTab('pos')} />}
      {tab === 'pos' && <POTab />}
      {tab === 'vendors' && <VendorsTab />}
    </div>
  );
}

/* ---------------- Price compare / best match ---------------- */

type CartLine = { rawMaterialId: string; qty: number; vendorId: string };

function CompareTab({ onPlaced }: { onPlaced: () => void }) {
  const s = useStore();
  const lowIds = s.rawMaterials.filter((r) => r.stock <= r.minStock).map((r) => r.id);
  const [sel, setSel] = useState<Record<string, number>>(() =>
    Object.fromEntries(s.rawMaterials.filter((r) => lowIds.includes(r.id)).map((r) => [r.id, Math.max(1, Math.ceil(r.minStock * 2 - r.stock))])));
  const [cart, setCart] = useState<CartLine[] | null>(null);

  const cheapest = (rmId: string) => {
    let best: { vendorId: string; rate: number } | null = null;
    s.vendors.forEach((v) => { const r = v.rates[rmId]; if (r !== undefined && (!best || r < best.rate)) best = { vendorId: v.id, rate: r }; });
    return best as { vendorId: string; rate: number } | null;
  };

  const buildCart = () => {
    const lines = Object.entries(sel).filter(([, q]) => q > 0).map(([id, qty]) => ({ rawMaterialId: id, qty, vendorId: cheapest(id)?.vendorId || '' }));
    setCart(lines);
  };

  const rate = (l: CartLine) => s.vendors.find((v) => v.id === l.vendorId)?.rates[l.rawMaterialId] ?? 0;
  const byVendor = useMemo(() => {
    const g: Record<string, CartLine[]> = {};
    (cart || []).filter((l) => l.vendorId).forEach((l) => { (g[l.vendorId] ||= []).push(l); });
    return g;
  }, [cart]);
  const cartTotal = (cart || []).reduce((a, l) => a + l.qty * rate(l), 0);
  const savings = (cart || []).reduce((a, l) => {
    const rates = s.vendors.map((v) => v.rates[l.rawMaterialId]).filter((x): x is number => x !== undefined);
    return a + (rates.length ? (Math.max(...rates) - rate(l)) * l.qty : 0);
  }, 0);

  const place = () => {
    Object.entries(byVendor).forEach(([vid, lines]) => s.createPO(vid, lines.map((l) => ({ rawMaterialId: l.rawMaterialId, qty: l.qty, rate: rate(l) }))));
    s.toast(`${Object.keys(byVendor).length} purchase orders placed`);
    setCart(null); setSel({});
    onPlaced();
  };

  return (
    <div className="space-y-4">
      <Card title="Vendor price comparison" actions={<>
        <span className="text-xs text-slate-500">{Object.keys(sel).length} selected</span>
        <Button size="sm" disabled={!Object.values(sel).some((q) => q > 0)} onClick={buildCart}><Sparkles size={14} /> Best Match cart</Button>
      </>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[.06] text-left text-xs text-slate-500">
                <th className="px-3 py-2.5" />
                <th className="px-3 py-2.5">Raw material</th>
                <th className="px-3 py-2.5">Stock</th>
                <th className="px-3 py-2.5">Order qty</th>
                {s.vendors.map((v) => <th key={v.id} className="px-3 py-2.5 whitespace-nowrap">{v.name}{v.type === 'marketplace' && <Badge color="purple" className="ml-1">MP</Badge>}</th>)}
              </tr>
            </thead>
            <tbody>
              {s.rawMaterials.map((r) => {
                const best = cheapest(r.id);
                const on = r.id in sel;
                return (
                  <tr key={r.id} className={clsx('border-b border-slate-100', on && 'bg-brand-50/40')}>
                    <td className="px-3 py-2"><input type="checkbox" checked={on} onChange={(e) => { const n = { ...sel }; if (e.target.checked) n[r.id] = Math.max(1, Math.ceil(r.minStock * 2 - r.stock)); else delete n[r.id]; setSel(n); }} /></td>
                    <td className="px-3 py-2 font-medium">{r.name} {lowIds.includes(r.id) && <Badge color="red">Low</Badge>}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{+r.stock.toFixed(2)} {r.unit}</td>
                    <td className="px-3 py-2">{on ? <Input type="number" className="!w-20 !py-1" value={sel[r.id]} onChange={(e) => setSel({ ...sel, [r.id]: +e.target.value })} /> : '—'}</td>
                    {s.vendors.map((v) => {
                      const rt = v.rates[r.id];
                      return <td key={v.id} className={clsx('px-3 py-2', rt !== undefined && best?.vendorId === v.id && 'bg-brand-500/10 font-semibold text-brand-700')}>{rt !== undefined ? inr(rt) : <span className="text-slate-300">—</span>}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!cart} onClose={() => setCart(null)} size="lg" title="Best Match cart"
        footer={<><Button variant="outline" onClick={() => setCart(null)}>Back</Button><Button disabled={!Object.keys(byVendor).length} onClick={place}><ShoppingCart size={15} /> Place {Object.keys(byVendor).length} order(s) · {inr(cartTotal)}</Button></>}>
        <p className="mb-3 text-sm text-slate-500">Lowest-priced vendor picked for each item. Change the vendor if you prefer. Estimated savings vs. costliest: <b className="text-brand-700">{inr(savings)}</b></p>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500"><th className="py-2">Item</th><th>Qty</th><th>Vendor</th><th>Rate</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {(cart || []).map((l, i) => {
              const rm = s.rawMaterials.find((r) => r.id === l.rawMaterialId)!;
              const options = s.vendors.filter((v) => v.rates[l.rawMaterialId] !== undefined);
              return (
                <tr key={l.rawMaterialId} className="border-t">
                  <td className="py-2">{rm.name}</td>
                  <td><Input type="number" className="!w-20 !py-1" value={l.qty} onChange={(e) => setCart(cart!.map((x, j) => (j === i ? { ...x, qty: +e.target.value } : x)))} /> <span className="text-xs text-slate-400">{rm.unit}</span></td>
                  <td>
                    {options.length ? (
                      <Select className="!py-1" value={l.vendorId} onChange={(e) => setCart(cart!.map((x, j) => (j === i ? { ...x, vendorId: e.target.value } : x)))}>
                        {options.map((v) => <option key={v.id} value={v.id}>{v.name} — {inr(v.rates[l.rawMaterialId])}</option>)}
                      </Select>
                    ) : <span className="text-xs text-red-500">No vendor rate</span>}
                  </td>
                  <td>{inr(rate(l))}</td>
                  <td className="text-right font-medium">{inr(rate(l) * l.qty)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-4 space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
          {Object.entries(byVendor).map(([vid, lines]) => (
            <div key={vid} className="flex justify-between"><span>{s.vendors.find((v) => v.id === vid)?.name} ({lines.length} items)</span><b>{inr(lines.reduce((a, l) => a + l.qty * rate(l), 0))}</b></div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

/* ---------------- Purchase orders ---------------- */

const poColor: Record<PurchaseOrder['status'], BadgeColor> = { draft: 'gray', sent: 'blue', received: 'green', cancelled: 'red' };

function POTab() {
  const s = useStore();
  const [status, setStatus] = useState('');
  const [view, setView] = useState<PurchaseOrder | null>(null);
  const [create, setCreate] = useState(false);
  const rows = s.purchaseOrders.filter((p) => !status || p.status === status);
  const vName = (id: string) => s.vendors.find((v) => v.id === id)?.name || '—';
  const unpaid = s.purchaseOrders.filter((p) => p.status === 'received' && !p.paid).reduce((a, p) => a + p.total, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Open POs" value={s.purchaseOrders.filter((p) => p.status === 'sent').length} tone="blue" />
        <StatCard label="Received this month" value={inr(s.purchaseOrders.filter((p) => p.status === 'received' && (p.receivedAt || 0) > Date.now() - 30 * 86400000).reduce((a, p) => a + p.total, 0))} tone="green" />
        <StatCard label="Vendor payables" value={inr(unpaid)} tone={unpaid ? 'orange' : 'gray'} />
      </div>
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-auto">
            <option value="">All statuses</option>
            {Object.keys(poColor).map((k) => <option key={k} value={k}>{k}</option>)}
          </Select>
          <Button className="ml-auto" onClick={() => setCreate(true)}><Plus size={15} /> New PO</Button>
        </div>
        <DataTable rows={rows} rowKey={(p) => p.id} onRowClick={setView} cols={[
          { key: 'n', header: 'PO #', render: (p) => <b>#{p.poNo}</b> },
          { key: 'd', header: 'Date', render: (p) => fmtDate(p.createdAt) },
          { key: 'v', header: 'Vendor', render: (p) => vName(p.vendorId) },
          { key: 'i', header: 'Items', render: (p) => p.items.length },
          { key: 't', header: 'Total', render: (p) => inr(p.total) },
          { key: 's', header: 'Status', render: (p) => <Badge color={poColor[p.status]}>{p.status}</Badge> },
          { key: 'p', header: 'Payment', render: (p) => p.status === 'received' ? (p.paid ? <Badge color="green">Paid</Badge> : <Badge color="orange">Unpaid</Badge>) : '—' },
          { key: 'inv', header: 'Invoice', render: (p) => <span className="text-xs">{p.invoiceNo || '—'}</span> },
        ]} />
      </Card>
      {view && <PODetail po={s.purchaseOrders.find((p) => p.id === view.id) || view} onClose={() => setView(null)} />}
      {create && <CreatePO onClose={() => setCreate(false)} />}
    </div>
  );
}

function PODetail({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const s = useStore();
  const [inv, setInv] = useState(po.invoiceNo || '');
  const vendor = s.vendors.find((v) => v.id === po.vendorId);
  const outlet = s.outlets.find((o) => o.id === s.outletId);
  const rm = (id: string) => s.rawMaterials.find((r) => r.id === id);

  const print = () => {
    const w = window.open('', '_blank', 'width=720,height=800');
    if (!w) return;
    w.document.write(`<html><head><title>PO #${po.poNo}</title><style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px;text-align:left}</style></head><body>
      <h2>Purchase Order #${po.poNo}</h2><p><b>${outlet?.name}</b><br/>${outlet?.address}<br/>GSTIN: ${outlet?.gstin}</p>
      <p><b>Vendor:</b> ${vendor?.name}<br/>${vendor?.phone}${vendor?.gstin ? '<br/>GSTIN: ' + vendor.gstin : ''}</p><p>Date: ${fmtDateTime(po.createdAt)}</p>
      <table><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>${po.items.map((i) => `<tr><td>${rm(i.rawMaterialId)?.name}</td><td>${i.qty} ${rm(i.rawMaterialId)?.unit}</td><td>₹${i.rate}</td><td>₹${(i.qty * i.rate).toFixed(2)}</td></tr>`).join('')}
      <tr><th colspan="3">Total</th><th>₹${po.total.toFixed(2)}</th></tr></table><script>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <Modal open onClose={onClose} size="lg" title={<span>PO #{po.poNo} · <Badge color={poColor[po.status]}>{po.status}</Badge></span>}
      footer={<>
        <Button variant="outline" onClick={print}><Printer size={15} /> Print</Button>
        {(po.status === 'sent' || po.status === 'draft') && <Button variant="danger" onClick={() => { s.setPOStatus(po.id, 'cancelled'); s.toast('PO cancelled'); onClose(); }}>Cancel PO</Button>}
        {po.status === 'draft' && <Button variant="secondary" onClick={() => { s.setPOStatus(po.id, 'sent'); s.toast('PO sent to vendor'); }}>Send to vendor</Button>}
        {po.status === 'sent' && <Button variant="success" onClick={() => { s.setPOStatus(po.id, 'received', inv || undefined); s.toast('Goods received — inventory updated'); }}><CheckCircle2 size={15} /> Mark received</Button>}
        {po.status === 'received' && !po.paid && <Button onClick={() => { s.markPOPaid(po.id); s.toast('Marked as paid'); }}>Mark paid</Button>}
      </>}>
      <div className="mb-3 grid gap-3 text-sm sm:grid-cols-3">
        <div><div className="text-xs text-slate-500">Vendor</div><b>{vendor?.name}</b><div className="text-xs">{vendor?.phone}</div></div>
        <div><div className="text-xs text-slate-500">Created</div>{fmtDateTime(po.createdAt)}</div>
        <div><div className="text-xs text-slate-500">Received</div>{po.receivedAt ? fmtDateTime(po.receivedAt) : '—'}</div>
      </div>
      <DataTable rows={po.items} rowKey={(i) => i.rawMaterialId} cols={[
        { key: 'n', header: 'Item', render: (i) => rm(i.rawMaterialId)?.name },
        { key: 'q', header: 'Qty', render: (i) => `${i.qty} ${rm(i.rawMaterialId)?.unit}` },
        { key: 'r', header: 'Rate', render: (i) => inr(i.rate) },
        { key: 'a', header: 'Amount', className: 'text-right', render: (i) => inr(i.qty * i.rate) },
      ]} />
      <div className="mt-2 text-right text-lg font-bold">Total {inr(po.total)}</div>
      {po.status === 'sent' && <Field label="Vendor invoice no. (optional)" className="mt-3 max-w-xs"><Input value={inv} onChange={(e) => setInv(e.target.value)} /></Field>}
      {po.invoiceNo && po.status === 'received' && <p className="mt-2 text-sm text-slate-500">Invoice: {po.invoiceNo}</p>}
    </Modal>
  );
}

function CreatePO({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [vendorId, setVendorId] = useState(s.vendors[0]?.id || '');
  const vendor = s.vendors.find((v) => v.id === vendorId);
  const [lines, setLines] = useState<PurchaseOrder['items']>([]);
  const total = lines.reduce((a, l) => a + l.qty * l.rate, 0);
  const addLine = () => {
    const rmId = Object.keys(vendor?.rates || {})[0] || s.rawMaterials[0].id;
    setLines([...lines, { rawMaterialId: rmId, qty: 1, rate: vendor?.rates[rmId] ?? s.rawMaterials.find((r) => r.id === rmId)?.costPerUnit ?? 0 }]);
  };
  const submit = (status: PurchaseOrder['status']) => { s.createPO(vendorId, lines.filter((l) => l.qty > 0), status); s.toast(status === 'draft' ? 'PO saved as draft' : 'PO sent'); onClose(); };
  return (
    <Modal open onClose={onClose} size="lg" title="New purchase order"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="outline" disabled={!lines.length} onClick={() => submit('draft')}>Save draft</Button><Button disabled={!lines.length} onClick={() => submit('sent')}>Send PO · {inr(total)}</Button></>}>
      <Field label="Vendor" className="mb-3 max-w-sm">
        <Select value={vendorId} onChange={(e) => { setVendorId(e.target.value); setLines([]); }}>
          {s.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </Select>
      </Field>
      {lines.map((l, i) => (
        <div key={i} className="mb-2 flex gap-2">
          <Select value={l.rawMaterialId} onChange={(e) => {
            const id = e.target.value;
            setLines(lines.map((x, j) => (j === i ? { ...x, rawMaterialId: id, rate: vendor?.rates[id] ?? s.rawMaterials.find((r) => r.id === id)?.costPerUnit ?? 0 } : x)));
          }}>
            {s.rawMaterials.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.unit}){vendor?.rates[r.id] !== undefined ? ` — ₹${vendor.rates[r.id]}` : ''}</option>)}
          </Select>
          <Input type="number" className="!w-24" placeholder="Qty" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: +e.target.value } : x)))} />
          <Input type="number" className="!w-28" placeholder="Rate" value={l.rate} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, rate: +e.target.value } : x)))} />
          <span className="flex w-24 items-center justify-end text-sm font-medium">{inr(l.qty * l.rate)}</span>
          <Button variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={addLine}><Plus size={13} /> Add item</Button>
    </Modal>
  );
}

/* ---------------- Vendors ---------------- */

function VendorsTab() {
  const s = useStore();
  const [edit, setEdit] = useState<Vendor | null>(null);
  return (
    <Card title="Vendors" actions={<Button size="sm" onClick={() => setEdit({ id: uid('v'), name: '', phone: '', type: 'local', rates: {} })}><Plus size={14} /> Add vendor</Button>}>
      <DataTable rows={s.vendors} rowKey={(v) => v.id} cols={[
        { key: 'n', header: 'Vendor', render: (v) => <div><div className="font-medium">{v.name}</div><div className="text-xs text-slate-400">{v.email}</div></div> },
        { key: 't', header: 'Type', render: (v) => <Badge color={v.type === 'marketplace' ? 'purple' : 'gray'}>{v.type}</Badge> },
        { key: 'p', header: 'Phone', render: (v) => v.phone },
        { key: 'g', header: 'GSTIN', render: (v) => <span className="font-mono text-xs">{v.gstin || '—'}</span> },
        { key: 'r', header: 'Rate card', render: (v) => `${Object.keys(v.rates).length} items` },
        { key: 'o', header: 'POs', render: (v) => s.purchaseOrders.filter((p) => p.vendorId === v.id).length },
        { key: 'x', header: '', className: 'text-right', render: (v) => (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEdit(structuredClone(v))}><Pencil size={14} /></Button>
            <Button size="sm" variant="ghost" onClick={() => {
              if (s.purchaseOrders.some((p) => p.vendorId === v.id && p.status === 'sent')) return s.toast('Vendor has open POs', 'error');
              s.deleteVendor(v.id); s.toast('Vendor deleted');
            }}><Trash2 size={14} className="text-red-500" /></Button>
          </div>
        ) },
      ]} />
      {edit && <VendorModal vendor={edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}

function VendorModal({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  const s = useStore();
  const [v, setV] = useState(vendor);
  const fileRef = useRef<HTMLInputElement>(null);
  const [addId, setAddId] = useState('');

  const importRates = async (f: File) => {
    const lines = (await f.text()).split(/\r?\n/).filter((l) => l.trim());
    const rates = { ...v.rates };
    let n = 0, miss = 0;
    lines.forEach((l) => {
      const [name, rate] = l.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const rm = s.rawMaterials.find((r) => r.name.toLowerCase() === name?.toLowerCase());
      if (rm && !isNaN(+rate)) { rates[rm.id] = +rate; n++; } else if (name && name.toLowerCase() !== 'rawmaterialname' && name.toLowerCase() !== 'name') miss++;
    });
    setV({ ...v, rates });
    s.toast(`${n} rates imported${miss ? `, ${miss} unmatched` : ''}`, miss ? 'info' : 'success');
  };

  return (
    <Modal open onClose={onClose} size="lg" title={s.vendors.some((x) => x.id === vendor.id) ? `Edit · ${vendor.name}` : 'Add vendor'}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!v.name.trim()} onClick={() => { s.upsertVendor(v); s.toast('Vendor saved'); onClose(); }}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vendor name"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="Type">
          <Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value as Vendor['type'] })}>
            <option value="local">Local supplier</option>
            <option value="marketplace">Marketplace</option>
          </Select>
        </Field>
        <Field label="Phone"><Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
        <Field label="Email"><Input value={v.email || ''} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        <Field label="GSTIN" className="sm:col-span-2"><Input value={v.gstin || ''} onChange={(e) => setV({ ...v, gstin: e.target.value.toUpperCase() })} /></Field>
      </div>
      <div className="mb-2 mt-5 flex items-center justify-between">
        <h4 className="text-sm font-semibold">Rate card</h4>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importRates(f); e.target.value = ''; }} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} title="CSV: rawMaterialName,rate"><Upload size={13} /> Upload CSV</Button>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto rounded-2xl bg-white/45">
        {Object.entries(v.rates).map(([id, rate]) => {
          const rm = s.rawMaterials.find((r) => r.id === id);
          return (
            <div key={id} className="flex items-center gap-2 border-b px-3 py-1.5 last:border-0">
              <span className="flex-1 text-sm">{rm?.name || id} <span className="text-xs text-slate-400">/{rm?.unit}</span></span>
              <Input type="number" className="!w-28 !py-1" value={rate} onChange={(e) => setV({ ...v, rates: { ...v.rates, [id]: +e.target.value } })} />
              <Button size="sm" variant="ghost" onClick={() => { const r = { ...v.rates }; delete r[id]; setV({ ...v, rates: r }); }}><Trash2 size={13} /></Button>
            </div>
          );
        })}
        {!Object.keys(v.rates).length && <p className="p-3 text-center text-xs text-slate-400">No rates yet</p>}
      </div>
      <div className="mt-2 flex gap-2">
        <Select value={addId} onChange={(e) => setAddId(e.target.value)}>
          <option value="">Add raw material…</option>
          {s.rawMaterials.filter((r) => !(r.id in v.rates)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        <Button variant="outline" disabled={!addId} onClick={() => { setV({ ...v, rates: { ...v.rates, [addId]: s.rawMaterials.find((r) => r.id === addId)?.costPerUnit || 0 } }); setAddId(''); }}>Add</Button>
      </div>
    </Modal>
  );
}
