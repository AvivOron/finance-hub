export interface Account {
  id: string
  name: string
  type: 'asset' | 'liability'
  notes?: string
}

export interface SnapshotEntry {
  accountId: string
  balance: number
}

export interface MonthlySnapshot {
  id: string
  date: string // YYYY-MM
  entries: SnapshotEntry[]
  createdAt: string
  updatedAt: string
}

export interface AppData {
  accounts: Account[]
  snapshots: MonthlySnapshot[]
}

export type Page = 'dashboard' | 'snapshot' | 'accounts' | 'history'
