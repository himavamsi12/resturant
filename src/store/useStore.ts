import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AddonGroup, Area, Campaign, CartItem, Category, Coupon, Customer, Expense, Feedback, Integration, Kot,
  KotStatus, MenuItem, OnlineOrder, OnlineOrderStatus, Order, Outlet, Payment, PurchaseOrder, RawMaterial,
  Recipe, Reservation, Settings, Shift, Staff, Station, StockLog, StockTransfer, Table, Vendor,
} from '../types';
import * as seed from '../data/seed';
import { computeTotals, startOfDay, uid } from '../lib/billing';

export interface Toast { id: string; message: string; type: 'success' | 'error' | 'info' }

interface Data {
  outlets: Outlet[];
  outletId: string;
  currentStaffId?: string;
  settings: Settings;
  categories: Category[];
  menuItems: MenuItem[];
  addonGroups: AddonGroup[];
  areas: Area[];
  tables: Table[];
  stations: Station[];
  orders: Order[];
  kots: Kot[];
  onlineOrders: OnlineOrder[];
  rawMaterials: RawMaterial[];
  recipes: Recipe[];
  stockLogs: StockLog[];
  vendors: Vendor[];
  purchaseOrders: PurchaseOrder[];
  transfers: StockTransfer[];
  customers: Customer[];
  feedbacks: Feedback[];
  campaigns: Campaign[];
  coupons: Coupon[];
  staff: Staff[];
  reservations: Reservation[];
  expenses: Expense[];
  shifts: Shift[];
  integrations: Integration[];
  counters: { bill: number; kot: number; po: number; token: number; tokenDay: number };
}

interface Actions {
  toasts: Toast[];
  toast: (message: string, type?: Toast['type']) => void;
  dismissToast: (id: string) => void;

  login: (pin: string) => boolean;
  logout: () => void;
  setOutlet: (id: string) => void;
  updateSettings: (p: Partial<Settings>) => void;
  resetDemo: () => void;

  upsertCategory: (c: Category) => void;
  deleteCategory: (id: string) => void;
  upsertItem: (m: MenuItem) => void;
  deleteItem: (id: string) => void;
  toggleItemAvailable: (id: string) => void;
  toggleItemOnline: (id: string, p: 'swiggy' | 'zomato' | 'website') => void;
  bulkPriceUpdate: (percent: number, categoryId?: string) => void;
  upsertAddonGroup: (g: AddonGroup) => void;
  deleteAddonGroup: (id: string) => void;

  upsertArea: (a: Area) => void;
  deleteArea: (id: string) => void;
  upsertTable: (t: Table) => void;
  deleteTable: (id: string) => void;
  moveTable: (fromId: string, toId: string) => void;
  mergeTables: (targetId: string, sourceId: string) => void;
  upsertStation: (s: Station) => void;

  createOrder: (o: Partial<Order> & Pick<Order, 'orderType' | 'platform'>) => string;
  updateOrder: (id: string, patch: Partial<Order>) => void;
  sendKot: (orderId: string) => number;
  printBill: (orderId: string) => void;
  settleOrder: (orderId: string, payments: Payment[]) => void;
  cancelOrder: (orderId: string, reason: string) => void;
  splitOrder: (orderId: string, lineIds: string[]) => string | undefined;
  setKotStatus: (id: string, s: KotStatus) => void;

  addOnlineOrder: (o?: Partial<OnlineOrder>) => void;
  setOnlineStatus: (id: string, s: OnlineOrderStatus, extra?: Partial<OnlineOrder>) => void;
  toggleStore: (p: 'swiggy' | 'zomato' | 'website') => void;

  upsertRawMaterial: (r: RawMaterial) => void;
  deleteRawMaterial: (id: string) => void;
  adjustStock: (id: string, change: number, reason: StockLog['reason'], note?: string) => void;
  upsertRecipe: (r: Recipe) => void;
  createTransfer: (t: Omit<StockTransfer, 'id' | 'createdAt' | 'status'>) => void;
  setTransferStatus: (id: string, s: StockTransfer['status']) => void;

