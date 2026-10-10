import type {
  AddonGroup, Area, Campaign, Category, Coupon, Customer, Expense, Feedback, Integration, MenuItem,
  OnlineOrder, Order, Outlet, PurchaseOrder, RawMaterial, Recipe, Reservation, Settings, Staff, Station,
  StockTransfer, Table, TaxConfig, Vendor,
} from '../types';
import { computeTotals } from '../lib/billing';

export const outlets: Outlet[] = [
  { id: 'o1', name: 'DineFlow – Koramangala', address: '80 Ft Road, Koramangala, Bengaluru', phone: '+91 98450 11111', gstin: '29ABCDE1234F1Z5', fssai: '11223344556677' },
  { id: 'o2', name: 'DineFlow – Indiranagar', address: '100 Ft Road, Indiranagar, Bengaluru', phone: '+91 98450 22222', gstin: '29ABCDE1234F2Z4', fssai: '11223344556678' },
  { id: 'ck', name: 'Central Kitchen – HSR', address: 'Sector 6, HSR Layout, Bengaluru', phone: '+91 98450 33333', gstin: '29ABCDE1234F3Z3', fssai: '11223344556679', isCentralKitchen: true },
];

export const stations: Station[] = [
  { id: 'st-main', name: 'Main Kitchen', printer: 'EPSON TM-T82 (192.168.1.21)' },
  { id: 'st-tandoor', name: 'Tandoor', printer: 'TVS RP3160 (192.168.1.22)' },
  { id: 'st-bar', name: 'Beverages & Bar', printer: 'EPSON TM-T82 (192.168.1.23)' },
  { id: 'st-dessert', name: 'Desserts', printer: 'Shared – Main Kitchen' },
];

export const taxes: TaxConfig[] = [
  { id: 'GST5', name: 'GST 5%', rate: 5 },
  { id: 'GST12', name: 'GST 12%', rate: 12 },
  { id: 'GST18', name: 'GST 18%', rate: 18 },
  { id: 'NONE', name: 'No Tax', rate: 0 },
];

export const categories: Category[] = [
  { id: 'c-starter', name: 'Starters', sortOrder: 1, active: true },
  { id: 'c-tandoor', name: 'Tandoor', sortOrder: 2, active: true },
  { id: 'c-main', name: 'Main Course', sortOrder: 3, active: true },
  { id: 'c-bread', name: 'Breads', sortOrder: 4, active: true },
  { id: 'c-rice', name: 'Rice & Biryani', sortOrder: 5, active: true },
  { id: 'c-pizza', name: 'Pizza', sortOrder: 6, active: true },
  { id: 'c-bev', name: 'Beverages', sortOrder: 7, active: true },
  { id: 'c-dessert', name: 'Desserts', sortOrder: 8, active: true },
];

export const addonGroups: AddonGroup[] = [
  { id: 'ag-dip', name: 'Extra Dips', min: 0, max: 3, items: [
    { id: 'a1', name: 'Mint Chutney', price: 20 }, { id: 'a2', name: 'Garlic Mayo', price: 30 }, { id: 'a3', name: 'Cheese Dip', price: 40 },
  ] },
  { id: 'ag-top', name: 'Pizza Toppings', min: 0, max: 5, items: [
    { id: 'a4', name: 'Extra Cheese', price: 60 }, { id: 'a5', name: 'Jalapeños', price: 40 }, { id: 'a6', name: 'Olives', price: 40 }, { id: 'a7', name: 'Paneer', price: 70 },
  ] },
  { id: 'ag-bev', name: 'Beverage Add-ons', min: 0, max: 2, items: [
    { id: 'a8', name: 'Extra Shot', price: 40 }, { id: 'a9', name: 'Ice Cream Scoop', price: 50 },
  ] },
];

