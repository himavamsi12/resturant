import { ArrowDown, ArrowUp, Download, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, Select, Tabs, Textarea, Toggle, VegMark } from '../components/ui';
import { downloadCSV, inr, uid } from '../lib/billing';
import { useStore } from '../store/useStore';
import type { AddonGroup, Category, MenuItem } from '../types';

type Tab = 'items' | 'categories' | 'addons' | 'pricing';

export default function Menu() {
  const [tab, setTab] = useState<Tab>('items');
  const items = useStore((s) => s.menuItems);
  const cats = useStore((s) => s.categories);
  const groups = useStore((s) => s.addonGroups);
  return (
    <div className="px-4 pb-12 pt-2 sm:px-6">
      <PageHeader title="Menu Management" subtitle="Items, variations, add-ons, area & online pricing" />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'items', label: 'Items', count: items.length },
          { id: 'categories', label: 'Categories', count: cats.length },
          { id: 'addons', label: 'Add-on Groups', count: groups.length },
          { id: 'pricing', label: 'Pricing' },
        ]}
      />
      {tab === 'items' && <ItemsTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'addons' && <AddonsTab />}
      {tab === 'pricing' && <PricingTab />}
    </div>
  );
}

/* ---------------- Items ---------------- */

function ItemsTab() {
  const s = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [veg, setVeg] = useState<'' | 'veg' | 'nonveg'>('');
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => s.menuItems
    .filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase()) || m.shortCode.toLowerCase().includes(q.toLowerCase()))
    .filter((m) => !cat || m.categoryId === cat)
    .filter((m) => !veg || (veg === 'veg' ? m.veg : !m.veg)), [s.menuItems, q, cat, veg]);

  const catName = (id: string) => s.categories.find((c) => c.id === id)?.name || '—';
  const stationName = (id: string) => s.stations.find((c) => c.id === id)?.name || '—';

  const newItem = (): MenuItem => ({
    id: uid('m'), name: '', shortCode: '', categoryId: s.categories[0]?.id || '', price: 0, veg: true, variations: [], addonGroupIds: [],
    taxGroup: 'GST5', station: s.stations[0]?.id || '', available: true, onlineAvailable: { swiggy: true, zomato: true, website: true }, areaPrices: {}, image: '🍽️', description: '',
  });

  const exportCsv = () => downloadCSV('menu', [
    ['name', 'shortcode', 'category', 'price', 'veg', 'online_price', 'tax', 'station', 'available'],
    ...s.menuItems.map((m) => [m.name, m.shortCode, catName(m.categoryId), m.price, m.veg ? 'yes' : 'no', m.onlinePrice ?? '', m.taxGroup, stationName(m.station), m.available ? 'yes' : 'no']),
  ]);

  const importCsv = async (f: File) => {
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const parse = (l: string) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const head = parse(lines[0]).map((h) => h.toLowerCase());
    const start = head.includes('name') ? 1 : 0;
    const idx = (k: string, d: number) => (start ? head.indexOf(k) : d);
    let added = 0, updated = 0;
    const cats = [...useStore.getState().categories];
    for (const l of lines.slice(start)) {
      const c = parse(l);
      const name = c[idx('name', 0)];
      if (!name) continue;
      const code = c[idx('shortcode', 1)] || name.slice(0, 3).toUpperCase();
      const catLabel = c[idx('category', 2)] || 'Uncategorised';
      const price = Number(c[idx('price', 3)]) || 0;
      const isVeg = !/^(no|n|false|0|non-?veg)$/i.test(c[idx('veg', 4)] || 'yes');
      let category = cats.find((x) => x.name.toLowerCase() === catLabel.toLowerCase());
      if (!category) {
        category = { id: uid('c'), name: catLabel, sortOrder: cats.length + 1, active: true };
        cats.push(category);
        s.upsertCategory(category);
      }
      const existing = useStore.getState().menuItems.find((m) => m.shortCode.toLowerCase() === code.toLowerCase());
      if (existing) { s.upsertItem({ ...existing, name, price, veg: isVeg, categoryId: category.id }); updated++; }
      else { s.upsertItem({ ...newItem(), id: uid('m'), name, shortCode: code, price, veg: isVeg, categoryId: category.id, onlinePrice: Math.round(price * 1.1) }); added++; }
    }
    s.toast(`Imported: ${added} added, ${updated} updated`);
  };

  const del = s.menuItems.find((m) => m.id === delId);

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / shortcode" className="max-w-xs" />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="!w-auto">
          <option value="">All categories</option>
          {s.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={veg} onChange={(e) => setVeg(e.target.value as typeof veg)} className="!w-auto">
          <option value="">Veg + Non-veg</option>
          <option value="veg">Veg only</option>
          <option value="nonveg">Non-veg only</option>
        </Select>
        <div className="ml-auto flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ''; }} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload size={15} /> Import CSV</Button>
          <Button variant="outline" onClick={exportCsv}><Download size={15} /> Export</Button>
          <Button onClick={() => setEditing(newItem())}><Plus size={15} /> Add Item</Button>
        </div>
      </div>
      <DataTable
        rows={rows}
        rowKey={(m) => m.id}
        cols={[
          { key: 'name', header: 'Item', render: (m) => (
            <div className="flex items-center gap-2">
              <span className="text-xl">{m.image}</span>
              <VegMark veg={m.veg} />
              <div>
                <div className="font-medium text-slate-800">{m.name}</div>
                <div className="text-xs text-slate-400">{m.variations.length ? `${m.variations.length} variations` : ''}{m.addonGroupIds.length ? ` · ${m.addonGroupIds.length} add-on groups` : ''}</div>
              </div>
            </div>
          ) },
          { key: 'code', header: 'Code', render: (m) => <span className="font-mono text-xs">{m.shortCode}</span> },
          { key: 'cat', header: 'Category', render: (m) => catName(m.categoryId) },
          { key: 'price', header: 'Price', render: (m) => <div>{inr(m.price)}<div className="text-xs text-slate-400">Online {inr(m.onlinePrice ?? m.price)}</div></div> },
          { key: 'station', header: 'Station', render: (m) => <span className="text-xs">{stationName(m.station)}</span> },
          { key: 'tax', header: 'Tax', render: (m) => <Badge>{m.taxGroup}</Badge> },
          { key: 'avail', header: 'In stock', render: (m) => <Toggle size="sm" checked={m.available} onChange={() => s.toggleItemAvailable(m.id)} /> },
          { key: 'online', header: 'Online (Swiggy / Zomato / Web)', render: (m) => (
            <div className="flex gap-3">
              {(['swiggy', 'zomato', 'website'] as const).map((p) => (
                <span key={p} title={p}><Toggle size="sm" checked={m.onlineAvailable[p]} onChange={() => s.toggleItemOnline(m.id, p)} /></span>
              ))}
            </div>
          ) },
          { key: 'act', header: '', className: 'text-right', render: (m) => (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing(m)}><Pencil size={14} /></Button>
              <Button size="sm" variant="ghost" onClick={() => setDelId(m.id)}><Trash2 size={14} className="text-red-500" /></Button>
            </div>
          ) },
        ]}
      />
      {editing && <ItemModal item={editing} onClose={() => setEditing(null)} />}
      <Modal open={!!del} onClose={() => setDelId(null)} title="Delete item" size="sm"
        footer={<><Button variant="outline" onClick={() => setDelId(null)}>Cancel</Button><Button variant="danger" onClick={() => { s.deleteItem(delId!); s.toast('Item deleted'); setDelId(null); }}>Delete</Button></>}>
        Delete <b>{del?.name}</b> from the menu? This removes it from POS and all online platforms.
      </Modal>
    </Card>
  );
}

