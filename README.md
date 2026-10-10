# DineFlow POS

Frontend for a restaurant POS & management suite (billing, KOT, tables, KDS, online orders, menu,
inventory, purchase, CRM/loyalty, campaigns, 30+ reports, captain app, scan & order, kiosk, website).

Frontend only: all data lives in a Zustand store persisted to `localStorage` (`dineflow-pos-v1`),
seeded with 60 days of demo orders. Settings → Data → Reset restores the demo data.

```bash
npm install
npm run dev        # http://localhost:5173 (use --port if taken)
npm run build
```

Demo PINs: 1111 owner · 2222 manager · 3333 cashier · 4444/5555 captain · 6666 chef

| Area | Path |
|---|---|
| Staff app (sidebar) | `/#/`, `/#/billing`, `/#/tables`, `/#/kds`, `/#/online`, `/#/menu`, `/#/inventory`, `/#/purchase`, `/#/crm`, `/#/reports`, … |
| Captain (waiter) app | `/#/captain` |
| Customer QR menu | `/#/scan/<tableId>` e.g. `/#/scan/t-ac-1` |
| Self-service kiosk | `/#/kiosk` |
| Token display | `/#/tokens` |
| Restaurant website | `/#/website` |

Open device screens in separate tabs — they sync through `localStorage` events.

Code map: `src/types.ts` (domain model) · `src/store/useStore.ts` (all business logic) ·
`src/data/seed.ts` (demo data) · `src/lib/billing.ts` (bill math) · `src/pages/*` (one file per module).
To add a real backend, replace store actions with API calls.

Hero photo (`public/hero-restaurant.jpg`): Declan Sun on Unsplash — https://unsplash.com/photos/TBYp4mvmYx4 (Unsplash License).