type Seed = [string, string, string, number, boolean, string, string, MenuItem['taxGroup'], ([string, number][])?, string[]?];
const rawMenu: Seed[] = [
  ['Paneer Tikka', 'PT', 'c-tandoor', 280, true, 'st-tandoor', '🧀', 'GST5', undefined, ['ag-dip']],
  ['Chicken Tikka', 'CT', 'c-tandoor', 320, false, 'st-tandoor', '🍗', 'GST5', undefined, ['ag-dip']],
  ['Tandoori Chicken', 'TC', 'c-tandoor', 380, false, 'st-tandoor', '🍗', 'GST5', [['Half', 380], ['Full', 650]], ['ag-dip']],
  ['Hara Bhara Kebab', 'HBK', 'c-starter', 220, true, 'st-main', '🥬', 'GST5', undefined, ['ag-dip']],
  ['Chilli Paneer', 'CP', 'c-starter', 260, true, 'st-main', '🌶️', 'GST5', [['Dry', 260], ['Gravy', 280]]],
  ['Chicken 65', 'C65', 'c-starter', 300, false, 'st-main', '🍗', 'GST5'],
  ['Veg Spring Roll', 'VSR', 'c-starter', 190, true, 'st-main', '🥟', 'GST5', undefined, ['ag-dip']],
  ['French Fries', 'FF', 'c-starter', 150, true, 'st-main', '🍟', 'GST5', [['Regular', 150], ['Peri Peri', 180]], ['ag-dip']],
  ['Paneer Butter Masala', 'PBM', 'c-main', 290, true, 'st-main', '🍛', 'GST5', [['Half', 190], ['Full', 290]]],
  ['Dal Makhani', 'DM', 'c-main', 240, true, 'st-main', '🥘', 'GST5', [['Half', 160], ['Full', 240]]],
  ['Butter Chicken', 'BC', 'c-main', 360, false, 'st-main', '🍛', 'GST5', [['Half', 240], ['Full', 360]]],
  ['Kadai Paneer', 'KP', 'c-main', 280, true, 'st-main', '🥘', 'GST5'],
  ['Mutton Rogan Josh', 'MRJ', 'c-main', 420, false, 'st-main', '🍖', 'GST5'],
  ['Butter Naan', 'BN', 'c-bread', 60, true, 'st-tandoor', '🫓', 'GST5'],
  ['Garlic Naan', 'GN', 'c-bread', 75, true, 'st-tandoor', '🫓', 'GST5'],
  ['Tandoori Roti', 'TR', 'c-bread', 35, true, 'st-tandoor', '🫓', 'GST5'],
  ['Laccha Paratha', 'LP', 'c-bread', 70, true, 'st-tandoor', '🫓', 'GST5'],
  ['Veg Biryani', 'VB', 'c-rice', 250, true, 'st-main', '🍚', 'GST5'],
  ['Chicken Dum Biryani', 'CDB', 'c-rice', 320, false, 'st-main', '🍚', 'GST5', [['Regular', 320], ['Family Pack', 720]]],
  ['Jeera Rice', 'JR', 'c-rice', 160, true, 'st-main', '🍚', 'GST5'],
  ['Margherita Pizza', 'MP', 'c-pizza', 299, true, 'st-main', '🍕', 'GST5', [['Regular 8"', 299], ['Medium 10"', 449], ['Large 12"', 599]], ['ag-top']],
  ['Farmhouse Pizza', 'FP', 'c-pizza', 379, true, 'st-main', '🍕', 'GST5', [['Regular 8"', 379], ['Medium 10"', 529], ['Large 12"', 699]], ['ag-top']],
  ['Chicken Tikka Pizza', 'CTP', 'c-pizza', 429, false, 'st-main', '🍕', 'GST5', [['Regular 8"', 429], ['Medium 10"', 599], ['Large 12"', 779]], ['ag-top']],
  ['Masala Chai', 'MC', 'c-bev', 60, true, 'st-bar', '☕', 'GST5'],
  ['Cold Coffee', 'CC', 'c-bev', 160, true, 'st-bar', '🧋', 'GST5', undefined, ['ag-bev']],
  ['Fresh Lime Soda', 'FLS', 'c-bev', 110, true, 'st-bar', '🍋', 'GST5', [['Sweet', 110], ['Salted', 110], ['Mixed', 110]]],
  ['Mango Lassi', 'ML', 'c-bev', 140, true, 'st-bar', '🥭', 'GST5'],
  ['Mineral Water', 'MW', 'c-bev', 40, true, 'st-bar', '💧', 'GST18'],
  ['Gulab Jamun', 'GJ', 'c-dessert', 120, true, 'st-dessert', '🍮', 'GST5'],
  ['Sizzling Brownie', 'SB', 'c-dessert', 220, true, 'st-dessert', '🍫', 'GST5', undefined, ['ag-bev']],
  ['Kulfi Falooda', 'KF', 'c-dessert', 180, true, 'st-dessert', '🍨', 'GST5'],
];

