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

## Types (`web/src/types/`)
- `Account`: id, name, type ('asset'|'liability'), kind?, owner?
- `MonthlySnapshot`: id, date (YYYY-MM), entries[]
- `RecurringExpense`: id, name, amount, category, billingCycle
- `IncomeSource`: id, name, type, grossAmount, netAmount, billingCycle, owner?, notes?, active
- `ExpenseCategory`: housing, childcare, subscriptions, insurance, utilities, transport, pets, other

## Conventions
- **Currency**: NIS (₪) → `formatCurrency()` + `useCurrency()`
- **Dates**: YYYY-MM → `formatMonthLabel()`
- **IDs**: `generateId()`
- **Style**: dark (#09090f, #14141f cards, indigo-500), `cn()` merge
- **i18n**: `t('key', lang)` / `tn('key', count, lang)` from `@/translations`
