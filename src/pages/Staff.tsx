import { Check, Edit2, Minus, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { inr, startOfDay, uid } from '../lib/billing';
import { useCurrentStaff, useStore } from '../store/useStore';
import type { Role, Staff as StaffT } from '../types';
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, Select, StatCard, Toggle, type BadgeColor } from '../components/ui';

const ROLES: Role[] = ['owner', 'manager', 'cashier', 'captain', 'chef'];
const ROLE_COLOR: Record<Role, BadgeColor> = { owner: 'purple', manager: 'blue', cashier: 'green', captain: 'orange', chef: 'yellow' };

const MODULES = ['Billing', 'Cancel / Discount', 'Tables', 'KDS', 'Online Orders', 'Menu', 'Inventory', 'Purchase', 'CRM', 'Reports', 'Cash & Expenses', 'Staff', 'Settings'];
const PERMS: Record<Role, string[]> = {
  owner: MODULES,
  manager: MODULES.filter((m) => m !== 'Settings'),
  cashier: ['Billing', 'Tables', 'Online Orders', 'CRM', 'Cash & Expenses'],
  captain: ['Billing', 'Tables'],
  chef: ['KDS', 'Inventory'],
};

export default function Staff() {
  const staff = useStore((s) => s.staff);
  const orders = useStore((s) => s.orders);
  const me = useCurrentStaff();
  const [edit, setEdit] = useState<StaffT | null>(null);

  const today = startOfDay();
  const stats = useMemo(() => {
    const m: Record<string, { orders: number; sales: number; cancelled: number }> = {};
    orders.filter((o) => o.createdAt >= today && o.staffId).forEach((o) => {
      const s = (m[o.staffId!] ||= { orders: 0, sales: 0, cancelled: 0 });
      if (o.status === 'settled') { s.orders++; s.sales += o.total; }
      if (o.status === 'cancelled') s.cancelled++;
    });
    return m;
  }, [orders, today]);

  const top = [...staff].sort((a, b) => (stats[b.id]?.sales || 0) - (stats[a.id]?.sales || 0))[0];

  return (
    <div className="px-4 pb-12 pt-2 sm:px-6">
      <PageHeader title="Staff & Roles" subtitle="Manage team members, PIN logins and module access"
        actions={<Button onClick={() => setEdit({ id: uid('s'), name: '', role: 'cashier', pin: '', phone: '', active: true })}><UserPlus size={16} /> Add Staff</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Staff" value={staff.length} />
        <StatCard label="Active" value={staff.filter((s) => s.active).length} tone="green" />
        <StatCard label="Today’s Orders" value={Object.values(stats).reduce((a, s) => a + s.orders, 0)} />
        <StatCard label="Top Performer Today" value={<span className="text-lg">{stats[top?.id]?.sales ? top.name : '—'}</span>} sub={stats[top?.id]?.sales ? inr(stats[top.id].sales) : 'No sales yet'} />
      </div>

      <Card title="Team" className="mb-5">
        <DataTable rows={staff} rowKey={(s) => s.id} cols={[
          { key: 'name', header: 'Name', render: (s) => (
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold">{s.name[0]}</span>
              <div><div className="font-medium">{s.name} {s.id === me?.id && <span className="text-xs text-slate-400">(you)</span>}</div><div className="text-xs text-slate-500">{s.phone}</div></div>
            </div>
          ) },
          { key: 'role', header: 'Role', render: (s) => <Badge color={ROLE_COLOR[s.role]} className="capitalize">{s.role}</Badge> },
          { key: 'pin', header: 'PIN', render: () => <span className="font-mono tracking-widest text-slate-400">••••</span> },
          { key: 'orders', header: 'Orders today', className: 'text-right', render: (s) => stats[s.id]?.orders || 0 },
          { key: 'sales', header: 'Sales today', className: 'text-right', render: (s) => inr(stats[s.id]?.sales || 0) },
          { key: 'cancel', header: 'Cancelled', className: 'text-right', render: (s) => stats[s.id]?.cancelled || 0 },
          { key: 'st', header: 'Status', render: (s) => <Badge color={s.active ? 'green' : 'gray'}>{s.active ? 'Active' : 'Inactive'}</Badge> },
          { key: 'act', header: '', className: 'text-right', render: (s) => <Button size="sm" variant="ghost" onClick={() => setEdit(s)}><Edit2 size={14} /></Button> },
        ]} />
      </Card>

      <Card title="Role Permission Matrix">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[.06] text-xs text-slate-500">
                <th className="px-4 py-2.5 text-left">Module</th>
                {ROLES.map((r) => <th key={r} className="px-4 py-2.5 text-center capitalize">{r}</th>)}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-slate-700">{m}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-4 py-2 text-center">
                      {PERMS[r].includes(m) ? <Check size={16} className="inline text-brand-700" /> : <Minus size={16} className="inline text-slate-300" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {edit && <StaffForm staff={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function StaffForm({ staff, onClose }: { staff: StaffT; onClose: () => void }) {
  const all = useStore((s) => s.staff);
  const upsert = useStore((s) => s.upsertStaff);
  const me = useCurrentStaff();
  const toast = useStore((s) => s.toast);
  const [s, setS] = useState(staff);
  const isNew = !all.some((x) => x.id === staff.id);

  const save = () => {
    if (!s.name.trim()) return toast('Name is required', 'error');
    if (!/^\d{4}$/.test(s.pin)) return toast('PIN must be exactly 4 digits', 'error');
    if (all.some((x) => x.pin === s.pin && x.id !== s.id)) return toast('PIN already used by another staff member', 'error');
    if (s.id === me?.id && !s.active) return toast('You cannot deactivate yourself', 'error');
    upsert({ ...s, name: s.name.trim() });
    toast(isNew ? 'Staff added' : 'Staff updated');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add Staff' : 'Edit Staff'} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name" className="sm:col-span-2"><Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} autoFocus /></Field>
        <Field label="Phone"><Input value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} /></Field>
        <Field label="Role">
          <Select value={s.role} onChange={(e) => setS({ ...s, role: e.target.value as Role })}>
            {ROLES.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
          </Select>
        </Field>
        <Field label="Login PIN (4 digits)"><Input value={s.pin} maxLength={4} inputMode="numeric" onChange={(e) => setS({ ...s, pin: e.target.value.replace(/\D/g, '') })} /></Field>
        <div className="flex items-end pb-2"><Toggle checked={s.active} onChange={(v) => setS({ ...s, active: v })} label="Active" /></div>
      </div>
      <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <b className="capitalize">{s.role}</b> can access: {PERMS[s.role].join(', ')}
      </div>
    </Modal>
  );
}
