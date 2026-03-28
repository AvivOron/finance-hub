'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, DollarSign, ArrowUpRight, ArrowDownRight, ChevronDown, X } from 'lucide-react'
import { AppData } from '../types'
import { formatCurrency, formatCurrencyShort, formatMonthLabel, formatMonthFull, cn } from '../utils'
import { useCurrency } from '../context/CurrencyContext'

interface DashboardProps {
  data: AppData
  onNavigate: (page: import('../types').Page) => void
}

function computeMonthStats(
  data: AppData,
  filterFamilyMembers?: Set<string>,
  filterAccountIds?: Set<string>
) {
  const sorted = [...data.snapshots].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((snapshot) => {
    let assets = 0
    let liabilities = 0
    for (const entry of snapshot.entries) {
      const account = data.accounts.find((a) => a.id === entry.accountId)
      if (!account) continue
      if (filterFamilyMembers && !filterFamilyMembers.has(account.owner || 'unassigned')) continue
      if (filterAccountIds && !filterAccountIds.has(account.id)) continue
      if (account.type === 'asset') assets += entry.balance
      else liabilities += entry.balance
    }
    return {
      date: snapshot.date,
      label: formatMonthLabel(snapshot.date),
      assets,
      liabilities,
      netWorth: assets - liabilities
    }
  })
}

const tooltipStyle = {
  backgroundColor: '#1a1a27',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  padding: '10px 14px'
}
const tooltipLabelStyle = { color: '#e5e7eb', fontWeight: 600, marginBottom: 4 }
const tooltipWrapperStyle = { outline: 'none' }
const tooltipCursor = { fill: 'rgba(255,255,255,0.05)' }

