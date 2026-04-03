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
import { Projections } from '@/components/Projections'
import { Investments } from '@/components/Investments'
import { OnboardingModal } from '@/components/OnboardingModal'
import { TourOverlay } from '@/components/TourOverlay'
import { useData } from '@/hooks/useData'
import { useLanguage } from '@/context/LanguageContext'
import { Page } from '@/types'

interface AppClientProps {
  user: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    isDemo?: boolean
  }
}

const ONBOARDING_KEY = 'finance-hub:onboarding-done'
const TOUR_KEY = 'finance-hub:tour-done'

export function AppClient({ user }: AppClientProps) {
  const {
    data,
    loading,
    saveAccounts,
    saveSnapshots,
    saveFamilyMembers,
    saveExpenses,
    saveIncome,
    saveAiInsights,
    saveAccountHoldings,
    refreshData
  } = useData()
  const { lang } = useLanguage()

  const [page, setPage] = useState<Page>('dashboard')
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Onboarding: show for real users until they have accounts OR permanently dismiss
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === 'undefined') return false
    if (user.isDemo) return false
    if (localStorage.getItem(ONBOARDING_KEY)) return false
    return true // will be re-evaluated after data loads, but start visible for new users
  })

  // Hide onboarding once accounts exist (unless permanently dismissed)
  // We derive this after data loads — handled in render below

  // Tour: show for demo users who haven't completed it
  const [showTour, setShowTour] = useState(() => {
    if (typeof window === 'undefined') return false
    if (!user.isDemo) return false
    return !localStorage.getItem(TOUR_KEY)
  })

  function handleOnboardingComplete() {
    // Just close — will re-show on next login if still no accounts
    setShowOnboarding(false)
  }

  function handleOnboardingDismissPermanently() {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowOnboarding(false)
  }

  function handleTourComplete() {
    localStorage.setItem(TOUR_KEY, '1')
    setShowTour(false)
  }

  function handleRestartTour() {
    localStorage.removeItem(TOUR_KEY)
    setShowTour(true)
  }

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
    <div className="flex h-screen bg-[#09090f] overflow-hidden" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      {showOnboarding && data.accounts.length === 0 && (
        <OnboardingModal
          onComplete={handleOnboardingComplete}
          onDismissPermanently={handleOnboardingDismissPermanently}
          initialFamilyMembers={data.familyMembers}
          onSaveFamilyMembers={saveFamilyMembers}
        />
      )}
      {showTour && (
        <TourOverlay
          onComplete={handleTourComplete}
          onNavigate={handleNavigate}
          currentPage={page}
        />
      )}
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar page={page} onNavigate={handleNavigate} user={user} open={sidebarOpen} isDemo={user.isDemo} onRestartTour={user.isDemo ? handleRestartTour : undefined} />

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

        <div className={`flex-1 ${page === 'insights' ? 'overflow-hidden relative' : 'overflow-y-auto'}`}>
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
              data={data}
              onRefreshData={refreshData}
              onSaveAccountHoldings={saveAccountHoldings}
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
            <Insights data={data} user={user} onSaveInsights={saveAiInsights} />
          )}
          {page === 'projections' && (
            <Projections data={data} />
          )}
          {page === 'investments' && (
            <Investments data={data} onSave={async (newData) => {
              if (newData.accountHoldings) await saveAccountHoldings(newData.accountHoldings)
            }} />
          )}
          {page === 'settings' && (
            <Settings data={data} onSaveFamilyMembers={saveFamilyMembers} />
          )}
        </div>
      </main>
    </div>
  )
}
