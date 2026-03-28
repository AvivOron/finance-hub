'use client'

import Image from 'next/image'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  PlusCircle,
  Wallet,
  History,
  Settings as SettingsIcon,
  Receipt,
  TrendingUp,
  Sparkles,
  LogOut
} from 'lucide-react'
import { Page } from '../types'
import { cn } from '../utils'
import { useCurrency } from '../context/CurrencyContext'

interface SidebarProps {
  page: Page
  onNavigate: (page: Page) => void
  open?: boolean
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

const trackingItems: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'accounts', label: 'Accounts', icon: Wallet },
  { id: 'snapshot', label: 'Enter Snapshot', icon: PlusCircle },
  { id: 'history', label: 'History', icon: History }
]

const expenseItems: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'income', label: 'Income', icon: TrendingUp },
  { id: 'insights', label: 'AI Insights', icon: Sparkles }
]

const settingItems: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'settings', label: 'Settings', icon: SettingsIcon }
]

export function Sidebar({ page, onNavigate, open, user }: SidebarProps) {
  const { currency, setCurrency } = useCurrency()

  return (
    <aside className={cn(
      'flex flex-col w-[220px] min-w-[220px] bg-[#0f0f18] border-r border-white/5 h-full',
      'fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:relative md:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full'
    )}>
      {/* Title */}
      <div className="h-16 flex flex-col justify-center px-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-white/90 tracking-tight">Finance Hub</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {/* Tracking Section */}
        <div>
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide px-3 py-2 mb-2">
            Worth Tracking
          </h3>
          <div className="space-y-0.5">
            {trackingItems.map(({ id, label, icon: Icon }) => (
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
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Management Section */}
        <div className="pt-2 border-t border-white/5">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide px-3 py-2 mb-2">
            Management
          </h3>
          <div className="space-y-0.5">
            {expenseItems.map(({ id, label, icon: Icon }) => (
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
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Section */}
        <div className="pt-2 border-t border-white/5">
          <div className="space-y-0.5">
            {settingItems.map(({ id, label, icon: Icon }) => (
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
                {label}
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
            onClick={() => signOut({ callbackUrl: '/finance-hub' })}
            title="Sign out"
            className="p-1.5 rounded-md hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
          >
            <LogOut size={14} />
          </button>
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
    </aside>
  )
}
