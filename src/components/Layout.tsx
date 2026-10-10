import {
  ArrowLeft, BarChart3, BookOpen, Boxes, ChefHat, ClipboardList, Gift, Globe, LayoutGrid, LogOut, MapPin, Megaphone,
  MessageSquareHeart, MonitorSmartphone, Plug, QrCode, Receipt, Scale, Settings, ShoppingCart, Smartphone, Ticket, Truck,
  UserCog, Users, Wallet,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCurrentStaff, useOutlet, useStore } from '../store/useStore';
import { clsx, squareCls } from './ui';

type NavItem = { to: string; label: string; icon: ReactNode; badge?: number };
type NavGroup = { id: string; label: string; items: NavItem[] };

const ic = (I: typeof Receipt) => <I size={18} strokeWidth={1.5} />;

function useNav(): { groups: NavGroup[]; admin: NavGroup } {
  const placed = useStore((s) => s.onlineOrders.filter((o) => o.status === 'placed').length);
  const newKots = useStore((s) => s.kots.filter((k) => k.status === 'new').length);
  const lowStock = useStore((s) => s.rawMaterials.filter((r) => r.stock <= r.minStock).length);
  return {
    groups: [
      { id: 'serve', label: 'Serve', items: [
        { to: '/billing', label: 'Billing', icon: ic(Receipt) },
        { to: '/tables', label: 'Tables', icon: ic(LayoutGrid) },
        { to: '/orders', label: 'Orders', icon: ic(ClipboardList) },
        { to: '/kds', label: 'Kitchen', icon: ic(ChefHat), badge: newKots },
        { to: '/online', label: 'Online orders', icon: ic(Truck), badge: placed },
      ] },
      { id: 'stock', label: 'Stock', items: [
        { to: '/menu', label: 'Menu', icon: ic(BookOpen) },
        { to: '/inventory', label: 'Inventory', icon: ic(Boxes), badge: lowStock },
        { to: '/purchase', label: 'Purchase', icon: ic(ShoppingCart) },
      ] },
      { id: 'grow', label: 'Grow', items: [
        { to: '/crm', label: 'Customers', icon: ic(Users) },
        { to: '/loyalty', label: 'Loyalty', icon: ic(Gift) },
        { to: '/feedback', label: 'Feedback', icon: ic(MessageSquareHeart) },
        { to: '/campaigns', label: 'Campaigns', icon: ic(Megaphone) },
        { to: '/reports', label: 'Reports', icon: ic(BarChart3) },
        { to: '/reconciliation', label: 'Reconciliation', icon: ic(Scale) },
        { to: '/cash', label: 'Cash & expenses', icon: ic(Wallet) },
      ] },
    ],
    admin: { id: 'admin', label: 'Admin', items: [
      { to: '/settings', label: 'Settings', icon: ic(Settings) },
      { to: '/staff', label: 'Staff', icon: ic(UserCog) },
      { to: '/integrations', label: 'Integrations', icon: ic(Plug) },
    ] },
  };
}

const DEVICES = [
  { to: '/captain', label: 'Captain app', icon: ic(Smartphone) },
  { to: '/scan/t-ac-1', label: 'Scan & order', icon: ic(QrCode) },
  { to: '/kiosk', label: 'Kiosk', icon: ic(MonitorSmartphone) },
  { to: '/tokens', label: 'Token display', icon: ic(Ticket) },
  { to: '/website', label: 'Website', icon: ic(Globe) },
];

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return { open, setOpen, ref };
}

const popCls = 'absolute right-0 z-50 mt-2 rounded-[20px] bg-[#ececec]/95 p-2 shadow-[0_30px_60px_-25px_rgba(0,0,0,.45)] backdrop-blur-xl';