  upsertVendor: (v: Vendor) => void;
  deleteVendor: (id: string) => void;
  createPO: (vendorId: string, items: PurchaseOrder['items'], status?: PurchaseOrder['status']) => void;
  setPOStatus: (id: string, s: PurchaseOrder['status'], invoiceNo?: string) => void;
  markPOPaid: (id: string) => void;

  upsertCustomer: (c: Customer) => void;
  deleteCustomer: (id: string) => void;
  findOrCreateCustomer: (phone: string, name?: string) => string;
  addFeedback: (f: Omit<Feedback, 'id' | 'at' | 'resolved'>) => void;
  resolveFeedback: (id: string) => void;
  upsertCampaign: (c: Campaign) => void;
  sendCampaign: (id: string) => void;
  upsertCoupon: (c: Coupon) => void;
  deleteCoupon: (id: string) => void;

  upsertStaff: (s: Staff) => void;
  upsertReservation: (r: Reservation) => void;
  addExpense: (e: Omit<Expense, 'id' | 'at'>) => void;
  deleteExpense: (id: string) => void;
  openShift: (openingCash: number) => void;
  closeShift: (closingCash: number) => void;
  toggleIntegration: (id: string) => void;
}

export type Store = Data & Actions;

function initialData(): Data {
  const orders = seed.generateHistory();
  return {
    outlets: seed.outlets,
    outletId: 'o1',
    currentStaffId: undefined,
    settings: seed.defaultSettings,
    categories: seed.categories,
    menuItems: seed.menuItems,
    addonGroups: seed.addonGroups,
    areas: seed.areas,
    tables: seed.tables,
    stations: seed.stations,
    orders,
    kots: [],
    onlineOrders: seed.seedOnlineOrders(),
    rawMaterials: seed.rawMaterials,
    recipes: seed.recipes,
    stockLogs: [],
    vendors: seed.vendors,
    purchaseOrders: seed.purchaseOrders,
    transfers: seed.transfers,
    customers: seed.customers,
    feedbacks: seed.feedbacks,
    campaigns: seed.campaigns,
    coupons: seed.coupons,
    staff: seed.staff,
    reservations: seed.reservations,
    expenses: seed.expenses,
    shifts: [],
    integrations: seed.integrations,
    counters: { bill: (orders.at(-1)?.billNo || 1000) + 1, kot: 1, po: 503, token: 1, tokenDay: startOfDay() },
  };
}

