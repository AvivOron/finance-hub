export type AccountKind = 'bank' | 'brokerage' | 'child' | 'custom'

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

export interface DriveSync {
  enabled: boolean
  accessToken?: string // Google OAuth access token
  fileId?: string // Google Drive file ID for storing data
  lastSyncAt?: string // ISO timestamp of last successful sync
}

export interface AppData {
  accounts: Account[]
  snapshots: MonthlySnapshot[]
  familyMembers?: string[] // list of family member names
  driveSync?: DriveSync // Google Drive sync configuration
  expenses?: RecurringExpense[]
}

export type ExpenseCategory = 'housing' | 'childcare' | 'subscriptions' | 'insurance' | 'utilities' | 'transport' | 'other'

export interface RecurringExpense {
  id: string
  name: string
  amount: number
  category: ExpenseCategory
  billingCycle: 'monthly' | 'yearly'
  owner?: string // family member
  notes?: string
  active: boolean
}

export type Page = 'dashboard' | 'snapshot' | 'accounts' | 'history' | 'expenses' | 'settings'
