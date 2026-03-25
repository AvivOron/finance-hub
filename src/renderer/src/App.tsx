import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './components/Dashboard'
import { Accounts } from './components/Accounts'
import { SnapshotEntry } from './components/SnapshotEntry'
import { History } from './components/History'
import { Settings } from './components/Settings'
import { useData } from './hooks/useData'
import { CurrencyProvider } from './context/CurrencyContext'
import { Page } from './types'

export default function App() {
  const {
    data,
    loading,
    syncAlerts,
    saveAccounts,
    saveSnapshots,
    saveFamilyMembers,
    updateDriveSync
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
          {/* Sync alerts */}
          {syncAlerts.length > 0 && (
            <div className="bg-yellow-900/20 border-b border-yellow-500/30 px-8 py-3 flex items-center gap-2 text-sm text-yellow-400">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
              {syncAlerts[0].message}
            </div>
          )}

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
                onSaveFamilyMembers={saveFamilyMembers}
              />
            )}
            {page === 'history' && (
              <History
                data={data}
                onSave={saveSnapshots}
                onEditSnapshot={handleEditSnapshot}
              />
            )}
            {page === 'settings' && (
              <Settings data={data} onUpdateDriveSync={updateDriveSync} />
            )}
          </div>
        </main>
      </div>
    </CurrencyProvider>
  )
}
