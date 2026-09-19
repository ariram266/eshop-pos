# Counterpoint POS

An offline-first React + TypeScript POS workspace based on the architecture in [spec.md](spec.md).

## Implemented frontend slice

- Responsive checkout workspace for Windows, Android, and iPad-sized screens.
- Local product catalog with category filtering and instant search.
- Cart line editing, tax calculation, customer placeholder, and payment action.
- Register, sync, printer, and online status surfaces that are ready to connect to the local agent.
- PWA manifest and service worker shell for app-like/offline startup.
- Visual language tuned for a fast counter workflow: dense navigation, clear totals, large touch targets, and restrained status feedback.
- Completed sales are written to IndexedDB before the UI clears the cart, then queued for cloud sync and local receipt printing.
- Phase 1 Cloud API persists users, roles, catalog, inventory balances, stock movements, reorder levels, and POS orders in PostgreSQL.

## Run locally

Install Node.js 20+ first, then run:

```sh
npm install
npm run dev
```

Production build:

```sh
npm run build
```

## Service boundaries

The UI is intentionally kept independent of hardware. The source projects under `backend/` implement the initial contracts:


The POS Agent currently uses a mock printer adapter behind the production hardware interface. The Cloud API uses PostgreSQL now; physical adapters, payment providers, and production authentication are the remaining deployment integrations.

### Phase 1 development accounts

- `admin` / `admin123`: catalog, inventory, reorder, and POS access
- `manager` / `manager123`: catalog, inventory, reorder, and POS access
- `cashier` / `cashier123`: POS and sales history only