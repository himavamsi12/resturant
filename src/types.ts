export type ID = string;

export type OrderType = 'dine-in' | 'takeaway' | 'delivery' | 'online';
export type Platform = 'swiggy' | 'zomato' | 'website' | 'scan-order' | 'kiosk' | 'pos' | 'captain';
export type PaymentMode = 'cash' | 'card' | 'upi' | 'wallet' | 'due' | 'online';

export interface Outlet {
  id: ID;
  name: string;
  address: string;
  phone: string;
  gstin: string;
  fssai: string;
  isCentralKitchen?: boolean;
}

export interface Category {
  id: ID;
  name: string;
  sortOrder: number;
  active: boolean;
}

export interface Variation {
  id: ID;
  name: string;
  price: number;
}

export interface AddonGroup {
  id: ID;
  name: string;
  min: number;
  max: number;
  items: { id: ID; name: string; price: number }[];
}

export interface MenuItem {
  id: ID;
  name: string;
  shortCode: string;
  categoryId: ID;
  price: number;
  veg: boolean;
  description?: string;
  variations: Variation[];
  addonGroupIds: ID[];
  taxGroup: 'GST5' | 'GST12' | 'GST18' | 'NONE';
  station: ID; // kitchen station id
  available: boolean;
  onlineAvailable: Record<'swiggy' | 'zomato' | 'website', boolean>;
  areaPrices: Record<ID, number>; // area-specific price overrides
  onlinePrice?: number;
  image?: string; // emoji
}

export interface Area {
  id: ID;
  name: string;
  serviceCharge: number; // percent
}

export type TableStatus = 'blank' | 'running' | 'printed' | 'paid' | 'reserved';

export interface Table {
  id: ID;
  name: string;
  areaId: ID;
  seats: number;
  status: TableStatus;
  orderId?: ID;
  mergedWith?: ID[];
}

export interface CartItem {
  lineId: ID;
  itemId: ID;
  name: string;
  qty: number;
  unitPrice: number; // includes variation + addons
  variation?: string;
  addons: { name: string; price: number }[];
  note?: string;
  kotSent: number; // qty already sent to kitchen
  taxGroup: MenuItem['taxGroup'];
  station: ID;
}

export type OrderStatus = 'open' | 'billed' | 'settled' | 'cancelled';

export interface Payment {
  mode: PaymentMode;
  amount: number;
}

export interface Order {
  id: ID;
  billNo?: number;
  orderType: OrderType;
  platform: Platform;
  tableId?: ID;
  areaId?: ID;
  pax?: number;
  customerId?: ID;
  items: CartItem[];
  discount?: { type: 'percent' | 'flat'; value: number; reason?: string; coupon?: string };
  loyaltyRedeemed?: number;
  deliveryCharge?: number;
  packagingCharge?: number;
  subtotal: number;
  discountAmount: number;
  serviceCharge: number;
  tax: number;
  roundOff: number;
  total: number;
  status: OrderStatus;
  payments: Payment[];
  createdAt: number;
  settledAt?: number;
  staffId?: ID;
  cancelReason?: string;
  tokenNo?: number;
  note?: string;
}

export type KotStatus = 'new' | 'preparing' | 'ready' | 'served' | 'cancelled';

export interface Kot {
  id: ID;
  kotNo: number;
  orderId: ID;
  tableName?: string;
  orderType: OrderType;
  platform: Platform;
  station: ID;
  items: { name: string; qty: number; variation?: string; addons: string[]; note?: string }[];
  status: KotStatus;
  createdAt: number;
  updatedAt: number;
}

export type OnlineOrderStatus =
  | 'placed' | 'accepted' | 'preparing' | 'ready' | 'picked-up' | 'delivered' | 'rejected' | 'cancelled';

export interface OnlineOrder {
  id: ID;
  platform: 'swiggy' | 'zomato' | 'website';
  platformOrderId: string;
  customerName: string;
  customerPhone: string;
  address: string;
  items: { itemId: ID; name: string; qty: number; price: number }[];
  subtotal: number;
  packaging: number;
  tax: number;
  total: number;
  commission: number; // percent
  status: OnlineOrderStatus;
  prepTime: number; // minutes
  rider?: { name: string; phone: string; provider: string };
  createdAt: number;
  paymentType: 'prepaid' | 'cod';
  posOrderId?: ID;
  instructions?: string;
}