export function Dashboard({ data, onNavigate }: DashboardProps) {
  const { currency } = useCurrency()
  const fmt = (v: number) => formatCurrency(v, currency)
  const fmtShort = (v: number) => formatCurrencyShort(v, currency)

  const [selectedFamilyMembers, setSelectedFamilyMembers] = useState<Set<string>>(new Set())
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)

  const familyMembers = [...new Set(data.accounts.map((a) => a.owner).filter(Boolean) as string[])]
  const hasFilters = selectedFamilyMembers.size > 0 || selectedAccounts.size > 0

  const filterFamilyMembers = selectedFamilyMembers.size > 0 ? selectedFamilyMembers : undefined
  const filterAccountIds = selectedAccounts.size > 0 ? selectedAccounts : undefined

  const stats = computeMonthStats(data, filterFamilyMembers, filterAccountIds)
  const latest = stats[stats.length - 1]
  const prev = stats[stats.length - 2]

  const currentNetWorth = latest?.netWorth ?? 0
  const currentAssets = latest?.assets ?? 0
  const currentLiabilities = latest?.liabilities ?? 0
  const momChange = latest && prev ? latest.netWorth - prev.netWorth : null
  const momPct =
    momChange !== null && prev?.netWorth !== 0 ? (momChange / Math.abs(prev.netWorth)) * 100 : null

  const hasData = stats.length > 0

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          {latest && (
            <p className="text-sm text-gray-500 mt-0.5">As of {formatMonthFull(latest.date)}</p>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              hasFilters
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            )}
          >
            Filter
            {hasFilters && (
              <span className="ml-1 text-xs">{selectedFamilyMembers.size + selectedAccounts.size}</span>
            )}
            <ChevronDown size={14} />
          </button>
          {showFilters && (
            <div className="absolute right-0 mt-2 w-72 bg-[#14141f] border border-white/10 rounded-xl shadow-lg z-50">
              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {familyMembers.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-300 uppercase mb-2">Family Members</h3>
                    <div className="space-y-1.5">
                      {familyMembers.map((member) => (
                        <label key={member} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedFamilyMembers.has(member)}
                            onChange={(e) => {
                              const updated = new Set(selectedFamilyMembers)
                              if (e.target.checked) updated.add(member)
                              else updated.delete(member)
                              setSelectedFamilyMembers(updated)
                            }}
                            className="rounded w-4 h-4"
                          />
                          <span className="text-sm text-gray-300 group-hover:text-white">{member}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {data.accounts.length > 0 && (
                  <div className={familyMembers.length > 0 ? 'border-t border-white/10 pt-4' : ''}>
                    <h3 className="text-xs font-semibold text-gray-300 uppercase mb-2">Accounts</h3>
                    <div className="space-y-1.5">
                      {data.accounts.map((account) => (
                        <label key={account.id} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedAccounts.has(account.id)}
                            onChange={(e) => {
                              const updated = new Set(selectedAccounts)
                              if (e.target.checked) updated.add(account.id)
                              else updated.delete(account.id)
                              setSelectedAccounts(updated)
                            }}
                            className="rounded w-4 h-4"
                          />
                          <span className="text-sm text-gray-300 group-hover:text-white truncate">
                            {account.name}
                            {account.owner && (
                              <span className="text-gray-500 ml-1">({account.owner})</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {hasFilters && (
                  <div className="border-t border-white/10 pt-3">
                    <button
                      onClick={() => {
                        setSelectedFamilyMembers(new Set())
                        setSelectedAccounts(new Set())
                      }}
                      className="w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-200 py-1.5"
                    >
                      <X size={13} />
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className={`grid gap-4 ${currentLiabilities > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {currentLiabilities > 0 && (
          <SummaryCard
            label="Net Worth"
            value={fmt(currentNetWorth)}
            icon={<DollarSign size={18} />}
            accent="indigo"
            sub={
              momChange !== null ? (
                <span className={momChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {momChange >= 0 ? (
                    <ArrowUpRight size={13} className="inline" />
                  ) : (
                    <ArrowDownRight size={13} className="inline" />
                  )}
                  {fmtShort(Math.abs(momChange))}
                  {momPct !== null && ` (${momPct > 0 ? '+' : ''}${momPct.toFixed(1)}%)`}
                </span>
              ) : null
            }
          />
        )}
        <SummaryCard
          label="Total Assets"
          value={fmt(currentAssets)}
          icon={<TrendingUp size={18} />}
          accent="emerald"
        />
        {currentLiabilities > 0 && (
          <SummaryCard
            label="Total Liabilities"
            value={fmt(currentLiabilities)}
            icon={<TrendingDown size={18} />}
            accent="red"
          />
        )}
        <SummaryCard
          label="MoM Change"
          value={momChange !== null ? (momChange >= 0 ? '+' : '') + fmt(momChange) : '—'}
          icon={<Minus size={18} />}
          accent={momChange === null ? 'gray' : momChange >= 0 ? 'emerald' : 'red'}
          sub={
            momPct !== null ? (
              <span className={momChange! >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {momPct > 0 ? '+' : ''}
                {momPct.toFixed(1)}% vs last month
              </span>
            ) : null
          }
        />
      </div>

      {!hasData ? (
        <EmptyState onNavigate={onNavigate} />
      ) : (
        <>
          <ChartCard title="Net Worth Over Time">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={fmtShort}
                  width={72}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  wrapperStyle={tooltipWrapperStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(v) => [fmt(v as number), 'Net Worth']}
                  cursor={tooltipCursor}
                />
                <Line
                  type="monotone"
                  dataKey="netWorth"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {currentLiabilities > 0 && (
            <ChartCard title="Assets vs Liabilities">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={stats} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="colorLiabilities" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={fmtShort}
                    width={72}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    wrapperStyle={tooltipWrapperStyle}
                    labelStyle={tooltipLabelStyle}
                    cursor={tooltipCursor}
                    formatter={(v, name) => [
                      fmt(v as number),
                      name === 'assets' ? 'Assets' : 'Liabilities'
                    ]}
                  />
                  <Legend
                    formatter={(v) => (
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>
                        {v === 'assets' ? 'Assets' : 'Liabilities'}
                      </span>
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="assets"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#colorAssets)"
                  />
                  <Area
                    type="monotone"
                    dataKey="liabilities"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#colorLiabilities)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
  sub
}: {
  label: string
  value: string
  icon: React.ReactNode
  accent: 'indigo' | 'emerald' | 'red' | 'gray'
  sub?: React.ReactNode
}) {
  const accentMap = {
    indigo: 'text-indigo-400 bg-indigo-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    red: 'text-red-400 bg-red-500/10',
    gray: 'text-gray-400 bg-gray-500/10'
  }
  return (
    <div className="bg-[#14141f] border border-white/5 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <span className={`p-1.5 rounded-md ${accentMap[accent]}`}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      {sub && <div className="text-xs flex items-center gap-1">{sub}</div>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#14141f] border border-white/5 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-gray-300 mb-6">{title}</h2>
      {children}
    </div>
  )
}

function EmptyState({ onNavigate }: { onNavigate: (p: import('../types').Page) => void }) {
  return (
    <div className="bg-[#14141f] border border-white/5 rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
        <TrendingUp size={28} className="text-indigo-400" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-white">No data yet</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
          Add your accounts and record your first monthly snapshot to see your net worth trends.
        </p>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onNavigate('accounts')}
          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 font-medium transition-colors"
        >
          Set up accounts
        </button>
        <button
          onClick={() => onNavigate('snapshot')}
          className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm text-white font-medium transition-colors"
        >
          Enter first snapshot
        </button>
      </div>
    </div>
  )
}
