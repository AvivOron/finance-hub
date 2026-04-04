'use client'

import Image from 'next/image'
import { signOut } from 'next-auth/react'
import { useState } from 'react'
import {
  LayoutDashboard,
  PlusCircle,
  Wallet,
  History,
  Settings as SettingsIcon,
  Receipt,
  TrendingUp,
  Sparkles,
  LogOut,
  Loader2,
  LineChart,
  CreditCard
} from 'lucide-react'
import { Page } from '../types'
import { cn } from '../utils'
import { useCurrency } from '../context/CurrencyContext'
import { useLanguage } from '../context/LanguageContext'
import { t } from '../translations'

interface SidebarProps {
  page: Page
  onNavigate: (page: Page) => void
  open?: boolean
  isDemo?: boolean
  onRestartTour?: () => void
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

type TrackingPage = 'dashboard' | 'accounts' | 'snapshot' | 'history' | 'projections' | 'investments'
type ExpensePage = 'expenses' | 'income' | 'insights' | 'transactions'
type SettingPage = 'settings'

const trackingLabelMap: Record<TrackingPage, string> = {
  'dashboard': 'nav.dashboard',
  'accounts': 'nav.accounts',
  'snapshot': 'nav.snapshot',
  'history': 'nav.history',
  'projections': 'nav.projections',
  'investments': 'nav.investments'
}

const expenseLabelMap: Record<ExpensePage, string> = {
  'expenses': 'nav.expenses',
  'income': 'nav.income',
  'insights': 'nav.insights',
  'transactions': 'nav.transactions'
}

const settingLabelMap: Record<SettingPage, string> = {
  'settings': 'nav.settings'
}

const trackingItems: { id: TrackingPage; icon: React.ElementType }[] = [
  { id: 'dashboard', icon: LayoutDashboard },
  { id: 'accounts', icon: Wallet },
  { id: 'snapshot', icon: PlusCircle },
  { id: 'history', icon: History },
  { id: 'projections', icon: LineChart },
  { id: 'investments', icon: TrendingUp }
]

const expenseItems: { id: ExpensePage; icon: React.ElementType }[] = [
  { id: 'expenses', icon: Receipt },
  { id: 'transactions', icon: CreditCard },
  { id: 'income', icon: TrendingUp },
  { id: 'insights', icon: Sparkles }
]

const settingItems: { id: SettingPage; icon: React.ElementType }[] = [
  { id: 'settings', icon: SettingsIcon }
]

export function Sidebar({ page, onNavigate, open, isDemo, onRestartTour, user }: SidebarProps) {
  const { currency, setCurrency } = useCurrency()
  const { lang, setLang } = useLanguage()
  const [signingOut, setSigningOut] = useState(false)

  const sidebarPositionClass = lang === 'he'
    ? cn(
      'fixed inset-y-0 right-0 z-50 transition-transform duration-200 md:relative md:translate-x-0',
      open ? 'translate-x-0' : 'translate-x-full'
    )
    : cn(
      'fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:relative md:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full'
    )

  return (
    <aside className={cn(
      'flex flex-col w-[220px] min-w-[220px] bg-[#0f0f18] border-r border-white/5 h-full',
      sidebarPositionClass
    )}>
      {/* Title */}
      <div className="h-16 flex flex-col justify-center px-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-white/90 tracking-tight">Finance Hub</span>
        </div>
      </div>

      {/* Demo Mode Banner */}
      {isDemo && (
        <div className="px-3 py-3 border-b border-white/5 bg-amber-500/10">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-amber-400 shrink-0">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor" />
            </svg>
            <p className="text-xs font-medium text-amber-300">Demo Mode</p>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] text-amber-200/70">This is sample data. Sign in to use your own.</p>
            {onRestartTour && (
              <button
                onClick={onRestartTour}
                className="text-[10px] text-amber-300/70 hover:text-amber-300 underline underline-offset-2 transition-colors shrink-0 ml-2"
              >
                Replay tour
              </button>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {/* Tracking Section */}
        <div>
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide px-3 py-2 mb-2">
            {t('nav.section.tracking', lang)}
          </h3>
          <div className="space-y-0.5">
            {trackingItems.map(({ id, icon: Icon }) => (
              <button
                key={id}
                id={`tour-nav-${id}`}
                onClick={() => onNavigate(id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                  page === id
                    ? 'bg-indigo-500/15 text-indigo-300'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                )}
              >
                <Icon size={16} className={page === id ? 'text-indigo-400' : 'text-gray-500'} />
                {t(trackingLabelMap[id], lang)}
              </button>
            ))}
          </div>
        </div>

        {/* Management Section */}
        <div className="pt-2 border-t border-white/5">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide px-3 py-2 mb-2">
            {t('nav.section.management', lang)}
          </h3>
          <div className="space-y-0.5">
            {expenseItems.map(({ id, icon: Icon }) => (
              <button
                key={id}
                id={`tour-nav-${id}`}
                onClick={() => onNavigate(id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                  page === id
                    ? 'bg-indigo-500/15 text-indigo-300'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                )}
              >
                <Icon size={16} className={page === id ? 'text-indigo-400' : 'text-gray-500'} />
                {t(expenseLabelMap[id], lang)}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Section */}
        <div className="pt-2 border-t border-white/5">
          <div className="space-y-0.5">
            {settingItems.map(({ id, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                  page === id
                    ? 'bg-indigo-500/15 text-indigo-300'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                )}
              >
                <Icon size={16} className={page === id ? 'text-indigo-400' : 'text-gray-500'} />
                {t(settingLabelMap[id], lang)}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/5 space-y-3">
        {/* User info + sign out */}
        <div className="flex items-center gap-2.5">
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name || 'User'}
              width={28}
              height={28}
              className="rounded-full"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-indigo-500/30 flex items-center justify-center text-xs font-semibold text-indigo-300">
              {user.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {user.name && (
              <p className="text-xs font-medium text-gray-300 truncate">{user.name}</p>
            )}
            {user.email && (
              <p className="text-[10px] text-gray-600 truncate">{user.email}</p>
            )}
          </div>
          <button
            onClick={() => { if (!signingOut) { setSigningOut(true); signOut({ callbackUrl: '/finance-hub' }) } }}
            disabled={signingOut}
            title="Sign out"
            className="p-1.5 rounded-md hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors shrink-0 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {signingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          </button>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          {/* Language toggle */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">Language</p>
            <div className="flex items-center bg-white/5 rounded-md p-0.5">
              {(['en', 'he'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded transition-colors',
                    lang === l
                      ? 'bg-indigo-500/30 text-indigo-300 font-medium'
                      : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  {l === 'en' ? 'EN' : 'עב'}
                </button>
              ))}
            </div>
          </div>

          {/* Currency toggle */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">v0.1.0</p>
            <div className="flex items-center bg-white/5 rounded-md p-0.5">
              {(['NIS', 'USD'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded transition-colors',
                    currency === c
                      ? 'bg-indigo-500/30 text-indigo-300 font-medium'
                      : 'text-gray-500 hover:text-gray-300'
                  )}
                >
                  {c === 'NIS' ? '₪' : '$'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
