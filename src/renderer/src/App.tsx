import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { Accounts } from './components/Accounts'
import { SnapshotEntry } from './components/SnapshotEntry'
import { History } from './components/History'
import { Settings } from './components/Settings'
import { Expenses } from './components/Expenses'
import { Income } from './components/Income'
import { useData } from './hooks/useData'
import { CurrencyProvider } from './context/CurrencyContext'
import { Page } from './types'

export default function App() {
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
    <CurrencyProvider>
      <div className="flex h-screen bg-[#09090f] overflow-hidden">
        <Sidebar page={page} onNavigate={handleNavigate} />

        <main className="flex flex-1 overflow-hidden flex-col">
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
            {page === 'settings' && (
              <Settings data={data} onSaveFamilyMembers={saveFamilyMembers} />
            )}
          </div>
        </main>
      </div>
    </CurrencyProvider>
  )
}
