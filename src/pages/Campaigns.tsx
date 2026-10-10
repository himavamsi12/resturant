import { Cake, Edit2, Heart, MessageSquare, Plus, Send, UserX, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CUSTOMER_LABELS } from '../data/seed';
import { fmtDateTime, uid } from '../lib/billing';
import { useStore } from '../store/useStore';
import type { Campaign } from '../types';
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, Select, StatCard, Textarea, Toggle } from '../components/ui';

const TYPES: Campaign['type'][] = ['promotional', 'birthday', 'anniversary', 'win-back', 'feedback', 'new-launch', 'festival'];
const LS_KEY = 'dineflow-campaign-prefs';

type Prefs = { credits: number; auto: { birthday: boolean; anniversary: boolean; winback: boolean } };
const defaultPrefs: Prefs = { credits: 5000, auto: { birthday: true, anniversary: false, winback: false } };

function loadPrefs(): Prefs {
  try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }; } catch { return defaultPrefs; }
}

const credits = (msg: string) => Math.max(1, Math.ceil(msg.length / 160));

export default function Campaigns() {
  const campaigns = useStore((s) => s.campaigns);
  const customers = useStore((s) => s.customers);
  const sendCampaign = useStore((s) => s.sendCampaign);
  const toast = useStore((s) => s.toast);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [edit, setEdit] = useState<Campaign | null>(null);

  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ } }, [prefs]);

  const audience = (label: string) => customers.filter((c) => !c.dndPromo && (label === 'all' || c.labels.includes(label))).length;

  const send = (c: Campaign) => {
    const cost = audience(c.audienceLabel) * credits(c.message);
    if (c.channel === 'sms' && cost > prefs.credits) return toast(`Not enough SMS credits (${cost} needed)`, 'error');
    sendCampaign(c.id);
    if (c.channel === 'sms') setPrefs((p) => ({ ...p, credits: p.credits - cost }));
    toast(`"${c.name}" sent to ${audience(c.audienceLabel)} customers`);
  };

  const sent = campaigns.filter((c) => c.status === 'sent');

  const autos = [
    { key: 'birthday' as const, icon: <Cake size={18} />, title: 'Birthday wishes', desc: 'Sent at 10 AM on the customer’s birthday with a free dessert offer' },
    { key: 'anniversary' as const, icon: <Heart size={18} />, title: 'Anniversary wishes', desc: 'Sent on the anniversary date with a couple’s dinner offer' },
    { key: 'winback' as const, icon: <UserX size={18} />, title: 'Win-back', desc: 'Sent to customers who haven’t visited in 45 days' },
  ];

  return (
    <div className="px-4 pb-12 pt-2 sm:px-6">
      <PageHeader title="SMS & WhatsApp Campaigns" subtitle="Engage customers with targeted promotions"
        actions={<Button onClick={() => setEdit({ id: uid('cmp'), name: '', type: 'promotional', channel: 'sms', message: 'Hi {name}, ', audienceLabel: 'all', status: 'draft', sentCount: 0, createdAt: Date.now() })}><Plus size={16} /> New Campaign</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="SMS Credits" value={prefs.credits.toLocaleString('en-IN')} icon={<MessageSquare size={16} />} tone="blue"
          sub={<button className="font-medium text-brand-600" onClick={() => { setPrefs((p) => ({ ...p, credits: p.credits + 5000 })); toast('5,000 credits added'); }}>+ Recharge 5,000</button>} />
        <StatCard label="Campaigns Sent" value={sent.length} icon={<Send size={16} />} tone="green" />
        <StatCard label="Messages Delivered" value={sent.reduce((a, c) => a + c.sentCount, 0)} />
        <StatCard label="Reachable Customers" value={audience('all')} sub={`${customers.filter((c) => c.dndPromo).length} opted out (DND)`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card title="Campaigns">
          <DataTable rows={[...campaigns].sort((a, b) => b.createdAt - a.createdAt)} rowKey={(c) => c.id} cols={[
            { key: 'name', header: 'Campaign', render: (c) => <div><div className="font-medium">{c.name}</div><div className="max-w-xs truncate text-xs text-slate-500">{c.message}</div></div> },
            { key: 'type', header: 'Type', render: (c) => <span className="capitalize">{c.type.replace('-', ' ')}</span> },
            { key: 'ch', header: 'Channel', render: (c) => <Badge color={c.channel === 'sms' ? 'blue' : 'green'}>{c.channel === 'sms' ? 'SMS' : 'WhatsApp'}</Badge> },
            { key: 'aud', header: 'Audience', render: (c) => `${c.audienceLabel === 'all' ? 'All' : c.audienceLabel} (${c.status === 'sent' ? c.sentCount : audience(c.audienceLabel)})` },
            { key: 'st', header: 'Status', render: (c) => (
              <div>
                <Badge color={c.status === 'sent' ? 'green' : c.status === 'scheduled' ? 'yellow' : 'gray'}>{c.status}</Badge>
                {c.status === 'scheduled' && c.scheduledAt && <div className="mt-0.5 text-[11px] text-slate-500">{fmtDateTime(c.scheduledAt)}</div>}
              </div>
            ) },
            { key: 'act', header: '', className: 'text-right', render: (c) => c.status !== 'sent' && (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEdit(c)}><Edit2 size={14} /></Button>
                <Button size="sm" onClick={() => send(c)}><Send size={13} /> Send now</Button>
              </div>
            ) },
          ]} />
        </Card>

        <Card title={<span className="flex items-center gap-1.5"><Zap size={15} strokeWidth={1.6} className="text-brand-600" /> Automated Campaigns</span>}>
          <div className="divide-y divide-slate-100">
            {autos.map((a) => (
              <div key={a.key} className="flex gap-3 p-4">
                <span className="rounded-lg bg-brand-500/10 p-2 text-brand-600">{a.icon}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{a.title}</div>
                  <div className="text-xs text-slate-500">{a.desc}</div>
                </div>
                <Toggle checked={prefs.auto[a.key]} onChange={(v) => { setPrefs((p) => ({ ...p, auto: { ...p.auto, [a.key]: v } })); toast(`${a.title} ${v ? 'enabled' : 'disabled'}`, 'info'); }} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {edit && <CampaignForm campaign={edit} audience={audience} onClose={() => setEdit(null)} />}
    </div>
  );
}

function CampaignForm({ campaign, audience, onClose }: { campaign: Campaign; audience: (l: string) => number; onClose: () => void }) {
  const upsert = useStore((s) => s.upsertCampaign);
  const customers = useStore((s) => s.customers);
  const restaurant = useStore((s) => s.settings.restaurantName);
  const toast = useStore((s) => s.toast);
  const [c, setC] = useState(campaign);
  const labels = useMemo(() => Array.from(new Set([...CUSTOMER_LABELS, ...customers.flatMap((x) => x.labels)])), [customers]);
  const size = audience(c.audienceLabel);
  const sample = customers.find((x) => c.audienceLabel === 'all' || x.labels.includes(c.audienceLabel));

  const toLocal = (t?: number) => (t ? new Date(t - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

  const save = (status: Campaign['status']) => {
    if (!c.name.trim() || !c.message.trim()) return toast('Name and message are required', 'error');
    if (status === 'scheduled' && (!c.scheduledAt || c.scheduledAt < Date.now())) return toast('Pick a future schedule time', 'error');
    upsert({ ...c, status });
    toast(status === 'scheduled' ? 'Campaign scheduled' : 'Draft saved');
    onClose();
  };

  return (
    <Modal open onClose={onClose} size="lg" title="Campaign" footer={<>
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button variant="outline" onClick={() => save('draft')}>Save Draft</Button>
      <Button onClick={() => save('scheduled')}>Schedule</Button>
    </>}>
      <div className="grid gap-5 md:grid-cols-[1fr_240px]">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Campaign name" className="sm:col-span-2"><Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
          <Field label="Type">
            <Select value={c.type} onChange={(e) => setC({ ...c, type: e.target.value as Campaign['type'] })}>
              {TYPES.map((t) => <option key={t} value={t}>{t.replace('-', ' ')}</option>)}
            </Select>
          </Field>
          <Field label="Channel">
            <Select value={c.channel} onChange={(e) => setC({ ...c, channel: e.target.value as Campaign['channel'] })}>
              <option value="sms">SMS</option><option value="whatsapp">WhatsApp</option>
            </Select>
          </Field>
          <Field label="Audience" className="sm:col-span-2" hint={`${size} customers will receive this (DND excluded)`}>
            <Select value={c.audienceLabel} onChange={(e) => setC({ ...c, audienceLabel: e.target.value })}>
              <option value="all">All customers</option>
              {labels.map((l) => <option key={l}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Message" className="sm:col-span-2" hint="Use {name} to personalise">
            <Textarea rows={4} value={c.message} onChange={(e) => setC({ ...c, message: e.target.value })} />
          </Field>
          <div className="text-xs text-slate-500 sm:col-span-2">
            {c.message.length} chars · {credits(c.message)} credit(s)/msg · <b>{credits(c.message) * size} credits</b> total
          </div>
          <Field label="Schedule at" className="sm:col-span-2">
            <Input type="datetime-local" value={toLocal(c.scheduledAt)} onChange={(e) => setC({ ...c, scheduledAt: e.target.value ? new Date(e.target.value).getTime() : undefined })} />
          </Field>
        </div>
        <div className="mx-auto w-56 rounded-[2rem] bg-white/55 p-3 shadow-[inset_0_0_0_6px_rgba(255,255,255,.7),0_30px_50px_-30px_rgba(0,0,0,.35)]">
          <div className="mb-3 text-center text-[11px] font-semibold text-slate-500">{c.channel === 'sms' ? 'DNFLOW' : restaurant}</div>
          <div className={c.channel === 'sms' ? 'rounded-2xl rounded-tl-sm bg-white p-3 text-xs text-slate-800 shadow' : 'rounded-2xl rounded-tl-sm bg-brand-500/10 p-3 text-xs text-slate-800 shadow'}>
            {c.message.replace(/\{name\}/g, sample?.name.split(' ')[0] || 'Guest') || '…'}
          </div>
          <div className="mt-24 text-center text-[10px] text-slate-400">Preview</div>
        </div>
      </div>
    </Modal>
  );
}
