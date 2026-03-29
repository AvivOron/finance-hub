# CLAUDE.md — Finance Hub

**Electron + React + TS**, local JSON storage, net worth/accounts/expenses tracking.

## Commands
```bash
npm run dev        # Hot-reload
npm run build      # Production → out/
npm run typecheck  # Type-check
npm run pack       # Build .app
npm run dist       # Build .dmg
```

## Architecture
- **Main** (`src/main`) — IPC `getData`/`saveData`, file I/O
- **Preload** (`src/preload`) — exposes `window.api`
- **Renderer** (`src/renderer/src`) — React SPA, state router, `CurrencyProvider` root

## Components
- `App.tsx` — router, context wrapper
- `Sidebar.tsx` → nav + ₪/$ toggle
- `Dashboard.tsx` → charts/cards
- `Accounts.tsx` → CRUD
- `SnapshotEntry.tsx`, `History.tsx`, `Expenses.tsx`
- `useData.ts` → AppData loader, localStorage fallback

## Types (`src/renderer/src/types/index.ts`)
- `Account`: id, name, type ('asset'|'liability'), kind?, owner?
- `MonthlySnapshot`: id, date (YYYY-MM), entries[]
- `RecurringExpense`: id, name, amount, category, billingCycle
- `ExpenseCategory`: housing, childcare, subscriptions, insurance, utilities, transport, pets, other

## Conventions
- **Currency**: NIS (₪) → `formatCurrency()` + `useCurrency()`
- **Dates**: YYYY-MM → `formatMonthLabel()`
- **IDs**: `generateId()`
- **Style**: dark (#09090f, #14141f cards, indigo-500), `cn()` merge
- **File**: `~/.networth-data.json`