export const menuItems: MenuItem[] = rawMenu.map(([name, code, cat, price, veg, station, emoji, tax, vars, addons], i) => ({
  id: `m${i + 1}`,
  name,
  shortCode: code,
  categoryId: cat,
  price,
  veg,
  station,
  image: emoji,
  taxGroup: tax,
  variations: (vars || []).map(([n, p], j) => ({ id: `m${i + 1}-v${j}`, name: n, price: p })),
  addonGroupIds: addons || [],
  available: true,
  onlineAvailable: { swiggy: true, zomato: true, website: true },
  areaPrices: {},
  onlinePrice: Math.round(price * 1.1),
  description: '',
}));

export const areas: Area[] = [
  { id: 'ar-ac', name: 'AC Dining', serviceCharge: 5 },
  { id: 'ar-garden', name: 'Garden', serviceCharge: 0 },
  { id: 'ar-roof', name: 'Rooftop', serviceCharge: 10 },
];
// rooftop has premium pricing
menuItems.forEach((m) => { m.areaPrices['ar-roof'] = Math.round(m.price * 1.15); });

export const tables: Table[] = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: `t-ac-${i + 1}`, name: `A${i + 1}`, areaId: 'ar-ac', seats: i % 3 === 0 ? 6 : 4, status: 'blank' as const })),
  ...Array.from({ length: 6 }, (_, i) => ({ id: `t-g-${i + 1}`, name: `G${i + 1}`, areaId: 'ar-garden', seats: 4, status: 'blank' as const })),
  ...Array.from({ length: 6 }, (_, i) => ({ id: `t-r-${i + 1}`, name: `R${i + 1}`, areaId: 'ar-roof', seats: i < 2 ? 2 : 4, status: 'blank' as const })),
];

export const rawMaterials: RawMaterial[] = [
  { id: 'r1', name: 'Paneer', unit: 'kg', stock: 18, minStock: 5, costPerUnit: 380, category: 'Dairy' },
  { id: 'r2', name: 'Chicken (boneless)', unit: 'kg', stock: 25, minStock: 8, costPerUnit: 290, category: 'Meat' },
  { id: 'r3', name: 'Chicken (with bone)', unit: 'kg', stock: 14, minStock: 6, costPerUnit: 210, category: 'Meat' },
  { id: 'r4', name: 'Mutton', unit: 'kg', stock: 4, minStock: 5, costPerUnit: 720, category: 'Meat' },
  { id: 'r5', name: 'Maida', unit: 'kg', stock: 40, minStock: 10, costPerUnit: 42, category: 'Grocery' },
  { id: 'r6', name: 'Atta', unit: 'kg', stock: 30, minStock: 10, costPerUnit: 38, category: 'Grocery' },
  { id: 'r7', name: 'Basmati Rice', unit: 'kg', stock: 50, minStock: 15, costPerUnit: 110, category: 'Grocery' },
  { id: 'r8', name: 'Butter', unit: 'kg', stock: 6, minStock: 3, costPerUnit: 520, category: 'Dairy' },
  { id: 'r9', name: 'Fresh Cream', unit: 'ltr', stock: 2, minStock: 4, costPerUnit: 240, category: 'Dairy' },
  { id: 'r10', name: 'Tomato', unit: 'kg', stock: 22, minStock: 8, costPerUnit: 30, category: 'Vegetables' },
  { id: 'r11', name: 'Onion', unit: 'kg', stock: 35, minStock: 10, costPerUnit: 28, category: 'Vegetables' },
  { id: 'r12', name: 'Mozzarella Cheese', unit: 'kg', stock: 7, minStock: 4, costPerUnit: 450, category: 'Dairy' },
  { id: 'r13', name: 'Milk', unit: 'ltr', stock: 30, minStock: 10, costPerUnit: 56, category: 'Dairy' },
  { id: 'r14', name: 'Coffee Powder', unit: 'kg', stock: 1.5, minStock: 1, costPerUnit: 900, category: 'Beverages' },
  { id: 'r15', name: 'Tea Leaves', unit: 'kg', stock: 3, minStock: 1, costPerUnit: 480, category: 'Beverages' },
  { id: 'r16', name: 'Potato', unit: 'kg', stock: 28, minStock: 10, costPerUnit: 25, category: 'Vegetables' },
  { id: 'r17', name: 'Black Urad Dal', unit: 'kg', stock: 12, minStock: 4, costPerUnit: 140, category: 'Grocery' },
  { id: 'r18', name: 'Refined Oil', unit: 'ltr', stock: 45, minStock: 15, costPerUnit: 135, category: 'Grocery' },
  { id: 'r19', name: 'Sugar', unit: 'kg', stock: 20, minStock: 5, costPerUnit: 44, category: 'Grocery' },
  { id: 'r20', name: 'Mango Pulp', unit: 'ltr', stock: 5, minStock: 2, costPerUnit: 190, category: 'Beverages' },
];

