# NetWorth Tracker

A clean, minimal Mac desktop app for tracking your monthly financial net worth over time.

Built with Electron + React + TypeScript.

## Features

- **Account Management** — Create custom asset and liability categories (Checking, Brokerage, 401k, Mortgage, etc.) with owner assignment and account types
- **Monthly Snapshots** — Record balances once a month per account; auto-detects and lets you edit existing snapshots with last-updated timestamps
- **Dashboard** — Net worth line chart, assets vs. liabilities area chart, and summary cards with month-over-month change; filter by family member or account
- **History** — Table of all past snapshots with edit and delete support
- **Currency switching** — Toggle between NIS (₪, default) and USD ($) from the sidebar; persisted across restarts
- **Data backup** — Export your data as JSON with one click; save to Dropbox, email, or Google Drive manually
- **Local storage** — All data is saved as JSON in your app data directory; no cloud login required

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron 29 |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS (dark theme) |
| Charts | Recharts |
| Build | electron-vite + Vite 5 |
| Storage | Local JSON file via Node `fs` |

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install & run in dev mode

```bash
git clone https://github.com/AvivOron/networth-tracker.git
cd networth-tracker
npm install
npm run dev
```

This opens the full Electron app with hot-reload.

### Package as a macOS app

```bash
npm run dist
```

This builds the app and produces a `.dmg` installer in `dist/`:

| File | Architecture |
|---|---|
| `NetWorth Tracker-x.x.x-arm64.dmg` | Apple Silicon |
| `NetWorth Tracker-x.x.x.dmg` | Intel |

Open the DMG, drag **NetWorth Tracker** to `/Applications`, and launch it like any other app.

> **First launch on macOS:** If Gatekeeper blocks the app (unsigned build), right-click → Open → Open anyway.

## Project Structure

```
src/
├── main/               # Electron main process (window, IPC, file I/O)
├── preload/            # Context bridge — exposes getData/saveData to renderer
└── renderer/
    └── src/
        ├── components/ # Dashboard, Accounts, SnapshotEntry, History, Sidebar
        ├── hooks/      # useData — loads/saves AppData, localStorage fallback
        ├── types/      # TypeScript interfaces (Account, MonthlySnapshot, etc.)
        └── utils/      # Currency formatting, date helpers, ID generation
```

## Data Model

```ts
interface Account {
  id: string
  name: string
  type: 'asset' | 'liability'
  kind?: 'bank' | 'brokerage' | 'child' | 'custom'  // account subtype
  owner?: string         // family member name
  notes?: string
}

interface SnapshotEntry {
  accountId: string
  balance: number
  subBalances?: Record<string, number>  // for multi-part accounts (e.g., checking + savings)
  lastUpdatedAt?: string                // ISO timestamp of last update
}

interface MonthlySnapshot {
  id: string
  date: string           // YYYY-MM
  entries: SnapshotEntry[]
  createdAt: string
  updatedAt: string
}

interface AppData {
  accounts: Account[]
  snapshots: MonthlySnapshot[]
  familyMembers?: string[]  // list of family member names
}
```

Data is stored at:
- **macOS:** `~/Library/Application Support/networth-tracker/networth-data.json`

## License

MIT
