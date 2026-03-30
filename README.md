# Finance Hub

A clean, minimal web app for comprehensive financial tracking — net worth, accounts, recurring expenses, and income all in one place.

Built with Next.js + React + TypeScript, with Prisma/Postgres for storage and AI-powered insights.

## Features

**Net Worth Tracking**
- **Account Management** — Create custom asset and liability categories (Checking, Brokerage, 401k, Mortgage, etc.) with owner assignment
- **Monthly Snapshots** — Record balances once a month per account; auto-detects and lets you edit existing snapshots
- **Dashboard** — Net worth line chart, assets vs. liabilities area chart, and summary cards with month-over-month change; filter by family member or account
- **History** — Table of all past snapshots with edit and delete support

**Income Tracking**
- **Income Sources** — Track salary and other income sources with gross and net amounts
- **Israeli Tax Calculator** — Auto-calculate net from gross using 2025 מדרגות מס (income tax brackets) and נקודות זיכוי (tax credit points), including national insurance (ביטוח לאומי)
- **Billing Cycles** — Monthly and yearly income with automatic conversion
- **Family Assignment** — Assign income sources to family members

**Expense Management**
- **Recurring Expenses** — Track fixed monthly costs (housing, subscriptions, utilities, pets, etc.)
- **Expense Categories** — Pre-built categories with color-coded icons
- **Expense Dashboard** — Summary cards with total monthly/yearly expenses; bar chart breakdown by category

**AI Insights**
- **Financial Analysis** — Claude-powered insights summarizing your financial picture
- **Streaming** — Live streaming animation for both generation and when loading persisted insights
- **Translation** — Translate insights between English and Hebrew on demand
- **Persistence** — Insights saved to DB and restored with streaming animation on next load

**General**
- **Bilingual** — Full English / Hebrew (עברית) UI with language toggle
- **Currency switching** — Toggle between NIS (₪) and USD ($)
- **Data backup** — Export your data as JSON with one click
- **Multi-user** — Auth via NextAuth; each user has isolated data

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS (dark theme) |
| Charts | Recharts |
| Database | Prisma + Postgres |
| Auth | NextAuth |
| AI | Anthropic Claude API (Sonnet for insights, Haiku for translation) |

## Getting Started

```bash
cd web
npm install
npm run dev
```

## Project Structure

```
web/
├── src/
│   ├── app/                 # Next.js App Router pages & API routes
│   │   ├── app/             # Main app page (AppClient)
│   │   ├── api/             # API routes (data, insights, save, translate)
│   │   └── invite/          # Invite flow
│   ├── components/          # React components
│   │   ├── Dashboard.tsx
│   │   ├── Accounts.tsx
│   │   ├── Income.tsx       # Income + Israeli tax calculator
│   │   ├── Expenses.tsx
│   │   ├── History.tsx
│   │   ├── SnapshotEntry.tsx
│   │   ├── Insights.tsx
│   │   ├── Settings.tsx
│   │   └── Sidebar.tsx
│   ├── context/             # CurrencyContext, LanguageContext
│   ├── translations/        # i18n strings (en/he)
│   ├── types/               # TypeScript interfaces
│   └── hooks/               # useData
└── prisma/                  # Schema + migrations
```

## License

MIT