const ing = (pairs: [string, number][]) => pairs.map(([rawMaterialId, qty]) => ({ rawMaterialId, qty }));
export const recipes: Recipe[] = [
  { itemId: 'm1', ingredients: ing([['r1', 0.2], ['r18', 0.02], ['r11', 0.05]]) },
  { itemId: 'm2', ingredients: ing([['r2', 0.25], ['r18', 0.02]]) },
  { itemId: 'm3', ingredients: ing([['r3', 0.45], ['r18', 0.03]]) },
  { itemId: 'm5', ingredients: ing([['r1', 0.18], ['r11', 0.08], ['r18', 0.05]]) },
  { itemId: 'm6', ingredients: ing([['r2', 0.25], ['r18', 0.08]]) },
  { itemId: 'm8', ingredients: ing([['r16', 0.25], ['r18', 0.1]]) },
  { itemId: 'm9', ingredients: ing([['r1', 0.2], ['r8', 0.03], ['r9', 0.05], ['r10', 0.15]]) },
  { itemId: 'm10', ingredients: ing([['r17', 0.12], ['r8', 0.04], ['r9', 0.04]]) },
  { itemId: 'm11', ingredients: ing([['r2', 0.25], ['r8', 0.04], ['r9', 0.05], ['r10', 0.15]]) },
  { itemId: 'm13', ingredients: ing([['r4', 0.3], ['r11', 0.1]]) },
  { itemId: 'm14', ingredients: ing([['r5', 0.1], ['r8', 0.01]]) },
  { itemId: 'm15', ingredients: ing([['r5', 0.1], ['r8', 0.015]]) },
  { itemId: 'm16', ingredients: ing([['r6', 0.08]]) },
  { itemId: 'm18', ingredients: ing([['r7', 0.2], ['r11', 0.05]]) },
  { itemId: 'm19', ingredients: ing([['r7', 0.2], ['r3', 0.25], ['r11', 0.08]]) },
  { itemId: 'm21', ingredients: ing([['r5', 0.15], ['r12', 0.12], ['r10', 0.05]]) },
  { itemId: 'm22', ingredients: ing([['r5', 0.15], ['r12', 0.12], ['r11', 0.05]]) },
  { itemId: 'm24', ingredients: ing([['r13', 0.15], ['r15', 0.005], ['r19', 0.015]]) },
  { itemId: 'm25', ingredients: ing([['r13', 0.25], ['r14', 0.01], ['r19', 0.02]]) },
  { itemId: 'm27', ingredients: ing([['r20', 0.1], ['r13', 0.15], ['r19', 0.02]]) },
];

export const vendors: Vendor[] = [
  { id: 'v1', name: 'Sri Lakshmi Dairy', phone: '+91 99000 11223', type: 'local', gstin: '29AAAPL1234C1Z1', rates: { r1: 370, r8: 510, r9: 230, r12: 445, r13: 55 } },
  { id: 'v2', name: 'Fresh Meat Co.', phone: '+91 99000 44556', type: 'local', rates: { r2: 285, r3: 205, r4: 710 } },
  { id: 'v3', name: 'HyperPure (Marketplace)', phone: '1800-000-111', type: 'marketplace', rates: { r1: 365, r2: 295, r5: 40, r6: 37, r7: 105, r8: 515, r9: 235, r12: 430, r17: 135, r18: 130, r19: 43 } },
  { id: 'v4', name: 'DMart Wholesale (Marketplace)', phone: '1800-000-222', type: 'marketplace', rates: { r5: 39, r6: 36, r7: 108, r10: 28, r11: 26, r14: 880, r15: 470, r16: 24, r17: 138, r18: 128, r19: 42, r20: 185 } },
  { id: 'v5', name: 'Green Valley Vegetables', phone: '+91 99000 77889', type: 'local', rates: { r10: 27, r11: 27, r16: 23 } },
];

