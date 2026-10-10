import { CheckCircle2, ClipboardEdit, MessageCircle, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtDateTime } from '../lib/billing';
import { useStore } from '../store/useStore';
import type { Feedback as FB } from '../types';
import { Badge, Button, Card, clsx, Empty, Field, Input, Modal, PageHeader, Pills, Select, StatCard, Textarea } from '../components/ui';

const Stars = ({ n, size = 14 }: { n: number; size?: number }) => (
  <span className="inline-flex">
    {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} className={i <= n ? 'fill-slate-800 text-slate-800' : 'text-slate-300'} />)}
  </span>
);

const BAR_COLORS = ['#cdcdcd', '#a6a6a6', '#7c7c7c', '#2a2a2a', '#1a9157'];

export default function Feedback() {
  const feedbacks = useStore((s) => s.feedbacks);
  const resolve = useStore((s) => s.resolveFeedback);
  const toast = useStore((s) => s.toast);
  const [rating, setRating] = useState('all');
  const [status, setStatus] = useState<'all' | 'open' | 'resolved'>('all');
  const [replyTo, setReplyTo] = useState<FB | null>(null);
  const [reply, setReply] = useState('');
  const [collect, setCollect] = useState(false);

  const avg = (k: 'rating' | 'food' | 'service' | 'ambience') => (feedbacks.length ? feedbacks.reduce((a, f) => a + f[k], 0) / feedbacks.length : 0);
  const dist = [1, 2, 3, 4, 5].map((r) => ({ rating: `${r}★`, count: feedbacks.filter((f) => f.rating === r).length }));
  const promoters = feedbacks.filter((f) => f.rating === 5).length;
  const detractors = feedbacks.filter((f) => f.rating <= 3).length;
  const nps = feedbacks.length ? Math.round(((promoters - detractors) / feedbacks.length) * 100) : 0;

  const rows = useMemo(() => feedbacks
    .filter((f) => rating === 'all' || f.rating === +rating)
    .filter((f) => status === 'all' || (status === 'open' ? !f.resolved : f.resolved))
    .sort((a, b) => b.at - a.at), [feedbacks, rating, status]);

  return (
    <div className="px-4 pb-12 pt-2 sm:px-6">
      <PageHeader title="Customer Feedback" subtitle="Collect, track and respond to guest feedback"
        actions={<Button onClick={() => setCollect(true)}><ClipboardEdit size={16} /> Collect Feedback</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Overall" value={<span className="flex items-center gap-2">{avg('rating').toFixed(1)} <Stars n={Math.round(avg('rating'))} /></span>} sub={`${feedbacks.length} responses`} />
        <StatCard label="Food" value={avg('food').toFixed(1)} />
        <StatCard label="Service" value={avg('service').toFixed(1)} />
        <StatCard label="Ambience" value={avg('ambience').toFixed(1)} />
        <StatCard label="NPS Score" value={nps} sub={`${promoters} promoters · ${detractors} detractors`} tone={nps > 30 ? 'green' : 'yellow'} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card title="Rating distribution">
          <div className="h-56 p-3">
            <ResponsiveContainer>
              <BarChart data={dist}>
                <CartesianGrid vertical={false} stroke="rgba(0,0,0,.06)" />
                <XAxis dataKey="rating" tick={{ fontSize: 12, fill: '#7c7c7c' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#7c7c7c' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,.4)' }} contentStyle={{ borderRadius: 14, border: 'none', fontSize: 12, background: 'rgba(242,242,242,.95)', boxShadow: '0 20px 40px -20px rgba(0,0,0,.35)' }} />
                <Bar dataKey="count" radius={[8, 8, 8, 8]} maxBarSize={36}>{dist.map((_, i) => <Cell key={i} fill={BAR_COLORS[i]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="border-t p-3 text-sm text-slate-600">
            <b className="text-red-600">{feedbacks.filter((f) => !f.resolved).length}</b> unresolved complaints need attention.
          </div>
        </Card>

        <Card title="Responses" actions={<>
          <Select value={rating} onChange={(e) => setRating(e.target.value)} className="!w-auto !py-1 text-xs">
            <option value="all">All ratings</option>
            {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} star</option>)}
          </Select>
          <Pills value={status} onChange={setStatus} options={[{ id: 'all', label: 'All' }, { id: 'open', label: 'Unresolved' }, { id: 'resolved', label: 'Resolved' }]} />
        </>}>
          {rows.length === 0 && <Empty title="No feedback matches" />}
          <div className="divide-y divide-slate-100">
            {rows.map((f) => (
              <div key={f.id} className={clsx('flex gap-3 p-4', !f.resolved && 'bg-red-500/[.06]')}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600">{f.customerName[0]}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">{f.customerName}</span>
                    <Stars n={f.rating} />
                    {f.resolved ? <Badge color="green">Resolved</Badge> : <Badge color="red">Open</Badge>}
                    <span className="ml-auto text-xs text-slate-400">{fmtDateTime(f.at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{f.comment}</p>
                  <div className="mt-1 text-xs text-slate-500">Food {f.food}/5 · Service {f.service}/5 · Ambience {f.ambience}/5</div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setReplyTo(f); setReply(`Hi ${f.customerName.split(' ')[0]}, thank you for your feedback! `); }}><MessageCircle size={13} /> Reply</Button>
                    {!f.resolved && <Button size="sm" variant="success" onClick={() => { resolve(f.id); toast('Marked as resolved'); }}><CheckCircle2 size={13} /> Resolve</Button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal open={!!replyTo} onClose={() => setReplyTo(null)} title={`Reply to ${replyTo?.customerName}`}
        footer={<><Button variant="outline" onClick={() => setReplyTo(null)}>Cancel</Button>
          <Button onClick={() => { toast('SMS sent to customer'); if (replyTo && !replyTo.resolved) resolve(replyTo.id); setReplyTo(null); }}>Send SMS</Button></>}>
        <Textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} />
        <p className="mt-1 text-xs text-slate-400">{reply.length} characters · {Math.max(1, Math.ceil(reply.length / 160))} SMS credit(s)</p>
      </Modal>

      {collect && <CollectForm onClose={() => setCollect(false)} />}
    </div>
  );
}

function StarInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-slate-700">{label}</span>
      <span className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" onClick={() => onChange(i)}>
            <Star size={26} className={i <= value ? 'fill-slate-800 text-slate-800' : 'text-slate-300 hover:text-slate-300'} />
          </button>
        ))}
      </span>
    </div>
  );
}

function CollectForm({ onClose }: { onClose: () => void }) {
  const customers = useStore((s) => s.customers);
  const addFeedback = useStore((s) => s.addFeedback);
  const toast = useStore((s) => s.toast);
  const [customerId, setCustomerId] = useState('');
  const [name, setName] = useState('');
  const [r, setR] = useState({ rating: 0, food: 0, service: 0, ambience: 0 });
  const [comment, setComment] = useState('');

  const submit = () => {
    const cust = customers.find((c) => c.id === customerId);
    const customerName = cust?.name || name.trim();
    if (!customerName) return toast('Choose a customer or enter a name', 'error');
    if (!r.rating) return toast('Overall rating is required', 'error');
    addFeedback({
      customerId: cust?.id, customerName, rating: r.rating,
      food: r.food || r.rating, service: r.service || r.rating, ambience: r.ambience || r.rating, comment: comment.trim() || '—',
    });
    toast('Thank you! Feedback recorded');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Guest Feedback Form" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit}>Submit</Button></>}>
      <div className="glass mb-4 rounded-3xl p-5 text-slate-900">
        <div className="text-lg font-normal tracking-tight">How was your meal?</div>
        <div className="text-sm text-slate-500">Your feedback helps us serve you better.</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Existing customer">
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">— Walk-in guest —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
          </Select>
        </Field>
        <Field label="Or guest name"><Input value={name} disabled={!!customerId} onChange={(e) => setName(e.target.value)} /></Field>
      </div>
      <div className="mt-3 divide-y divide-black/[.05] rounded-2xl bg-white/45 px-3">
        <StarInput label="Overall *" value={r.rating} onChange={(n) => setR({ ...r, rating: n })} />
        <StarInput label="Food" value={r.food} onChange={(n) => setR({ ...r, food: n })} />
        <StarInput label="Service" value={r.service} onChange={(n) => setR({ ...r, service: n })} />
        <StarInput label="Ambience" value={r.ambience} onChange={(n) => setR({ ...r, ambience: n })} />
      </div>
      <Field label="Comments" className="mt-3"><Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell us more…" /></Field>
    </Modal>
  );
}
