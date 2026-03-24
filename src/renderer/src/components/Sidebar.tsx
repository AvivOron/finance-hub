import { LayoutDashboard, PlusCircle, Wallet, History } from 'lucide-react'
import { Page } from '../types'
import { cn } from '../utils'
import { useCurrency } from '../context/CurrencyContext'

interface SidebarProps {
  page: Page
  onNavigate: (page: Page) => void
}

const navItems: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'snapshot', label: 'Enter Snapshot', icon: PlusCircle },
  { id: 'accounts', label: 'Accounts', icon: Wallet },
  { id: 'history', label: 'History', icon: History }
]

export function Sidebar({ page, onNavigate }: SidebarProps) {
  const { currency, setCurrency } = useCurrency()
  return (
    <aside className="flex flex-col w-[220px] min-w-[220px] bg-[#0f0f18] border-r border-white/5 h-full">
      {/* Title bar spacer for traffic lights */}
      <div className="drag h-14 flex items-end pb-3 px-5">
        <div className="flex items-center gap-2.5 no-drag">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <span className="text-indigo-400 text-sm font-bold">₿</span>
          </div>
          <span className="text-sm font-semibold text-white/90 tracking-tight">NetWorth</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {navItems.map(({ id, label, icon: Icon }) => (
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
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/5 flex items-center justify-between">
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
    </aside>
  )
}