const upsert = <T extends { id: string }>(arr: T[], item: T) =>
  arr.some((x) => x.id === item.id) ? arr.map((x) => (x.id === item.id ? item : x)) : [...arr, item];

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      /** Recalculate an order's totals using its area's service charge. */
      const withTotals = (o: Order): Order => {
        const s = get();
        const sc = o.orderType === 'dine-in' ? s.areas.find((a) => a.id === o.areaId)?.serviceCharge || 0 : 0;
        return { ...o, ...computeTotals(o, sc, s.settings.roundOff) };
      };

      const deductInventory = (items: { itemId: string; qty: number }[], note: string) => {
        const { recipes } = get();
        const changes: Record<string, number> = {};
        items.forEach((l) => {
          recipes.find((r) => r.itemId === l.itemId)?.ingredients.forEach((ing) => {
            changes[ing.rawMaterialId] = (changes[ing.rawMaterialId] || 0) + ing.qty * l.qty;
          });
        });
        const ids = Object.keys(changes);
        if (!ids.length) return;
        set((s) => ({
          rawMaterials: s.rawMaterials.map((r) => (changes[r.id] ? { ...r, stock: +(r.stock - changes[r.id]).toFixed(3) } : r)),
          stockLogs: [...ids.map((id) => ({ id: uid('sl'), rawMaterialId: id, change: -changes[id], reason: 'sale' as const, note, at: Date.now() })), ...s.stockLogs].slice(0, 2000),
        }));
      };

      const nextToken = () => {
        const s = get();
        const today = startOfDay();
        const token = s.counters.tokenDay === today ? s.counters.token : 1;
        set({ counters: { ...s.counters, token: token + 1, tokenDay: today } });
        return token;
      };

      return {
        ...initialData(),
        toasts: [],
        toast: (message, type = 'success') => {
          const id = uid();
          set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
          setTimeout(() => get().dismissToast(id), 3200);
        },
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

        login: (pin) => {
          const st = get().staff.find((x) => x.pin === pin && x.active);
          if (st) set({ currentStaffId: st.id });
          return !!st;
        },
        logout: () => set({ currentStaffId: undefined }),
        setOutlet: (id) => set({ outletId: id }),
        updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
        resetDemo: () => set({ ...initialData(), currentStaffId: get().currentStaffId }),

        upsertCategory: (c) => set((s) => ({ categories: upsert(s.categories, c) })),
        deleteCategory: (id) => set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),
        upsertItem: (m) => set((s) => ({ menuItems: upsert(s.menuItems, m) })),
        deleteItem: (id) => set((s) => ({ menuItems: s.menuItems.filter((m) => m.id !== id) })),
        toggleItemAvailable: (id) => set((s) => ({ menuItems: s.menuItems.map((m) => (m.id === id ? { ...m, available: !m.available } : m)) })),
        toggleItemOnline: (id, p) => set((s) => ({
          menuItems: s.menuItems.map((m) => (m.id === id ? { ...m, onlineAvailable: { ...m.onlineAvailable, [p]: !m.onlineAvailable[p] } } : m)),
        })),
        bulkPriceUpdate: (percent, categoryId) => set((s) => ({
          menuItems: s.menuItems.map((m) => (!categoryId || m.categoryId === categoryId
            ? {
                ...m,
                price: Math.round(m.price * (1 + percent / 100)),
                onlinePrice: m.onlinePrice ? Math.round(m.onlinePrice * (1 + percent / 100)) : undefined,
                variations: m.variations.map((v) => ({ ...v, price: Math.round(v.price * (1 + percent / 100)) })),
              }
            : m)),
        })),
        upsertAddonGroup: (g) => set((s) => ({ addonGroups: upsert(s.addonGroups, g) })),
        deleteAddonGroup: (id) => set((s) => ({ addonGroups: s.addonGroups.filter((g) => g.id !== id) })),

        upsertArea: (a) => set((s) => ({ areas: upsert(s.areas, a) })),
        deleteArea: (id) => set((s) => ({ areas: s.areas.filter((a) => a.id !== id), tables: s.tables.filter((t) => t.areaId !== id) })),
        upsertTable: (t) => set((s) => ({ tables: upsert(s.tables, t) })),
        deleteTable: (id) => set((s) => ({ tables: s.tables.filter((t) => t.id !== id) })),
        moveTable: (fromId, toId) => {
          const s = get();
          const from = s.tables.find((t) => t.id === fromId);
          const to = s.tables.find((t) => t.id === toId);
          if (!from?.orderId || !to || to.orderId) return;
          set({
            tables: s.tables.map((t) => (t.id === fromId ? { ...t, status: 'blank', orderId: undefined } : t.id === toId ? { ...t, status: from.status, orderId: from.orderId } : t)),
            orders: s.orders.map((o) => (o.id === from.orderId ? withTotals({ ...o, tableId: toId, areaId: to.areaId }) : o)),
          });
          get().toast(`Moved ${from.name} → ${to.name}`);
        },
        mergeTables: (targetId, sourceId) => {
          const s = get();
          const target = s.tables.find((t) => t.id === targetId);
          const source = s.tables.find((t) => t.id === sourceId);
          if (!target?.orderId || !source?.orderId || targetId === sourceId) return;
          const src = s.orders.find((o) => o.id === source.orderId)!;
          set({
            orders: s.orders
              .map((o) => (o.id === target.orderId ? withTotals({ ...o, items: [...o.items, ...src.items], pax: (o.pax || 0) + (src.pax || 0) }) : o))
              .filter((o) => o.id !== src.id),
            tables: s.tables.map((t) => (t.id === sourceId ? { ...t, status: 'blank', orderId: undefined } : t.id === targetId ? { ...t, mergedWith: [...(t.mergedWith || []), source.name] } : t)),
          });
          get().toast(`Merged ${source.name} into ${target.name}`);
        },
        upsertStation: (st) => set((s) => ({ stations: upsert(s.stations, st) })),

        createOrder: (partial) => {
          const id = uid('ord');
          const o: Order = withTotals({
            id, items: [], subtotal: 0, discountAmount: 0, serviceCharge: 0, tax: 0, roundOff: 0, total: 0,
            status: 'open', payments: [], createdAt: Date.now(), staffId: get().currentStaffId,
            packagingCharge: partial.orderType === 'takeaway' || partial.orderType === 'delivery' ? get().settings.packagingCharge : 0,
            deliveryCharge: partial.orderType === 'delivery' ? get().settings.deliveryCharge : 0,
            tokenNo: partial.orderType !== 'dine-in' ? nextToken() : undefined,
            ...partial,
          } as Order);
          set((s) => ({
            orders: [...s.orders, o],
            tables: o.tableId ? s.tables.map((t) => (t.id === o.tableId ? { ...t, status: 'running', orderId: id } : t)) : s.tables,
          }));
          return id;
        },
        updateOrder: (id, patch) => set((s) => ({ orders: s.orders.map((o) => (o.id === id ? withTotals({ ...o, ...patch }) : o)) })),

        sendKot: (orderId) => {
          const s = get();
          const o = s.orders.find((x) => x.id === orderId);
          if (!o) return 0;
          const pending = o.items.filter((l) => l.qty > l.kotSent);
          if (!pending.length) return 0;
          const byStation: Record<string, CartItem[]> = {};
          pending.forEach((l) => { (byStation[l.station] ||= []).push(l); });
          let kotNo = s.counters.kot;
          const table = s.tables.find((t) => t.id === o.tableId);
          const newKots: Kot[] = Object.entries(byStation).map(([station, lines]) => ({
            id: uid('kot'), kotNo: kotNo++, orderId, station, orderType: o.orderType, platform: o.platform,
            tableName: table?.name || (o.tokenNo ? `Token #${o.tokenNo}` : undefined),
            items: lines.map((l) => ({ name: l.name, qty: l.qty - l.kotSent, variation: l.variation, addons: l.addons.map((a) => a.name), note: l.note })),
            status: 'new', createdAt: Date.now(), updatedAt: Date.now(),
          }));
          set({
            kots: [...s.kots, ...newKots],
            counters: { ...s.counters, kot: kotNo },
            orders: s.orders.map((x) => (x.id === orderId ? { ...x, items: x.items.map((l) => ({ ...l, kotSent: l.qty })) } : x)),
          });
          return newKots.length;
        },

        printBill: (orderId) => {
          const s = get();
          const o = s.orders.find((x) => x.id === orderId);
          if (!o) return;
          const billNo = o.billNo || s.counters.bill;
          set({
            orders: s.orders.map((x) => (x.id === orderId ? { ...x, billNo, status: 'billed' } : x)),
            counters: { ...s.counters, bill: o.billNo ? s.counters.bill : s.counters.bill + 1 },
            tables: s.tables.map((t) => (t.orderId === orderId ? { ...t, status: 'printed' } : t)),
          });
        },

        settleOrder: (orderId, payments) => {
          const s = get();
          let o = s.orders.find((x) => x.id === orderId);
          if (!o) return;
          if (!o.billNo) { get().printBill(orderId); o = get().orders.find((x) => x.id === orderId)!; }
          const st = get();
          deductInventory(o.items, `Bill #${o.billNo}`);
          const earn = Math.floor((o.total / 100) * st.settings.loyaltyEarnPercent);
          const dueAmt = payments.filter((p) => p.mode === 'due').reduce((a, p) => a + p.amount, 0);
          const walletAmt = payments.filter((p) => p.mode === 'wallet').reduce((a, p) => a + p.amount, 0);
          set({
            orders: get().orders.map((x) => (x.id === orderId ? { ...x, status: 'settled', payments, settledAt: Date.now() } : x)),
            tables: get().tables.map((t) => (t.orderId === orderId ? { ...t, status: 'blank', orderId: undefined, mergedWith: undefined } : t)),
            // Dine-in guests pay after eating, so their tickets are done; takeaway/online/kiosk orders are often
            // prepaid and must stay on the KDS & token board until the kitchen bumps them.
            kots: o.orderType === 'dine-in'
              ? get().kots.map((k) => (k.orderId === orderId && k.status !== 'cancelled' ? { ...k, status: 'served', updatedAt: Date.now() } : k))
              : get().kots,
            customers: o.customerId
              ? get().customers.map((c) => (c.id === o!.customerId
                  ? {
                      ...c, visits: c.visits + 1, totalSpent: c.totalSpent + o!.total, lastVisit: Date.now(),
                      points: c.points + earn - Math.round((o!.loyaltyRedeemed || 0) / st.settings.pointValue),
                      wallet: c.wallet + dueAmt - walletAmt,
                    }
                  : c))
              : get().customers,
          });
        },

        cancelOrder: (orderId, reason) => set((s) => ({
          orders: s.orders.map((o) => (o.id === orderId ? { ...o, status: 'cancelled', cancelReason: reason, settledAt: Date.now() } : o)),
          tables: s.tables.map((t) => (t.orderId === orderId ? { ...t, status: 'blank', orderId: undefined, mergedWith: undefined } : t)),
          kots: s.kots.map((k) => (k.orderId === orderId && k.status !== 'served' ? { ...k, status: 'cancelled' } : k)),
        })),

        splitOrder: (orderId, lineIds) => {
          const s = get();
          const o = s.orders.find((x) => x.id === orderId);
          if (!o || !lineIds.length || lineIds.length === o.items.length) return;
          const moved = o.items.filter((l) => lineIds.includes(l.lineId));
          const id = uid('ord');
          const n: Order = withTotals({ ...o, id, billNo: undefined, status: 'open', items: moved, tableId: undefined, payments: [], createdAt: Date.now(), note: `Split from ${o.billNo ? '#' + o.billNo : 'order'}` });
          set({ orders: [...s.orders.map((x) => (x.id === orderId ? withTotals({ ...x, items: x.items.filter((l) => !lineIds.includes(l.lineId)) }) : x)), n] });
          return id;
        },

        setKotStatus: (id, st) => set((s) => ({ kots: s.kots.map((k) => (k.id === id ? { ...k, status: st, updatedAt: Date.now() } : k)) })),

        addOnlineOrder: (partial) => {
          const s = get();
          const platform = partial?.platform || (['swiggy', 'zomato', 'website'] as const)[Math.floor(Math.random() * 3)];
          const avail = s.menuItems.filter((m) => m.available && m.onlineAvailable[platform]);
          const n = 1 + Math.floor(Math.random() * 3);
          const items = Array.from({ length: n }, () => {
            const m = avail[Math.floor(Math.random() * avail.length)];
            return { itemId: m.id, name: m.name, qty: 1 + Math.floor(Math.random() * 2), price: m.onlinePrice || m.price };
          });
          const subtotal = items.reduce((a, x) => a + x.qty * x.price, 0);
          const tax = Math.round(subtotal * 0.05);
          const c = s.customers[Math.floor(Math.random() * s.customers.length)];
          const o: OnlineOrder = {
            id: uid('on'), platform, platformOrderId: platform.slice(0, 3).toUpperCase() + Math.floor(1e7 + Math.random() * 9e7),
            customerName: c.name, customerPhone: c.phone, address: `${Math.floor(Math.random() * 200)}, 4th Block, Bengaluru`,
            items, subtotal, packaging: s.settings.packagingCharge, tax, total: subtotal + tax + s.settings.packagingCharge,
            commission: platform === 'website' ? 0 : platform === 'swiggy' ? 22 : 20, status: 'placed',
            prepTime: s.settings.defaultPrepTime, createdAt: Date.now(), paymentType: Math.random() < 0.8 ? 'prepaid' : 'cod',
            instructions: Math.random() < 0.4 ? 'Less spicy please' : undefined,
            ...partial,
          };
          set({ onlineOrders: [o, ...s.onlineOrders] });
          if (s.settings.autoAcceptOnline) get().setOnlineStatus(o.id, 'accepted');
        },

        setOnlineStatus: (id, status, extra) => {
          const s = get();
          const oo = s.onlineOrders.find((x) => x.id === id);
          if (!oo) return;
          let posOrderId = oo.posOrderId;
          if (status === 'accepted' && !posOrderId) {
            posOrderId = get().createOrder({
              orderType: 'online', platform: oo.platform, packagingCharge: oo.packaging,
              customerId: s.customers.find((c) => c.phone === oo.customerPhone)?.id,
              note: `${oo.platform.toUpperCase()} ${oo.platformOrderId}`,
              items: oo.items.map((l) => {
                const m = s.menuItems.find((x) => x.id === l.itemId);
                return { lineId: uid('l'), itemId: l.itemId, name: l.name, qty: l.qty, unitPrice: l.price, addons: [], kotSent: 0, taxGroup: m?.taxGroup || 'GST5', station: m?.station || 'st-main' };
              }),
            });
            get().sendKot(posOrderId);
          }
          if (status === 'delivered' && posOrderId) get().settleOrder(posOrderId, [{ mode: 'online', amount: get().orders.find((o) => o.id === posOrderId)?.total || oo.total }]);
          if ((status === 'rejected' || status === 'cancelled') && posOrderId) get().cancelOrder(posOrderId, `Online order ${status}`);
          if (status === 'ready' && !oo.rider) {
            extra = { ...extra, rider: { name: ['Ramesh', 'Imran', 'Deepak', 'Kiran'][Math.floor(Math.random() * 4)], phone: '90000' + Math.floor(10000 + Math.random() * 89999), provider: oo.platform === 'website' ? 'Dunzo' : oo.platform } };
          }
          set((st) => ({ onlineOrders: st.onlineOrders.map((x) => (x.id === id ? { ...x, status, posOrderId, ...extra } : x)) }));
        },
        toggleStore: (p) => set((s) => ({ settings: { ...s.settings, storeOnline: { ...s.settings.storeOnline, [p]: !s.settings.storeOnline[p] } } })),

        upsertRawMaterial: (r) => set((s) => ({ rawMaterials: upsert(s.rawMaterials, r) })),
        deleteRawMaterial: (id) => set((s) => ({ rawMaterials: s.rawMaterials.filter((r) => r.id !== id) })),
        adjustStock: (id, change, reason, note) => set((s) => ({
          rawMaterials: s.rawMaterials.map((r) => (r.id === id ? { ...r, stock: +(r.stock + change).toFixed(3) } : r)),
          stockLogs: [{ id: uid('sl'), rawMaterialId: id, change, reason, note, at: Date.now() }, ...s.stockLogs],
        })),
        upsertRecipe: (r) => set((s) => ({ recipes: [...s.recipes.filter((x) => x.itemId !== r.itemId), r] })),
        createTransfer: (t) => set((s) => ({ transfers: [{ ...t, id: uid('tr'), status: 'requested', createdAt: Date.now() }, ...s.transfers] })),
        setTransferStatus: (id, st) => {
          const t = get().transfers.find((x) => x.id === id);
          if (!t) return;
          const here = get().outletId;
          if (st === 'received' && t.toOutletId === here) t.items.forEach((i) => get().adjustStock(i.rawMaterialId, i.qty, 'transfer-in', `Transfer from ${t.fromOutletId}`));
          if (st === 'dispatched' && t.fromOutletId === here) t.items.forEach((i) => get().adjustStock(i.rawMaterialId, -i.qty, 'transfer-out', `Transfer to ${t.toOutletId}`));
          set((s) => ({ transfers: s.transfers.map((x) => (x.id === id ? { ...x, status: st } : x)) }));
        },

        upsertVendor: (v) => set((s) => ({ vendors: upsert(s.vendors, v) })),
        deleteVendor: (id) => set((s) => ({ vendors: s.vendors.filter((v) => v.id !== id) })),
        createPO: (vendorId, items, status = 'sent') => set((s) => ({
          purchaseOrders: [{ id: uid('po'), poNo: s.counters.po, vendorId, items, status, createdAt: Date.now(), total: items.reduce((a, i) => a + i.qty * i.rate, 0), paid: false }, ...s.purchaseOrders],
          counters: { ...s.counters, po: s.counters.po + 1 },
        })),
        setPOStatus: (id, st, invoiceNo) => {
          const po = get().purchaseOrders.find((p) => p.id === id);
          if (!po) return;
          if (st === 'received' && po.status !== 'received') po.items.forEach((i) => get().adjustStock(i.rawMaterialId, i.qty, 'purchase', `PO #${po.poNo}`));
          set((s) => ({ purchaseOrders: s.purchaseOrders.map((p) => (p.id === id ? { ...p, status: st, invoiceNo: invoiceNo ?? p.invoiceNo, receivedAt: st === 'received' ? Date.now() : p.receivedAt } : p)) }));
        },
        markPOPaid: (id) => set((s) => ({ purchaseOrders: s.purchaseOrders.map((p) => (p.id === id ? { ...p, paid: true } : p)) })),

        upsertCustomer: (c) => set((s) => ({ customers: upsert(s.customers, c) })),
        deleteCustomer: (id) => set((s) => ({ customers: s.customers.filter((c) => c.id !== id) })),
        findOrCreateCustomer: (phone, name) => {
          const ex = get().customers.find((c) => c.phone === phone);
          if (ex) return ex.id;
          const c: Customer = { id: uid('cu'), name: name || 'Guest', phone, labels: ['New'], points: 0, wallet: 0, visits: 0, totalSpent: 0, createdAt: Date.now() };
          set((s) => ({ customers: [...s.customers, c] }));
          return c.id;
        },
        addFeedback: (f) => set((s) => ({ feedbacks: [{ ...f, id: uid('fb'), at: Date.now(), resolved: f.rating >= 3 }, ...s.feedbacks] })),
        resolveFeedback: (id) => set((s) => ({ feedbacks: s.feedbacks.map((f) => (f.id === id ? { ...f, resolved: true } : f)) })),
        upsertCampaign: (c) => set((s) => ({ campaigns: upsert(s.campaigns, c) })),
        sendCampaign: (id) => set((s) => {
          const c = s.campaigns.find((x) => x.id === id)!;
          const count = s.customers.filter((cu) => !cu.dndPromo && (c.audienceLabel === 'all' || cu.labels.includes(c.audienceLabel))).length;
          return { campaigns: s.campaigns.map((x) => (x.id === id ? { ...x, status: 'sent', sentCount: count } : x)) };
        }),
        upsertCoupon: (c) => set((s) => ({ coupons: upsert(s.coupons, c) })),
        deleteCoupon: (id) => set((s) => ({ coupons: s.coupons.filter((c) => c.id !== id) })),

        upsertStaff: (st) => set((s) => ({ staff: upsert(s.staff, st) })),
        upsertReservation: (r) => set((s) => ({
          reservations: upsert(s.reservations, r),
          tables: r.tableId && r.status === 'booked'
            ? s.tables.map((t) => (t.id === r.tableId && t.status === 'blank' && r.at - Date.now() < 3 * 3600000 ? { ...t, status: 'reserved' } : t))
            : s.tables.map((t) => (t.id === r.tableId && t.status === 'reserved' ? { ...t, status: 'blank' } : t)),
        })),
        addExpense: (e) => set((s) => ({ expenses: [{ ...e, id: uid('ex'), at: Date.now() }, ...s.expenses] })),
        deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),
        openShift: (openingCash) => set((s) => ({ shifts: [{ id: uid('sh'), staffId: s.currentStaffId || 's1', openedAt: Date.now(), openingCash }, ...s.shifts] })),
        closeShift: (closingCash) => set((s) => ({ shifts: s.shifts.map((sh, i) => (i === 0 && !sh.closedAt ? { ...sh, closedAt: Date.now(), closingCash } : sh)) })),
        toggleIntegration: (id) => set((s) => ({ integrations: s.integrations.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i)) })),
      };
    },
    {
      name: 'dineflow-pos-v1',
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { toasts, ...rest } = s;
        return Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function')) as Partial<Store>;
      },
    },
  ),
);

/** Convenience selectors */
export const useCurrentStaff = () => useStore((s) => s.staff.find((x) => x.id === s.currentStaffId));
export const useOutlet = () => useStore((s) => s.outlets.find((o) => o.id === s.outletId)!);
