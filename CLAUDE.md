# CLAUDE.md — NetWorth Tracker

## Project overview

Electron + React + TypeScript desktop app for monthly net worth tracking. Uses `electron-vite` as the build tool, Tailwind CSS for styling, and Recharts for charts. All data is stored locally as JSON.

## Commands

```bash
npm run dev        # Start Electron app with hot-reload (opens native window)
npm run build      # Production build → out/
npm run preview    # Preview the production build
npm run typecheck  # Type-check main + renderer without building
npm run pack       # Build + package as unpacked .app (fast, no DMG)
npm run dist       # Build + package as .dmg installer → dist/
```

## Architecture

### Process model
- **Main process** (`src/main/index.ts`) — creates the BrowserWindow, registers IPC handlers `getData` / `saveData`, reads/writes `networth-data.json` via Node `fs`
- **Preload** (`src/preload/index.ts`) — exposes `window.api.getData()` and `window.api.saveData()` via `contextBridge`
- **Renderer** (`src/renderer/src/`) — React SPA; communicates with main via `window.api`

### Renderer layout
```
App.tsx             state-based router (no react-router)
  Sidebar.tsx       left nav
  Dashboard.tsx     charts + summary cards
  Accounts.tsx      CRUD for account categories
  SnapshotEntry.tsx monthly balance entry form
  History.tsx       table of past snapshots
```

### Data hook
`hooks/useData.ts` loads `AppData` on mount and exposes `saveAccounts` / `saveSnapshots`. Falls back to `localStorage` when `window.api` is unavailable (browser preview / tests).

### Key types (`src/renderer/src/types/index.ts`)
```ts
Account           { id, name, type: 'asset'|'liability', notes? }
MonthlySnapshot   { id, date (YYYY-MM), entries[], createdAt, updatedAt }
AppData           { accounts: Account[], snapshots: MonthlySnapshot[] }
```

## Conventions

- All currency is USD; use `formatCurrency` / `formatCurrencyShort` from `utils/index.ts`
- Dates are stored as `YYYY-MM` strings; use `formatMonthLabel` / `formatMonthFull` for display
- IDs are generated with `generateId()` (base36 timestamp + random suffix)
- Dark theme only — background `#09090f`, cards `#14141f`, accent `indigo-500`
- Tailwind class merging via `cn()` helper in `utils/index.ts`

## Data file location

`app.getPath('userData')/networth-data.json`
- macOS: `~/Library/Application Support/networth-tracker/networth-data.json`

## electron-vite config

`electron.vite.config.ts` — three separate Vite builds (main, preload, renderer). The renderer uses `@renderer` as a path alias for `src/renderer/src/`.
