import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';

/** Rehydrate the persisted store when another tab (customer device, KDS screen…) writes to it. */
export function useCrossTabSync() {
  useEffect(() => {
    const h = (e: StorageEvent) => {
      if (e.key === 'dineflow-pos-v1') useStore.persist.rehydrate();
    };
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }, []);
}

/** Re-render every `ms` milliseconds (for timers / clocks). */
export function useTick(ms: number) {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}