function ItemModal({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const s = useStore();
  const [m, setM] = useState<MenuItem>(structuredClone(item));
  const isNew = !s.menuItems.some((x) => x.id === item.id);
  const set = <K extends keyof MenuItem>(k: K, v: MenuItem[K]) => setM((p) => ({ ...p, [k]: v }));
  const codeClash = !!m.shortCode && s.menuItems.some((x) => x.id !== m.id && x.shortCode.toLowerCase() === m.shortCode.toLowerCase());
  const valid = m.name.trim() && m.shortCode.trim() && !codeClash && m.price > 0 && m.categoryId;

  const save = () => {
    s.upsertItem({ ...m, variations: m.variations.filter((v) => v.name.trim()) });
    s.toast(isNew ? 'Item added' : 'Item updated');
    onClose();
  };

  return (
    <Modal open onClose={onClose} size="lg" title={isNew ? 'Add menu item' : `Edit · ${item.name}`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={save}>Save item</Button></>}>
      <div className="grid gap-3 sm:grid-cols-6">
        <Field label="Emoji" className="sm:col-span-1"><Input value={m.image || ''} onChange={(e) => set('image', e.target.value)} /></Field>
        <Field label="Item name *" className="sm:col-span-3"><Input value={m.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Short code *" className="sm:col-span-2">
          <Input value={m.shortCode} onChange={(e) => set('shortCode', e.target.value.toUpperCase())} className={codeClash ? '!border-red-500/50' : ''} />
          {codeClash && <span className="text-xs text-red-600">Shortcode already used</span>}
        </Field>
        <Field label="Category *" className="sm:col-span-2">
          <Select value={m.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            {s.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Base price (₹) *" className="sm:col-span-2"><Input type="number" value={m.price || ''} onChange={(e) => set('price', +e.target.value)} /></Field>
        <Field label="Online price (₹)" className="sm:col-span-2"><Input type="number" value={m.onlinePrice ?? ''} onChange={(e) => set('onlinePrice', e.target.value ? +e.target.value : undefined)} /></Field>
        <Field label="Tax group" className="sm:col-span-2">
          <Select value={m.taxGroup} onChange={(e) => set('taxGroup', e.target.value as MenuItem['taxGroup'])}>
            {['GST5', 'GST12', 'GST18', 'NONE'].map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Kitchen station (KOT printer)" className="sm:col-span-2">
          <Select value={m.station} onChange={(e) => set('station', e.target.value)}>
            {s.stations.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
          </Select>
        </Field>
        <Field label="Type" className="sm:col-span-2">
          <div className="flex h-[38px] items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm"><input type="radio" checked={m.veg} onChange={() => set('veg', true)} /> <VegMark veg /> Veg</label>
            <label className="flex items-center gap-1.5 text-sm"><input type="radio" checked={!m.veg} onChange={() => set('veg', false)} /> <VegMark veg={false} /> Non-veg</label>
          </div>
        </Field>
        <Field label="Description" className="sm:col-span-6"><Textarea rows={2} value={m.description || ''} onChange={(e) => set('description', e.target.value)} /></Field>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold">Variations</h4>
          <Button size="sm" variant="outline" onClick={() => set('variations', [...m.variations, { id: uid('v'), name: '', price: m.price }])}><Plus size={13} /> Add variation</Button>
        </div>
        {m.variations.length === 0 && <p className="text-xs text-slate-400">No variations — item sells at base price.</p>}
        {m.variations.map((v, i) => (
          <div key={v.id} className="mb-2 flex gap-2">
            <Input placeholder="e.g. Half / Full / Large" value={v.name} onChange={(e) => set('variations', m.variations.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <Input type="number" className="!w-32" value={v.price} onChange={(e) => set('variations', m.variations.map((x, j) => (j === i ? { ...x, price: +e.target.value } : x)))} />
            <Button variant="ghost" onClick={() => set('variations', m.variations.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <h4 className="mb-2 text-sm font-semibold">Add-on groups</h4>
        <div className="flex flex-wrap gap-2">
          {s.addonGroups.map((g) => {
            const on = m.addonGroupIds.includes(g.id);
            return (
              <button key={g.id} onClick={() => set('addonGroupIds', on ? m.addonGroupIds.filter((x) => x !== g.id) : [...m.addonGroupIds, g.id])}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${on ? 'border-brand-500 bg-brand-500/10 text-brand-700' : 'border-slate-300 text-slate-600'}`}>
                {on ? '✓ ' : ''}{g.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <h4 className="mb-2 text-sm font-semibold">Area-wise price overrides</h4>
        <div className="grid gap-2 sm:grid-cols-3">
          {s.areas.map((a) => (
            <Field key={a.id} label={a.name}>
              <Input type="number" placeholder={`Default ${m.price}`} value={m.areaPrices[a.id] ?? ''}
                onChange={(e) => {
                  const ap = { ...m.areaPrices };
                  if (e.target.value) ap[a.id] = +e.target.value; else delete ap[a.id];
                  set('areaPrices', ap);
                }} />
            </Field>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-5">
        <Toggle checked={m.available} onChange={(v) => set('available', v)} label="Available in POS" />
        {(['swiggy', 'zomato', 'website'] as const).map((p) => (
          <Toggle key={p} checked={m.onlineAvailable[p]} onChange={(v) => set('onlineAvailable', { ...m.onlineAvailable, [p]: v })} label={<span className="capitalize">{p}</span>} />
        ))}
      </div>
    </Modal>
  );
}

/* ---------------- Categories ---------------- */

function CategoriesTab() {
  const s = useStore();
  const [edit, setEdit] = useState<Category | null>(null);
  const sorted = [...s.categories].sort((a, b) => a.sortOrder - b.sortOrder);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const a = sorted[i], b = sorted[j];
    s.upsertCategory({ ...a, sortOrder: b.sortOrder });
    s.upsertCategory({ ...b, sortOrder: a.sortOrder });
  };
  const remove = (c: Category) => {
    const n = s.menuItems.filter((m) => m.categoryId === c.id).length;
    if (n) return s.toast(`Move or delete ${n} items first`, 'error');
    s.deleteCategory(c.id);
    s.toast('Category deleted');
  };

  return (
    <Card title="Categories" actions={<Button size="sm" onClick={() => setEdit({ id: uid('c'), name: '', sortOrder: (sorted.at(-1)?.sortOrder || 0) + 1, active: true })}><Plus size={14} /> Add category</Button>}>
      <DataTable
        rows={sorted}
        rowKey={(c) => c.id}
        cols={[
          { key: 'ord', header: 'Order', render: (c) => {
            const i = sorted.indexOf(c);
            return (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></Button>
                <Button size="sm" variant="ghost" disabled={i === sorted.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></Button>
              </div>
            );
          } },
          { key: 'name', header: 'Name', render: (c) => <span className="font-medium">{c.name}</span> },
          { key: 'n', header: 'Items', render: (c) => s.menuItems.filter((m) => m.categoryId === c.id).length },
          { key: 'act', header: 'Active', render: (c) => <Toggle size="sm" checked={c.active} onChange={(v) => s.upsertCategory({ ...c, active: v })} /> },
          { key: 'x', header: '', className: 'text-right', render: (c) => (
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEdit(c)}><Pencil size={14} /></Button>
              <Button size="sm" variant="ghost" onClick={() => remove(c)}><Trash2 size={14} className="text-red-500" /></Button>
            </div>
          ) },
        ]}
      />
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={s.categories.some((c) => c.id === edit.id) ? 'Edit category' : 'New category'} size="sm"
          footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={!edit.name.trim()} onClick={() => { s.upsertCategory(edit); s.toast('Category saved'); setEdit(null); }}>Save</Button></>}>
          <Field label="Category name"><Input autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <div className="mt-3"><Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Active" /></div>
        </Modal>
      )}
    </Card>
  );
}

/* ---------------- Add-on groups ---------------- */

function AddonsTab() {
  const s = useStore();
  const [edit, setEdit] = useState<AddonGroup | null>(null);
  const usedBy = (id: string) => s.menuItems.filter((m) => m.addonGroupIds.includes(id)).length;
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setEdit({ id: uid('ag'), name: '', min: 0, max: 1, items: [] })}><Plus size={15} /> New add-on group</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {s.addonGroups.map((g) => (
          <Card key={g.id} title={g.name} actions={<>
            <Button size="sm" variant="ghost" onClick={() => setEdit(structuredClone(g))}><Pencil size={14} /></Button>
            <Button size="sm" variant="ghost" onClick={() => {
              s.deleteAddonGroup(g.id);
              s.menuItems.filter((m) => m.addonGroupIds.includes(g.id)).forEach((m) => s.upsertItem({ ...m, addonGroupIds: m.addonGroupIds.filter((x) => x !== g.id) }));
              s.toast('Add-on group deleted');
            }}><Trash2 size={14} className="text-red-500" /></Button>
          </>}>
            <div className="p-4">
              <div className="mb-2 flex gap-2 text-xs text-slate-500"><Badge color="blue">Min {g.min}</Badge><Badge color="blue">Max {g.max}</Badge><Badge>Used by {usedBy(g.id)} items</Badge></div>
              <ul className="divide-y text-sm">
                {g.items.map((a) => <li key={a.id} className="flex justify-between py-1.5"><span>{a.name}</span><span className="text-slate-500">+{inr(a.price)}</span></li>)}
              </ul>
            </div>
          </Card>
        ))}
      </div>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title="Add-on group"
          footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={!edit.name.trim() || edit.max < edit.min} onClick={() => { s.upsertAddonGroup({ ...edit, items: edit.items.filter((i) => i.name.trim()) }); s.toast('Add-on group saved'); setEdit(null); }}>Save</Button></>}>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Group name" className="col-span-2"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Min select"><Input type="number" min={0} value={edit.min} onChange={(e) => setEdit({ ...edit, min: +e.target.value })} /></Field>
            <Field label="Max select"><Input type="number" min={1} value={edit.max} onChange={(e) => setEdit({ ...edit, max: +e.target.value })} /></Field>
          </div>
          <div className="mt-4 mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Add-on items</h4>
            <Button size="sm" variant="outline" onClick={() => setEdit({ ...edit, items: [...edit.items, { id: uid('a'), name: '', price: 0 }] })}><Plus size={13} /> Add</Button>
          </div>
          {edit.items.map((a, i) => (
            <div key={a.id} className="mb-2 flex gap-2">
              <Input placeholder="Name" value={a.name} onChange={(e) => setEdit({ ...edit, items: edit.items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <Input type="number" className="!w-28" value={a.price} onChange={(e) => setEdit({ ...edit, items: edit.items.map((x, j) => (j === i ? { ...x, price: +e.target.value } : x)) })} />
              <Button variant="ghost" onClick={() => setEdit({ ...edit, items: edit.items.filter((_, j) => j !== i) })}><Trash2 size={14} /></Button>
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}

/* ---------------- Pricing ---------------- */

function PricingTab() {
  const s = useStore();
  const [pct, setPct] = useState(5);
  const [cat, setCat] = useState('');
  const [preview, setPreview] = useState(false);
  const affected = s.menuItems.filter((m) => !cat || m.categoryId === cat);
  const adj = (p: number) => Math.round(p * (1 + pct / 100));

  return (
    <div className="space-y-4">
      <Card title="Bulk price update">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <Field label="Change (%) — negative to reduce"><Input type="number" value={pct} onChange={(e) => { setPct(+e.target.value); setPreview(false); }} className="!w-36" /></Field>
          <Field label="Apply to">
            <Select value={cat} onChange={(e) => { setCat(e.target.value); setPreview(false); }} className="!w-56">
              <option value="">Entire menu</option>
              {s.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Button variant="outline" onClick={() => setPreview(true)} disabled={!pct}>Preview {affected.length} items</Button>
          {preview && <Button onClick={() => { s.bulkPriceUpdate(pct, cat || undefined); s.toast(`Updated ${affected.length} items by ${pct}%`); setPreview(false); }}>Apply update</Button>}
        </div>
        {preview && (
          <div className="max-h-96 overflow-y-auto border-t">
            <DataTable rows={affected} rowKey={(m) => m.id} cols={[
              { key: 'n', header: 'Item', render: (m) => m.name },
              { key: 'o', header: 'Current', render: (m) => inr(m.price) },
              { key: 'p', header: 'New', render: (m) => <b className={pct > 0 ? 'text-brand-700' : 'text-red-600'}>{inr(adj(m.price))}</b> },
              { key: 'on', header: 'Online', render: (m) => m.onlinePrice ? `${inr(m.onlinePrice)} → ${inr(adj(m.onlinePrice))}` : '—' },
              { key: 'v', header: 'Variations', render: (m) => m.variations.map((v) => `${v.name}: ${v.price}→${adj(v.price)}`).join(', ') || '—' },
            ]} />
          </div>
        )}
      </Card>

      <Card title="Area-wise & channel price matrix">
        <DataTable rows={s.menuItems} rowKey={(m) => m.id} cols={[
          { key: 'n', header: 'Item', render: (m) => <span className="flex items-center gap-1.5"><VegMark veg={m.veg} />{m.name}</span> },
          { key: 'b', header: 'Base', render: (m) => inr(m.price) },
          ...s.areas.map((a) => ({
            key: a.id, header: a.name,
            render: (m: MenuItem) => (
              <Input type="number" className="!w-24 !py-1" value={m.areaPrices[a.id] ?? m.price}
                onChange={(e) => s.upsertItem({ ...m, areaPrices: { ...m.areaPrices, [a.id]: +e.target.value } })} />
            ),
          })),
          { key: 'on', header: 'Online', render: (m) => (
            <Input type="number" className="!w-24 !py-1" value={m.onlinePrice ?? m.price} onChange={(e) => s.upsertItem({ ...m, onlinePrice: +e.target.value })} />
          ) },
        ]} />
      </Card>
    </div>
  );
}