export const staff: Staff[] = [
  { id: 's1', name: 'Arjun Mehta', role: 'owner', pin: '1111', phone: '+91 90000 00001', active: true },
  { id: 's2', name: 'Priya Nair', role: 'manager', pin: '2222', phone: '+91 90000 00002', active: true },
  { id: 's3', name: 'Rahul Verma', role: 'cashier', pin: '3333', phone: '+91 90000 00003', active: true },
  { id: 's4', name: 'Suresh Kumar', role: 'captain', pin: '4444', phone: '+91 90000 00004', active: true },
  { id: 's5', name: 'Anita Das', role: 'captain', pin: '5555', phone: '+91 90000 00005', active: true },
  { id: 's6', name: 'Chef Iqbal', role: 'chef', pin: '6666', phone: '+91 90000 00006', active: true },
];

export const coupons: Coupon[] = [
  { id: 'cp1', code: 'WELCOME10', type: 'percent', value: 10, minOrder: 300, maxDiscount: 150, active: true, usage: 42 },
  { id: 'cp2', code: 'FLAT100', type: 'flat', value: 100, minOrder: 800, active: true, usage: 18 },
  { id: 'cp3', code: 'HAPPYHOUR', type: 'percent', value: 20, minOrder: 0, maxDiscount: 300, active: false, usage: 77 },
];

const LABELS = ['Regular', 'VIP', 'Corporate', 'Foodie', 'Family', 'Student', 'Online Only'];
const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Ishaan', 'Kavya', 'Ananya', 'Diya', 'Riya', 'Rohan', 'Karan', 'Meera', 'Sneha', 'Vikram', 'Neha', 'Siddharth', 'Pooja', 'Aman', 'Tanvi', 'Nikhil', 'Isha', 'Harsh', 'Divya', 'Manish', 'Shreya'];
const LAST = ['Sharma', 'Iyer', 'Reddy', 'Gupta', 'Patel', 'Singh', 'Rao', 'Joshi', 'Menon', 'Kapoor', 'Shetty', 'Bose'];

let seedN = 42;
export const rand = () => { seedN = (seedN * 16807) % 2147483647; return (seedN - 1) / 2147483646; };
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

const DAY = 86400000;
const now = Date.now();

export const customers: Customer[] = Array.from({ length: 48 }, (_, i) => {
  const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
  const month = String((i % 12) + 1).padStart(2, '0');
  const day = String((i * 3) % 28 + 1).padStart(2, '0');
  return {
    id: `cu${i + 1}`,
    name,
    phone: `98${String(10000000 + i * 137731).slice(0, 8)}`,
    email: `${name.split(' ')[0].toLowerCase()}${i}@mail.com`,
    birthday: `199${i % 10}-${month}-${day}`,
    labels: [pick(LABELS), ...(rand() > 0.7 ? [pick(LABELS)] : [])].filter((v, j, a) => a.indexOf(v) === j),
    points: 0,
    wallet: 0,
    visits: 0,
    totalSpent: 0,
    createdAt: now - Math.floor(rand() * 200) * DAY,
  };
});

