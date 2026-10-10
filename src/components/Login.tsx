import { Delete } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../store/useStore';
import RestaurantPhoto from './RestaurantPhoto';
import { clsx } from './ui';

export default function Login() {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const login = useStore((s) => s.login);
  const staff = useStore((s) => s.staff);
  const name = useStore((s) => s.settings.restaurantName);

  const press = (d: string) => {
    setErr(false);
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4 && !login(next)) { setErr(true); setTimeout(() => setPin(''), 400); }
  };

  const key = 'flex h-14 items-center justify-center rounded-2xl bg-white/55 text-xl font-light text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,.8)] transition hover:bg-white/85 active:scale-95';

  return (
    <div className="flex min-h-full flex-col bg-[#d9d9d9] px-4 py-6 sm:px-8">
      <header className="flex items-center gap-2.5">
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
          <circle cx="17" cy="17" r="13" stroke="#111" strokeWidth="5" />
          <path d="M17 4v13h13" stroke="#111" strokeWidth="5" />
        </svg>
        <span className="text-[15px] font-medium tracking-tight text-slate-900">DineFlow</span>
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-8 py-8 lg:grid-cols-[1fr_380px]">
        <div className="hidden lg:block">
          <h1 className="text-[42px] font-normal leading-tight tracking-tight text-slate-900">{name}</h1>
          <p className="mt-1 text-[15px] text-slate-500">Billing, kitchen, inventory and guests — in one quiet place.</p>
          <RestaurantPhoto className="mt-6 w-full max-w-[560px]" />
        </div>

        <div className="glass mx-auto w-full max-w-sm rounded-3xl p-6">
          <div className="border-b border-black/[.06] pb-4">
            <div className="text-[15px] text-slate-900">Staff login</div>
            <div className="text-xs text-slate-500">Enter your 4-digit PIN</div>
          </div>

          <div className={clsx('my-7 flex justify-center gap-4', err && 'animate-pulse')}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={clsx('h-3.5 w-3.5 rounded-full transition', err ? 'bg-red-500' : i < pin.length ? 'bg-brand-600' : 'bg-black/10')} />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0'].map((d, i) =>
              d === '' ? <span key={i} /> : <button key={i} onClick={() => press(d)} className={key}>{d}</button>)}
            <button onClick={() => setPin(pin.slice(0, -1))} className={clsx(key, 'text-slate-600')} title="Delete"><Delete size={18} strokeWidth={1.6} /></button>
          </div>

          <div className="mt-6 rounded-2xl bg-white/45 p-3">
            <div className="mb-1.5 text-xs text-slate-500">Demo PINs</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
              {staff.slice(0, 6).map((s) => (
                <button key={s.id} onClick={() => login(s.pin)} className="text-left hover:text-brand-700">
                  <span className="tabular-nums text-slate-900">{s.pin}</span> · {s.name.split(' ')[0]} <span className="text-slate-400">{s.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
