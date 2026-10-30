# CLAUDE.md — Finance Hub

**Next.js + React + TS**, Prisma/Postgres, net worth/accounts/expenses tracking.

All source is under `web/`.

## Commands
```bash
cd web
npm run dev        # Hot-reload
npm run build      # Production build
npm run typecheck  # Type-check
```

## Architecture (`web/src/`)
- `app/` — Next.js App Router pages
- `components/` — React components
- `context/` — CurrencyContext, LanguageContext, Providers
- `translations` — i18n strings

## Components
- `Sidebar.tsx` → nav + ₪/$ toggle
- `Dashboard.tsx` → charts/cards
- `Accounts.tsx` → CRUD + Modal
- `Income.tsx` → income sources + Israeli tax calculator
- `SnapshotEntry.tsx`, `History.tsx`, `Expenses.tsx`
- `Insights.tsx` → AI insights
- `Investments.tsx` → portfolio holdings, upload XLSX, track fees

## Types (`web/src/types/`)
- `Account`: id, name, type ('asset'|'liability'), kind?, owner?
- `MonthlySnapshot`: id, date (YYYY-MM), entries[]
- `RecurringExpense`: id, name, amount, category, billingCycle, owner?, active
- `IncomeSource`: id, name, type, grossAmount, netAmount, billingCycle, owner?, notes?, active
- `ExpenseCategory`: housing, childcare, subscriptions, insurance, utilities, transport, pets, groceries, lifestyle, other
- `Investment`: paperNumber, name, quantity, lastPrice, valueNIS, costPrice, gainFromCostNIS, gainFromCostPct, category?, managementFee?
- `AccountHoldings`: accountId, updatedAt, totalValueNIS, holdings[]

## Conventions
- **Currency**: NIS (₪) → `formatCurrency()` + `useCurrency()`
- **Dates**: YYYY-MM → `formatMonthLabel()`
- **IDs**: `generateId()`
- **Style**: dark (#09090f, #14141f cards, indigo-500), `cn()` merge
- **i18n**: `t('key', lang)` / `tn('key', count, lang)` from `@/translations`

## API Routes
- `GET/POST /api/data` — Load/save AppData
- `GET/POST /api/insights` — Load the insights thread / generate a new report and append it (Claude Opus)
- `POST /api/insights/chat` — Reply to the insights thread; user replies feed into future reports
- `POST /api/translate-insights` — Translate insights to/from Hebrew (Claude Haiku)
- `POST /api/parse-investments` — Parse XLSX holdings file → Investment[]
- `GET /api/household` — Load/manage household & invite tokens
- `POST /api/send-backup` — Email backup via Resend
- `GET/POST /api/tour` — Onboarding tour state

## Data Model
- **AppData** lives as JSON in `UserData.data` (per user)
- Household owner's `UserData` is the source of truth
- Family members access owner's data via household relation
- Schema is fully typed via `types/index.ts`

## Relevant URLs
- Email domain: `avivo.dev` (used for Resend no-reply emails)
- Prisma setup: Postgres with connection pooling via Vercel
