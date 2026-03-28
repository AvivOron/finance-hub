export type AccountKind = 'bank' | 'brokerage' | 'child' | 'piggyBank' | 'custom'

export interface Account {
  id: string
  name: string
  type: 'asset' | 'liability'
  kind?: AccountKind // undefined treated as 'custom' for backward compatibility
  owner?: string // family member who owns this account
  notes?: string
  url?: string // vendor website URL
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
  | 'settings'
