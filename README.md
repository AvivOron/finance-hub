# NetWorth Tracker

A clean, minimal Mac desktop app for tracking your monthly financial net worth over time.

Built with Electron + React + TypeScript.

![Dashboard screenshot showing net worth charts and summary cards](.github/screenshot.png)

## Features

- **Account Management** — Create custom asset and liability categories (Checking, Brokerage, 401k, Mortgage, etc.)
- **Monthly Snapshots** — Record balances once a month per account; auto-detects and lets you edit existing snapshots
- **Dashboard** — Net worth line chart, assets vs. liabilities area chart, and summary cards with month-over-month change
- **History** — Table of all past snapshots with edit and delete support
- **Local storage** — All data is saved as JSON in your app data directory; no cloud, no accounts

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

### Install & run

```bash
git clone https://github.com/AvivOron/networth-tracker.git
cd networth-tracker
npm install
npm run dev
```

This opens the full Electron app with hot-reload.

### Build for production

```bash
npm run build
```

Output is written to `out/`.

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
  notes?: string
}

interface MonthlySnapshot {
  id: string
  date: string           // YYYY-MM
  entries: { accountId: string; balance: number }[]
  createdAt: string
  updatedAt: string
}
```

Data is stored at:
- **macOS:** `~/Library/Application Support/networth-tracker/networth-data.json`

## License

MIT