export interface RawMaterial {
  id: ID;
  name: string;
  unit: 'kg' | 'g' | 'ltr' | 'ml' | 'pcs';
  stock: number;
  minStock: number;
  costPerUnit: number;
  category: string;
}

export interface Recipe {
  itemId: ID;
  ingredients: { rawMaterialId: ID; qty: number }[];
}

export interface StockLog {
  id: ID;
  rawMaterialId: ID;
  change: number;
  reason: 'sale' | 'purchase' | 'wastage' | 'adjustment' | 'transfer-in' | 'transfer-out' | 'return';
  note?: string;
  at: number;
}

export interface Vendor {
  id: ID;
  name: string;
  phone: string;
  email?: string;
  gstin?: string;
  type: 'local' | 'marketplace';
  rates: Record<ID, number>; // rawMaterialId -> price per unit
}

export type POStatus = 'draft' | 'sent' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: ID;
  poNo: number;
  vendorId: ID;
  items: { rawMaterialId: ID; qty: number; rate: number }[];
  status: POStatus;
  createdAt: number;
  receivedAt?: number;
  total: number;
  paid: boolean;
  invoiceNo?: string;
}

export interface StockTransfer {
  id: ID;
  fromOutletId: ID;
  toOutletId: ID;
  items: { rawMaterialId: ID; qty: number }[];
  status: 'requested' | 'dispatched' | 'received' | 'rejected';
  createdAt: number;
}

export interface Customer {
  id: ID;
  name: string;
  phone: string;
  email?: string;
  birthday?: string; // YYYY-MM-DD
  anniversary?: string;
  labels: string[];
  points: number;
  wallet: number;
  visits: number;
  totalSpent: number;
  lastVisit?: number;
  notes?: string;
  dndPromo?: boolean;
  createdAt: number;
}

export interface Feedback {
  id: ID;
  customerId?: ID;
  customerName: string;
  orderId?: ID;
  rating: number; // 1-5
  food: number;
  service: number;
  ambience: number;
  comment: string;
  at: number;
  resolved: boolean;
}

export interface Campaign {
  id: ID;
  name: string;
  type: 'promotional' | 'birthday' | 'anniversary' | 'win-back' | 'feedback' | 'new-launch' | 'festival';
  channel: 'sms' | 'whatsapp';
  message: string;
  audienceLabel: string; // 'all' or a label
  status: 'draft' | 'scheduled' | 'sent';
  scheduledAt?: number;
  sentCount: number;
  createdAt: number;
}

export interface Coupon {
  id: ID;
  code: string;
  type: 'percent' | 'flat';
  value: number;
  minOrder: number;
  maxDiscount?: number;
  active: boolean;
  usage: number;
}

export interface TaxConfig {
  id: string;
  name: string;
  rate: number; // percent total; split CGST/SGST evenly
}

export interface Station {
  id: ID;
  name: string;
  printer: string;
}

export type Role = 'owner' | 'manager' | 'cashier' | 'captain' | 'chef';

export interface Staff {
  id: ID;
  name: string;
  role: Role;
  pin: string;
  phone: string;
  active: boolean;
}

export interface Reservation {
  id: ID;
  customerName: string;
  phone: string;
  pax: number;
  at: number;
  tableId?: ID;
  status: 'booked' | 'seated' | 'cancelled' | 'no-show';
  note?: string;
}

export interface Expense {
  id: ID;
  category: string;
  amount: number;
  note: string;
  mode: PaymentMode;
  at: number;
}

export interface Shift {
  id: ID;
  staffId: ID;
  openedAt: number;
  closedAt?: number;
  openingCash: number;
  closingCash?: number;
}

export interface Integration {
  id: ID;
  name: string;
  category: string;
  description: string;
  connected: boolean;
  icon: string;
}

export interface Settings {
  restaurantName: string;
  currency: string;
  billFooter: string;
  showLogo: boolean;
  printQrOnBill: boolean;
  upiId: string;
  roundOff: boolean;
  loyaltyEarnPercent: number; // points per 100 spent
  pointValue: number; // ₹ per point
  storeOnline: Record<'swiggy' | 'zomato' | 'website', boolean>;
  autoAcceptOnline: boolean;
  defaultPrepTime: number;
  packagingCharge: number;
  deliveryCharge: number;
  kotPrintCopies: number;
  businessHours: { open: string; close: string };
}
