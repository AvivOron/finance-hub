'use client'

import { TouchEvent, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
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
import { Transactions } from '@/components/Transactions'
import { Properties } from '@/components/Properties'
import { FireCalculator } from '@/components/FireCalculator'
import { OnboardingModal } from '@/components/OnboardingModal'
import { TourOverlay } from '@/components/TourOverlay'
import { useData } from '@/hooks/useData'
import { useProperties } from '@/hooks/useProperties'
import { useLanguage } from '@/context/LanguageContext'
import { DEFAULT_APP_PAGE, isRoutableAppPage } from '@/lib/app-routes'
import { t } from '@/translations'
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
const EDGE_SWIPE_ZONE_PX = 24
const SWIPE_OPEN_THRESHOLD_PX = 56
const SWIPE_CLOSE_THRESHOLD_PX = 48
const SWIPE_VERTICAL_TOLERANCE_PX = 24
const MOBILE_BREAKPOINT_PX = 768
const pageTitleKeyMap: Record<Page, string> = {
  dashboard: 'nav.dashboard',
  accounts: 'nav.accounts',
  snapshot: 'nav.snapshot',
  history: 'nav.history',
  expenses: 'nav.expenses',
  'variable-expenses': 'nav.expenses',
  income: 'nav.income',
  insights: 'nav.insights',
  projections: 'nav.projections',
  investments: 'nav.investments',
  transactions: 'nav.transactions',
  properties: 'nav.properties',
  fire: 'nav.fire',
  settings: 'nav.settings',
}

function getPageFromPathname(pathname: string): Page {
  const appPrefixes = ['/finance-hub/app', '/app']
  const matchedPrefix = appPrefixes.find(prefix => pathname.startsWith(prefix))
  const normalizedPath = matchedPrefix
    ? pathname.slice(matchedPrefix.length) || '/'
    : pathname
  const segments = normalizedPath.split('/').filter(Boolean)
  const currentPage = segments[0]

  if (currentPage && isRoutableAppPage(currentPage)) {
    return currentPage
  }

  return DEFAULT_APP_PAGE
}

export function AppClient({ user }: AppClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const {
    data,
    loading,
    txSummary,
    saveAccounts,
    saveSnapshots,
    saveFamilyMembers,
    saveExpenses,
    saveVariableExpenses,
    saveIncome,
    saveAiInsights,
    saveAccountHoldings,
    refreshData
  } = useData()
  const { lang } = useLanguage()
  const { properties, addProperty, updateProperty, deleteProperty } = useProperties()
  const page = getPageFromPathname(pathname)
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const swipeRef = useRef<{
    tracking: boolean
    startX: number
    startY: number
    edgeEligible: boolean
  }>({
    tracking: false,
    startX: 0,
    startY: 0,
    edgeEligible: false,
  })

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
    navigateToPage('snapshot')
  }

  function handleSnapshotEditDone() {
    setEditingSnapshotId(null)
    navigateToPage('history')
  }

  function navigateToPage(nextPage: Page) {
    router.push(`/app/${nextPage}`)
  }

  function handleNavigate(nextPage: Page) {
    navigateToPage(nextPage)
    setSidebarOpen(false)
  }

  useEffect(() => {
    if (page !== 'snapshot' && editingSnapshotId) {
      setEditingSnapshotId(null)
    }
  }, [editingSnapshotId, page])

  function isMobileViewport() {
    return typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT_PX
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (!isMobileViewport()) return

    const touch = event.touches[0]
    const viewportWidth = window.innerWidth
    const startX = touch.clientX
    const startY = touch.clientY
    const edgeEligible = sidebarOpen
      ? true
      : lang === 'he'
        ? startX >= viewportWidth - EDGE_SWIPE_ZONE_PX
        : startX <= EDGE_SWIPE_ZONE_PX

    swipeRef.current = {
      tracking: true,
      startX,
      startY,
      edgeEligible,
    }
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const swipe = swipeRef.current
    swipeRef.current = {
      tracking: false,
      startX: 0,
      startY: 0,
      edgeEligible: false,
    }

    if (!swipe.tracking || !swipe.edgeEligible || !isMobileViewport()) return

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - swipe.startX
    const deltaY = touch.clientY - swipe.startY

    if (Math.abs(deltaY) > SWIPE_VERTICAL_TOLERANCE_PX || Math.abs(deltaY) > Math.abs(deltaX)) {
      return
    }

    const openGesture = lang === 'he' ? deltaX <= -SWIPE_OPEN_THRESHOLD_PX : deltaX >= SWIPE_OPEN_THRESHOLD_PX
    const closeGesture = lang === 'he' ? deltaX >= SWIPE_CLOSE_THRESHOLD_PX : deltaX <= -SWIPE_CLOSE_THRESHOLD_PX

    if (!sidebarOpen && openGesture) {
      setSidebarOpen(true)
    } else if (sidebarOpen && closeGesture) {
      setSidebarOpen(false)
    }
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
    <div
      className="flex min-h-[100dvh] bg-[#09090f] overflow-hidden md:h-screen"
      dir={lang === 'he' ? 'rtl' : 'ltr'}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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

      <main className="relative flex flex-1 overflow-hidden flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden fixed inset-x-0 top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-end gap-3 border-b border-white/10 bg-[#0f0f18]/95 px-4 pb-3 pt-[env(safe-area-inset-top)] backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-indigo-300/80">Finance Hub</p>
            <p className="truncate text-sm font-semibold text-white">{t(pageTitleKeyMap[page], lang)}</p>
          </div>
        </div>

        <div className={`flex-1 pt-[calc(3.5rem+env(safe-area-inset-top))] md:pt-0 ${page === 'insights' ? 'overflow-hidden relative' : 'overflow-y-auto'}`}>
          {page === 'dashboard' && (
            <Dashboard data={data} onNavigate={handleNavigate} txSummary={txSummary} properties={properties} />
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
              variableExpenses={data.variableExpenses || []}
              familyMembers={data.familyMembers || []}
              onSave={saveExpenses}
              onSaveVariable={saveVariableExpenses}
              txSummary={txSummary}
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
          {page === 'transactions' && (
            <Transactions data={data} />
          )}
          {page === 'investments' && (
            <Investments data={data} onSave={async (newData) => {
              if (newData.accountHoldings) await saveAccountHoldings(newData.accountHoldings)
            }} />
          )}
          {page === 'properties' && (
            <Properties
              properties={properties}
              onAdd={addProperty}
              onUpdate={updateProperty}
              onDelete={deleteProperty}
            />
          )}
          {page === 'fire' && (
            <FireCalculator data={data} txSummary={txSummary} />
          )}
          {page === 'settings' && (
            <Settings data={data} onSaveFamilyMembers={saveFamilyMembers} />
          )}
        </div>
      </main>
    </div>
  )
}
