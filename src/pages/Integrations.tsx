import { CheckCircle2, Plug } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import type { Integration } from '../types';
import { Badge, Button, Card, clsx, Empty, Field, Input, Modal, PageHeader, Pills, SearchInput } from '../components/ui';

export default function Integrations() {
  const integrations = useStore((s) => s.integrations);
  const toggle = useStore((s) => s.toggleIntegration);
  const toast = useStore((s) => s.toast);
  const outletId = useStore((s) => s.outletId);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'connected' | 'available'>('all');
  const [cfg, setCfg] = useState<Integration | null>(null);
  const [form, setForm] = useState({ apiKey: '', storeId: '' });

  const groups = useMemo(() => {
    const list = integrations.filter((i) =>
      (filter === 'all' || (filter === 'connected' ? i.connected : !i.connected)) &&
      (!q || `${i.name} ${i.category} ${i.description}`.toLowerCase().includes(q.toLowerCase())));
    const g: Record<string, Integration[]> = {};
    list.forEach((i) => (g[i.category] ||= []).push(i));
    return Object.entries(g);
  }, [integrations, q, filter]);

  const openConnect = (i: Integration) => { setCfg(i); setForm({ apiKey: '', storeId: `${outletId.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}` }); };

  const connect = () => {
    if (!cfg) return;
    if (form.apiKey.trim().length < 6) return toast('Enter a valid API key (min 6 chars)', 'error');
    toggle(cfg.id);
    toast(`${cfg.name} connected`);
    setCfg(null);
  };

  return (
    <div className="px-4 pb-12 pt-2 sm:px-6">
      <PageHeader title="Integrations Marketplace" subtitle={`${integrations.filter((i) => i.connected).length} of ${integrations.length} apps connected — aggregators, payments, delivery, accounting & more`}
        actions={<><SearchInput value={q} onChange={setQ} placeholder="Search integrations…" />
          <Pills value={filter} onChange={setFilter} options={[{ id: 'all', label: 'All' }, { id: 'connected', label: 'Connected' }, { id: 'available', label: 'Available' }]} /></>} />

      {groups.length === 0 && <Card><Empty icon={<Plug size={36} />} title="No integrations found" /></Card>}
      {groups.map(([cat, items]) => (
        <div key={cat} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-500">{cat}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((i) => (
              <div key={i.id} className={clsx('flex flex-col rounded-xl border bg-white p-4 shadow-sm', i.connected ? 'border-transparent' : 'border-slate-200')}>
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-2xl">{i.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">{i.name}</div>
                    {i.connected ? <Badge color="green"><CheckCircle2 size={11} /> Connected</Badge> : <Badge>Not connected</Badge>}
                  </div>
                </div>
                <p className="mt-2 flex-1 text-sm text-slate-500">{i.description}</p>
                <div className="mt-3">
                  {i.connected ? (
                    <Button size="sm" variant="danger" className="w-full" onClick={() => { if (confirm(`Disconnect ${i.name}?`)) { toggle(i.id); toast(`${i.name} disconnected`, 'info'); } }}>Disconnect</Button>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full" onClick={() => openConnect(i)}>Connect</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Modal open={!!cfg} onClose={() => setCfg(null)} title={<span className="flex items-center gap-2">{cfg?.icon} Connect {cfg?.name}</span>}
        footer={<><Button variant="outline" onClick={() => setCfg(null)}>Cancel</Button><Button onClick={connect}>Connect</Button></>}>
        <p className="mb-3 text-sm text-slate-600">{cfg?.description}. Enter the credentials provided by {cfg?.name}.</p>
        <div className="space-y-3">
          <Field label="API Key / Access Token"><Input value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="sk_live_…" autoFocus /></Field>
          <Field label="Outlet / Store ID" hint="Maps this outlet to the partner’s store"><Input value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