/** Generate ~60 days (plus today so far) of historical settled orders so reports & dashboard have data. */
export function generateHistory(): Order[] {
  const orders: Order[] = [];
  let bill = 1001;
  for (let d = 60; d >= 0; d--) {
    const count = 22 + Math.floor(rand() * 20) + (new Date(now - d * DAY).getDay() % 6 === 0 ? 15 : 0);
    for (let k = 0; k < count; k++) {
      const hour = pick([12, 13, 13, 14, 14, 15, 17, 19, 20, 20, 21, 21, 22]);
      const created = new Date(now - d * DAY);
      created.setHours(hour, Math.floor(rand() * 60), 0, 0);
      if (created.getTime() > now - 45 * 60000) continue; // today: only orders that are already done
      const typeRoll = rand();
      const orderType = typeRoll < 0.5 ? 'dine-in' : typeRoll < 0.68 ? 'takeaway' : typeRoll < 0.78 ? 'delivery' : 'online';
      const platform = orderType === 'online' ? pick(['swiggy', 'zomato', 'zomato', 'website'] as const) : orderType === 'dine-in' && rand() < 0.3 ? 'captain' : 'pos';
      const n = 1 + Math.floor(rand() * 4);
      const items = Array.from({ length: n }, (_, j) => {
        const m = pick(menuItems);
        const v = m.variations.length ? pick(m.variations) : undefined;
        const qty = 1 + Math.floor(rand() * 2);
        return {
          lineId: `h${bill}-${j}`, itemId: m.id, name: m.name, qty, unitPrice: v ? v.price : m.price,
          variation: v?.name, addons: [], kotSent: qty, taxGroup: m.taxGroup, station: m.station,
        };
      });
      const cancelled = rand() < 0.02;
      const customer = rand() < 0.55 ? pick(customers) : undefined;
      const area = orderType === 'dine-in' ? pick(areas) : undefined;
      const discount = rand() < 0.15 ? { type: 'percent' as const, value: pick([5, 10, 15]), reason: 'Loyal customer' } : undefined;
      const base: Order = {
        id: `ord-h${bill}`, billNo: bill++, orderType, platform, items, customerId: customer?.id,
        areaId: area?.id, tableId: area ? pick(tables.filter((t) => t.areaId === area.id)).id : undefined,
        pax: orderType === 'dine-in' ? 1 + Math.floor(rand() * 5) : undefined,
        discount, subtotal: 0, discountAmount: 0, serviceCharge: 0, tax: 0, roundOff: 0, total: 0,
        status: cancelled ? 'cancelled' : 'settled', payments: [], createdAt: created.getTime(),
        settledAt: Math.min(now, created.getTime() + (20 + Math.floor(rand() * 50)) * 60000),
        staffId: pick(['s3', 's4', 's5', 's2']),
        cancelReason: cancelled ? pick(['Customer left', 'Wrong order', 'Delay in service']) : undefined,
        packagingCharge: orderType === 'online' || orderType === 'takeaway' ? 20 : 0,
        deliveryCharge: orderType === 'delivery' ? 40 : 0,
      };
      const t = computeTotals(base, area?.serviceCharge || 0, true);
      Object.assign(base, t);
      if (!cancelled) {
        const mode = orderType === 'online' ? 'online' : pick(['cash', 'upi', 'upi', 'card', 'card', 'upi'] as const);
        base.payments = [{ mode, amount: base.total }];
        if (customer) {
          customer.visits++;
          customer.totalSpent += base.total;
          customer.points += Math.floor(base.total / 100) * 5;
          customer.lastVisit = Math.max(customer.lastVisit || 0, base.createdAt);
        }
      }
      orders.push(base);
    }
  }
  return orders;
}

export const feedbacks: Feedback[] = Array.from({ length: 18 }, (_, i) => {
  const c = customers[(i * 5) % customers.length];
  const r = [5, 4, 5, 3, 4, 5, 2, 4, 5, 5, 4, 3, 5, 1, 4, 5, 4, 5][i];
  return {
    id: `fb${i + 1}`, customerId: c.id, customerName: c.name, rating: r,
    food: Math.min(5, r + (i % 2)), service: Math.max(1, r - (i % 3 === 0 ? 1 : 0)), ambience: r,
    comment: [
      'Loved the paneer tikka, will come again!', 'Service was quick and friendly.', 'Amazing biryani 😍',
      'Food was okay, a bit too spicy.', 'Great ambience on the rooftop.', 'Best butter chicken in town.',
      'Waited 40 mins for main course.', 'Good food, slightly pricey.', 'Staff was very courteous.',
      'Perfect place for family dinner.', 'Naan was a little cold.', 'Average experience overall.',
      'Desserts are a must try!', 'Order was wrong and no one apologised.', 'Nice music and vibes.',
      'Pizza crust was perfect.', 'Will recommend to friends.', 'Excellent hospitality!',
    ][i],
    at: now - i * DAY * 1.3, resolved: r >= 3 || i % 2 === 0,
  };
});

