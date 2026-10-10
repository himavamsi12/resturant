import clsx from 'clsx';
import { X } from 'lucide-react';
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { useStore } from '../store/useStore';

export { clsx };

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
const btnStyles: Record<BtnVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-[0_8px_20px_-10px_rgba(26,145,87,.7)]',
  secondary: 'bg-slate-900 text-white hover:bg-black',
  ghost: 'text-slate-600 hover:bg-black/[.04]',
  danger: 'bg-white/50 text-red-600 hover:bg-red-50',
  success: 'bg-brand-600 text-white hover:bg-brand-700',
  outline: 'bg-white/60 text-slate-800 hover:bg-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]',
};

export function Button({ variant = 'primary', size = 'md', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...p}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-6 py-3.5 text-base',
        btnStyles[variant],
        className,
      )}
    />
  );
}

export function Card({ className, children, title, actions }: { className?: string; children: ReactNode; title?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={clsx('glass rounded-3xl', className)}>
      {(title || actions) && (
        <div className="mx-5 flex items-center justify-between gap-2 border-b border-black/[.06] py-4">
          <h3 className="text-[15px] font-medium text-slate-900">{title}</h3>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      )}
      {children}
    </div>
  );
}

const badgeColors = {
  gray: 'bg-black/[.05] text-slate-700',
  red: 'bg-red-500/10 text-red-700',
  green: 'bg-brand-500/15 text-brand-800',
  yellow: 'bg-amber-500/15 text-amber-800',
  blue: 'bg-sky-500/10 text-sky-800',
  purple: 'bg-violet-500/10 text-violet-800',
  orange: 'bg-orange-500/10 text-orange-800',
};
export type BadgeColor = keyof typeof badgeColors;
export function Badge({ color = 'gray', children, className }: { color?: BadgeColor; children: ReactNode; className?: string }) {
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium', badgeColors[color], className)}>{children}</span>;
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-500/30 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx('flex max-h-[92vh] w-full flex-col rounded-3xl bg-[#efefef]/95 shadow-[0_40px_80px_-30px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.8)] backdrop-blur-xl', { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size])}
      >
        <div className="mx-6 flex items-center justify-between border-b border-black/[.06] py-4">
          <h2 className="text-[17px] font-medium text-slate-900">{title}</h2>
          <IconButton onClick={onClose} title="Close"><X size={16} /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-6 pb-5 pt-1">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-xs text-slate-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full rounded-xl border-0 bg-white/60 px-3.5 py-2.5 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(0,0,0,.05)] outline-none transition placeholder:text-slate-400 focus:bg-white/90 focus:shadow-[inset_0_0_0_1.5px_#1a9157]';
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx(inputCls, className)} />;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={clsx(inputCls, className)} />;
export const Select = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={clsx(inputCls, 'pr-8', className)}>{children}</select>
);

export function Toggle({ checked, onChange, label, size = 'md' }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; size?: 'sm' | 'md' }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm text-slate-700">
      <span className={clsx('relative inline-flex shrink-0 rounded-full transition', checked ? 'bg-brand-600' : 'bg-black/15', size === 'sm' ? 'h-4 w-7' : 'h-5 w-9')}>
        <span className={clsx('absolute top-0.5 rounded-full bg-white shadow transition', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4', checked ? (size === 'sm' ? 'left-3.5' : 'left-[18px]') : 'left-0.5')} />
      </span>
      {label}
    </button>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={clsx('no-scrollbar flex gap-1.5 overflow-x-auto', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx('flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm transition',
            value === t.id ? 'bg-black/[.09] text-slate-900' : 'bg-white/45 text-slate-600 hover:bg-white/70')}
        >
          {t.label}
          {t.count !== undefined && <span className={clsx('rounded-full px-1.5 text-[11px]', value === t.id ? 'bg-brand-600 text-white' : 'bg-black/[.06] text-slate-600')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pills<T extends string>({ options, value, onChange }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex gap-1">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)}
          className={clsx('rounded-xl px-3.5 py-2 text-xs transition', value === o.id ? 'bg-black/[.09] text-slate-900' : 'bg-white/45 text-slate-600 hover:bg-white/70')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[32px] font-normal leading-tight tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, icon, tone = 'gray' }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: BadgeColor }) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="flex items-start justify-between">
        <span className="text-[13px] text-slate-500">{label}</span>
        {icon && <span className={clsx('flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-slate-700', tone === 'red' && 'text-red-600')}>{icon}</span>}
      </div>
      <div className="mt-3 text-[28px] font-normal leading-none tracking-tight text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon && <div className="text-slate-300">{icon}</div>}
      <p className="font-medium text-slate-600">{title}</p>
      {hint && <p className="max-w-sm text-sm text-slate-400">{hint}</p>}
      {action}
    </div>
  );
}

/** Simple data table. */
export function DataTable<T>({ rows, cols, empty = 'No records', onRowClick, rowKey }: {
  rows: T[];
  cols: { key: string; header: ReactNode; render: (r: T) => ReactNode; className?: string }[];
  empty?: string;
  onRowClick?: (r: T) => void;
  rowKey: (r: T) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/[.06] text-left text-xs text-slate-500">
            {cols.map((c) => <th key={c.key} className={clsx('px-5 py-3 font-normal', c.className)}>{c.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={cols.length} className="px-4 py-10 text-center text-slate-400">{empty}</td></tr>}
          {rows.map((r) => (
            <tr key={rowKey(r)} onClick={() => onRowClick?.(r)} className={clsx('border-b border-black/[.04] last:border-0', onRowClick && 'cursor-pointer hover:bg-white/40')}>
              {cols.map((c) => <td key={c.key} className={clsx('px-5 py-3 text-slate-700', c.className)}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VegMark({ veg }: { veg: boolean }) {
  return (
    <span title={veg ? 'Veg' : 'Non-veg'} className={clsx('inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center border', veg ? 'border-emerald-600' : 'border-red-700')}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', veg ? 'bg-emerald-600' : 'bg-red-700')} />
    </span>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} onClick={() => dismiss(t.id)}
          className={clsx('pointer-events-auto flex cursor-pointer items-center gap-2.5 rounded-2xl bg-[#f2f2f2]/90 px-4 py-3 text-sm text-slate-800 shadow-[0_20px_40px_-20px_rgba(0,0,0,.4)] backdrop-blur-xl')}>
          <span className={clsx('h-2 w-2 rounded-full', t.type === 'success' && 'bg-brand-600', t.type === 'error' && 'bg-red-500', t.type === 'info' && 'bg-slate-500')} />
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={clsx('max-w-xs', className)} />;
}

/** Square soft icon button — the signature control of the theme. */
export function IconButton({ className, active, size = 'md', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...p}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-xl text-slate-700 transition hover:text-slate-900 active:scale-95',
        size === 'sm' && 'h-8 w-8', size === 'md' && 'h-10 w-10', size === 'lg' && 'h-12 w-12 rounded-2xl',
        active ? 'bg-black/[.1] text-slate-900' : 'bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,.8)] hover:bg-white/85',
        className,
      )}
    />
  );
}

/** 48px soft square — the reference's signature control. */
export const squareCls = (active?: boolean) => clsx(
  'flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] transition',
  active ? 'bg-black/[.09] text-slate-900' : 'bg-white/50 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,.75)] hover:bg-white/80',
);
