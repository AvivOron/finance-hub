export type AccountKind = 'bank' | 'brokerage' | 'child' | 'piggyBank' | 'custom'

export interface Account {
  id: string
  name: string
  type: 'asset' | 'liability'
  kind?: AccountKind // undefined treated as 'custom' for backward compatibility
  owner?: string // family member who owns this account
  notes?: string
  url?: string // vendor website URL
  monthlyDeposit?: number // average monthly deposit/contribution
  feesFixed?: number // fixed monthly fee amount
  feesOnBalance?: number // % of accumulated balance per year (e.g. pension management fee)
  feesOnDeposit?: number // % deducted from each deposit (e.g. pension deposit fee)
  description?: string // free text, e.g. investment portfolio details
}

export interface SnapshotEntry {
  accountId: string
  balance: number
  subBalances?: Record<string, number> // bank: { checking, savings }; brokerage: { stocks, cash }
  lastUpdatedAt?: string // ISO timestamp of when this balance was last updated
}

export interface MonthlySnapshot {
  id: string
  date: string // YYYY-MM
  entries: SnapshotEntry[]
  createdAt: string
  updatedAt: string
}

export interface FamilyMember {
  name: string
  isChild?: boolean // if true, excluded from income filters
}

export interface AppData {
  accounts: Account[]
  snapshots: MonthlySnapshot[]
  familyMembers?: FamilyMember[]
  expenses?: RecurringExpense[]
  income?: IncomeSource[]
  accountHoldings?: AccountHoldings[]
  aiInsights?: {
    content: string
    language: 'en' | 'he'
    generatedAt: string
  }
}

export type ExpenseCategory =
  | 'housing'
  | 'childcare'
  | 'subscriptions'
  | 'insurance'
  | 'utilities'
  | 'transport'
  | 'pets'
  | 'groceries'
  | 'lifestyle'
  | 'other'

export interface RecurringExpense {
  id: string
  name: string
  amount: number
  category: ExpenseCategory
  billingCycle: 'monthly' | 'yearly'
  owner?: string
  notes?: string
  active: boolean
}

export type IncomeType = 'salary'

export interface IncomeSource {
  id: string
  name: string
  type: IncomeType
  grossAmount: number
  netAmount: number
  billingCycle: 'monthly' | 'yearly'
  owner?: string
  notes?: string
  active: boolean
}

export type Page =
  | 'dashboard'
  | 'snapshot'
  | 'accounts'
  | 'history'
  | 'expenses'
  | 'income'
  | 'insights'
  | 'projections'
  | 'investments'
  | 'settings'

export interface Investment {
  paperNumber: string // מספר נייר - Israeli security identifier
  name: string // שם נייר
  quantity: number // כמות בתיק
  lastPrice: number // שער אחרון
  valueNIS: number // שווי אחזקה (₪)
  costPrice: number // שער עלות
  gainFromCostNIS: number // שינוי מעלות בש"ח
  gainFromCostPct: number // שינוי מעלות %
  category?: string // LLM-categorized type (e.g. מניות, אגרות חוב, שקל)
  personalNote?: string // User's custom note (from spreadsheet column)
  portfolioPct?: number // נתח מהתיק (excellence only)
  managementFee?: number // דמי ניהול שנתיים %
  feeSource?: string // where fee was found
}

export interface AccountHoldings {
  accountId: string
  updatedAt: string // ISO timestamp from file
  totalValueNIS: number
  holdings: Investment[]
}