export const campaigns: Campaign[] = [
  { id: 'cmp1', name: 'Diwali Feast 20% Off', type: 'festival', channel: 'sms', message: 'Celebrate Diwali at DineFlow! Flat 20% off on dine-in. Use code DIWALI20. T&C apply.', audienceLabel: 'all', status: 'sent', sentCount: 48, createdAt: now - 12 * DAY },
  { id: 'cmp2', name: 'Birthday Treat', type: 'birthday', channel: 'sms', message: 'Happy Birthday {name}! 🎂 Enjoy a free dessert on your visit this week.', audienceLabel: 'all', status: 'scheduled', sentCount: 0, createdAt: now - 3 * DAY },
  { id: 'cmp3', name: 'We miss you', type: 'win-back', channel: 'whatsapp', message: 'Hi {name}, it’s been a while! Here’s ₹150 off on your next order: MISSYOU150', audienceLabel: 'Regular', status: 'draft', sentCount: 0, createdAt: now - DAY },
];

export const reservations: Reservation[] = [
  { id: 'rs1', customerName: 'Kavya Reddy', phone: '9876500011', pax: 4, at: now + 2 * 3600000, tableId: 't-ac-3', status: 'booked', note: 'Window seat' },
  { id: 'rs2', customerName: 'Vikram Rao', phone: '9876500022', pax: 8, at: now + 4 * 3600000, status: 'booked', note: 'Birthday – cake at 9pm' },
  { id: 'rs3', customerName: 'Sneha Iyer', phone: '9876500033', pax: 2, at: now + DAY, tableId: 't-r-1', status: 'booked' },
];

export const expenses: Expense[] = [
  { id: 'ex1', category: 'Utilities', amount: 4200, note: 'Electricity bill – partial', mode: 'upi', at: now - 2 * DAY },
  { id: 'ex2', category: 'Petty Cash', amount: 650, note: 'Cleaning supplies', mode: 'cash', at: now - DAY },
  { id: 'ex3', category: 'Maintenance', amount: 1800, note: 'AC servicing', mode: 'cash', at: now - 5 * DAY },
];

export const purchaseOrders: PurchaseOrder[] = [
  { id: 'po1', poNo: 501, vendorId: 'v1', items: [{ rawMaterialId: 'r1', qty: 10, rate: 370 }, { rawMaterialId: 'r9', qty: 5, rate: 230 }], status: 'received', createdAt: now - 6 * DAY, receivedAt: now - 5 * DAY, total: 4850, paid: true, invoiceNo: 'SLD/2245' },
  { id: 'po2', poNo: 502, vendorId: 'v2', items: [{ rawMaterialId: 'r4', qty: 8, rate: 710 }], status: 'sent', createdAt: now - DAY, total: 5680, paid: false },
];

export const transfers: StockTransfer[] = [
  { id: 'tr1', fromOutletId: 'ck', toOutletId: 'o1', items: [{ rawMaterialId: 'r9', qty: 3 }, { rawMaterialId: 'r8', qty: 2 }], status: 'requested', createdAt: now - 3600000 * 5 },
  { id: 'tr2', fromOutletId: 'ck', toOutletId: 'o2', items: [{ rawMaterialId: 'r1', qty: 5 }], status: 'received', createdAt: now - 2 * DAY },
];

