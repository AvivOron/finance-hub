'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { Dashboard } from '@/components/Dashboard'
import { Accounts } from '@/components/Accounts'
import { SnapshotEntry } from '@/components/SnapshotEntry'
import { History } from '@/components/History'
import { Settings } from '@/components/Settings'
import { Expenses } from '@/components/Expenses'
import { Income } from '@/components/Income'
import { Insights } from '@/components/Insights'
import { useData } from '@/hooks/useData'
import { Page } from '@/types'

interface AppClientProps {
  user: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

export function AppClient({ user }: AppClientProps) {
  const {
    data,
    loading,
    saveAccounts,
    saveSnapshots,
    saveFamilyMembers,
    saveExpenses,
    saveIncome
  } = useData()

  const [page, setPage] = useState<Page>('dashboard')
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  function handleEditSnapshot(id: string) {
    setEditingSnapshotId(id)
    setPage('snapshot')
  }

  function handleSnapshotEditDone() {
    setEditingSnapshotId(null)
    setPage('history')
  }

  function handleNavigate(p: Page) {
    if (p !== 'snapshot') setEditingSnapshotId(null)
    setPage(p)
    setSidebarOpen(false)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#09090f]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-[#09090f] overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar page={page} onNavigate={handleNavigate} user={user} open={sidebarOpen} />

      <main className="flex flex-1 overflow-hidden flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-white/5 bg-[#0f0f18] shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-white/10 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <span className="text-sm font-semibold text-white/90">Finance Hub</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {page === 'dashboard' && (
            <Dashboard data={data} onNavigate={handleNavigate} />
          )}
          {page === 'snapshot' && (
            <SnapshotEntry
              accounts={data.accounts}
              snapshots={data.snapshots}
              onSave={saveSnapshots}
              editingSnapshotId={editingSnapshotId}
              onEditDone={editingSnapshotId ? handleSnapshotEditDone : undefined}
            />
          )}
          {page === 'accounts' && (
            <Accounts
              accounts={data.accounts}
              familyMembers={data.familyMembers || []}
              onSave={saveAccounts}
            />
          )}
          {page === 'history' && (
            <History
              data={data}
              onSave={saveSnapshots}
              onEditSnapshot={handleEditSnapshot}
            />
          )}
          {page === 'expenses' && (
            <Expenses
              expenses={data.expenses || []}
              familyMembers={data.familyMembers || []}
              onSave={saveExpenses}
            />
          )}
          {page === 'income' && (
            <Income
              income={data.income || []}
              familyMembers={data.familyMembers || []}
              onSave={saveIncome}
            />
          )}
          {page === 'insights' && (
            <Insights data={data} />
          )}
          {page === 'settings' && (
            <Settings data={data} onSaveFamilyMembers={saveFamilyMembers} />
          )}
        </div>
      </main>
    </div>
  )
}