function RailButton({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.to} className="group relative">
      {({ isActive }) => (
        <>
          <span className={squareCls(isActive)}>{item.icon}</span>
          {!!item.badge && <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] text-white">{item.badge}</span>}
          <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-[#ececec]/95 px-3 py-1.5 text-xs text-slate-800 shadow-[0_10px_30px_-12px_rgba(0,0,0,.35)] backdrop-blur group-hover:md:block">
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export default function Layout() {
  const { groups, admin } = useNav();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const staff = useCurrentStaff();
  const outlet = useOutlet();
  const outlets = useStore((s) => s.outlets);
  const setOutlet = useStore((s) => s.setOutlet);
  const logout = useStore((s) => s.logout);
  const outletPop = usePopover();
  const menuPop = usePopover();

  const inAdmin = admin.items.some((i) => pathname.startsWith(i.to));
  const group = [...groups, admin].find((g) => g.items.some((i) => pathname.startsWith(i.to)));
  const rail = group || groups[0];
  const area = outlet.name.split('–')[1]?.trim() || outlet.name;

  return (
    <div className="flex h-full flex-col">
      <header className="relative flex shrink-0 items-center gap-3 px-4 pt-6 sm:px-7">
        <Link to="/" title="Overview" className="flex h-12 w-12 items-center">
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
            <circle cx="17" cy="17" r="13" stroke="#111" strokeWidth="5" />
            <path d="M17 4v13h13" stroke="#111" strokeWidth="5" />
          </svg>
        </Link>

        <nav className="no-scrollbar mx-auto flex gap-1.5 overflow-x-auto md:absolute md:left-1/2 md:-translate-x-1/2">
          {groups.map((g) => (
            <button key={g.id} onClick={() => navigate(g.items[0].to)}
              className={clsx('h-12 shrink-0 rounded-[14px] px-5 text-[15px] transition',
                group?.id === g.id ? 'bg-black/[.09] text-slate-900' : 'bg-white/50 text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,.75)] hover:bg-white/80')}>
              {g.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div ref={outletPop.ref} className="relative hidden md:block">
            <button onClick={() => outletPop.setOpen(!outletPop.open)}
              className="flex h-12 items-center gap-2 rounded-[14px] bg-white/50 px-5 text-[12px] text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,.75)] hover:bg-white/80">
              <MapPin size={17} strokeWidth={1.5} className="text-slate-800" />
              Your Outlet: <span className="text-[14px] text-slate-900">{area}</span>
            </button>
            {outletPop.open && (
              <div className={clsx(popCls, 'w-72')}>
                {outlets.map((o) => (
                  <button key={o.id} onClick={() => { setOutlet(o.id); outletPop.setOpen(false); }}
                    className={clsx('flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-white/70', o.id === outlet.id && 'bg-white/70')}>
                    <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', o.id === outlet.id ? 'bg-brand-600' : 'bg-black/15')} />
                    <span><span className="block text-sm text-slate-900">{o.name}</span><span className="block text-xs text-slate-500">{o.address}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div ref={menuPop.ref} className="relative">
            <button title="Settings & apps" onClick={() => menuPop.setOpen(!menuPop.open)} className={squareCls(menuPop.open || inAdmin)}>
              <Settings size={18} strokeWidth={1.5} />
            </button>
            {menuPop.open && (
              <div className={clsx(popCls, 'w-64')} onClick={() => menuPop.setOpen(false)}>
                <div className="px-3 pb-2 pt-2">
                  <div className="text-sm text-slate-900">{staff?.name}</div>
                  <div className="text-xs capitalize text-slate-500">{staff?.role} · {area}</div>
                </div>
                {admin.items.map((i) => (
                  <Link key={i.to} to={i.to} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-800 hover:bg-white/70">{i.icon}{i.label}</Link>
                ))}
                <div className="mx-3 my-1.5 border-t border-black/[.06]" />
                <div className="px-3 pb-1 pt-1 text-[11px] text-slate-500">Device screens</div>
                {DEVICES.map((d) => (
                  <a key={d.to} href={`#${d.to}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-800 hover:bg-white/70">{d.icon}{d.label}</a>
                ))}
                <div className="mx-3 my-1.5 border-t border-black/[.06]" />
                <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-800 hover:bg-white/70">
                  <LogOut size={18} strokeWidth={1.5} /> Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="no-scrollbar flex shrink-0 gap-2.5 overflow-x-auto px-4 pt-4 sm:px-7 md:flex-col md:overflow-visible md:pt-9">
          <button title="Back" onClick={() => navigate(-1)} className={squareCls()}>
            <ArrowLeft size={18} strokeWidth={1.5} />
          </button>
          <div className="hidden h-20 md:block" />
          {rail.items.map((it) => <RailButton key={it.to} item={it} />)}
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden pt-4 md:pl-5 md:pt-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