export const integrations: Integration[] = [
  { id: 'i1', name: 'Swiggy', category: 'Aggregators', description: 'Receive Swiggy orders directly in POS', connected: true, icon: '🛵' },
  { id: 'i2', name: 'Zomato', category: 'Aggregators', description: 'Receive Zomato orders directly in POS', connected: true, icon: '🍴' },
  { id: 'i3', name: 'Magicpin', category: 'Aggregators', description: 'Sync menu & orders with Magicpin', connected: false, icon: '📍' },
  { id: 'i4', name: 'ONDC', category: 'Aggregators', description: 'Open Network for Digital Commerce', connected: false, icon: '🌐' },
  { id: 'i5', name: 'Razorpay', category: 'Payments', description: 'Online payments for website orders', connected: true, icon: '💳' },
  { id: 'i6', name: 'Paytm EDC', category: 'Payments', description: 'Card machine integration', connected: false, icon: '🏧' },
  { id: 'i7', name: 'PhonePe Dynamic QR', category: 'Payments', description: 'Auto-reconciled UPI QR on bill', connected: true, icon: '📱' },
  { id: 'i8', name: 'Shadowfax', category: 'Delivery', description: 'On-demand rider pickup', connected: false, icon: '🏍️' },
  { id: 'i9', name: 'Dunzo', category: 'Delivery', description: 'Hyperlocal delivery partner', connected: true, icon: '📦' },
  { id: 'i10', name: 'Pidge', category: 'Delivery', description: 'Delivery fleet for restaurants', connected: false, icon: '🚚' },
  { id: 'i11', name: 'Tally ERP', category: 'Accounting', description: 'Push sales & purchase vouchers', connected: false, icon: '📒' },
  { id: 'i12', name: 'Zoho Books', category: 'Accounting', description: 'Accounting sync', connected: false, icon: '📘' },
  { id: 'i13', name: 'Reelo', category: 'CRM & Loyalty', description: 'Loyalty & feedback automation', connected: false, icon: '🎁' },
  { id: 'i14', name: 'WhatsApp Business', category: 'CRM & Loyalty', description: 'Send e-bills & campaigns on WhatsApp', connected: true, icon: '💬' },
  { id: 'i15', name: 'Google Business', category: 'Marketing', description: 'Sync menu to Google profile', connected: false, icon: '🔎' },
  { id: 'i16', name: 'EasyDiner', category: 'Reservations', description: 'Table reservation sync', connected: false, icon: '📅' },
  { id: 'i17', name: 'HyperPure', category: 'Procurement', description: 'Order raw materials at best prices', connected: true, icon: '🥬' },
  { id: 'i18', name: 'Tally Prime', category: 'Accounting', description: 'GST-ready accounting export', connected: false, icon: '🧾' },
];

export function seedOnlineOrders(): OnlineOrder[] {
  const mk = (i: number, platform: OnlineOrder['platform'], status: OnlineOrder['status'], minsAgo: number): OnlineOrder => {
    const its = [menuItems[(i * 3) % menuItems.length], menuItems[(i * 5 + 2) % menuItems.length]].map((m, j) => ({ itemId: m.id, name: m.name, qty: 1 + ((i + j) % 2), price: m.onlinePrice || m.price }));
    const subtotal = its.reduce((s, x) => s + x.qty * x.price, 0);
    const tax = Math.round(subtotal * 0.05);
    const c = customers[i * 3];
    return {
      id: `on${i}`, platform, platformOrderId: `${platform.slice(0, 3).toUpperCase()}${8812340 + i * 17}`,
      customerName: c.name, customerPhone: c.phone, address: `${12 + i}, ${pick(['5th Cross', '2nd Main', 'MG Road', 'Church St'])}, Bengaluru`,
      items: its, subtotal, packaging: 30, tax, total: subtotal + 30 + tax, commission: platform === 'website' ? 0 : platform === 'swiggy' ? 22 : 20,
      status, prepTime: 20, createdAt: now - minsAgo * 60000, paymentType: i % 3 === 0 ? 'cod' : 'prepaid',
      rider: status === 'ready' || status === 'picked-up' || status === 'delivered' ? { name: pick(['Ramesh', 'Imran', 'Deepak']), phone: '9000011122', provider: platform === 'website' ? 'Dunzo' : platform } : undefined,
    };
  };
  return [mk(1, 'swiggy', 'placed', 1), mk(2, 'zomato', 'preparing', 9), mk(3, 'zomato', 'ready', 18), mk(4, 'website', 'accepted', 4), mk(5, 'swiggy', 'delivered', 70), mk(6, 'zomato', 'delivered', 95)];
}

export const defaultSettings: Settings = {
  restaurantName: 'DineFlow Kitchen & Bar',
  currency: '₹',
  billFooter: 'Thank you! Visit again 🙏',
  showLogo: true,
  printQrOnBill: true,
  upiId: 'dineflow@okicici',
  roundOff: true,
  loyaltyEarnPercent: 5,
  pointValue: 0.5,
  storeOnline: { swiggy: true, zomato: true, website: true },
  autoAcceptOnline: false,
  defaultPrepTime: 20,
  packagingCharge: 20,
  deliveryCharge: 40,
  kotPrintCopies: 1,
  businessHours: { open: '11:00', close: '23:30' },
};

export const EXPENSE_CATEGORIES = ['Utilities', 'Petty Cash', 'Maintenance', 'Salary Advance', 'Marketing', 'Rent', 'Other'];
export const CUSTOMER_LABELS = LABELS;
