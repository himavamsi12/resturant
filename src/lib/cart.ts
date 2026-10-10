import type { CartItem, MenuItem, Variation } from '../types';
import { uid } from './billing';

/** Build a POS cart line from a menu item + chosen variation/addons. */
export function makeLine(m: MenuItem, qty = 1, variation?: Variation, addons: { name: string; price: number }[] = [], note?: string): CartItem {
  const base = variation ? variation.price : m.price;
  return {
    lineId: uid('l'),
    itemId: m.id,
    name: m.name,
    qty,
    unitPrice: base + addons.reduce((a, x) => a + x.price, 0),
    variation: variation?.name,
    addons,
    note,
    kotSent: 0,
    taxGroup: m.taxGroup,
    station: m.station,
  };
}

/** Same-config lines (item + variation + addons) are merged by key. */
export const lineKey = (l: Pick<CartItem, 'itemId' | 'variation' | 'addons'>) =>
  `${l.itemId}|${l.variation || ''}|${l.addons.map((a) => a.name).join(',')}`;

export function addToCart(cart: CartItem[], line: CartItem): CartItem[] {
  const k = lineKey(line);
  const ex = cart.find((l) => lineKey(l) === k);
  return ex ? cart.map((l) => (l === ex ? { ...l, qty: l.qty + line.qty } : l)) : [...cart, line];
}

export function changeQty(cart: CartItem[], lineId: string, delta: number): CartItem[] {
  return cart.map((l) => (l.lineId === lineId ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0);
}

/** Beep using WebAudio (no asset needed). */
export function beep(freq = 880, duration = 0.18, times = 2) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      o.type = 'sine';
      g.gain.value = 0.15;
      o.connect(g).connect(ctx.destination);
      const t = ctx.currentTime + i * (duration + 0.08);
      o.start(t);
      o.stop(t + duration);
    }
    setTimeout(() => ctx.close(), (duration + 0.1) * times * 1000 + 200);
  } catch {
    /* audio unavailable */
  }
}
