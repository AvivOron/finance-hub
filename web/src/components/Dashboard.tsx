'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, DollarSign, ArrowUpRight, ArrowDownRight, ChevronDown, X, Wallet, Receipt } from 'lucide-react'
import { AppData } from '../types'
import { formatCurrency, formatCurrencyShort, formatMonthLabel, formatMonthFull, cn } from '../utils'
import { useCurrency } from '../context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { t, tn } from '@/translations'

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
      else liabilities += Math.abs(entry.balance) // liabilities are now positive
    }
    return {
      date: snapshot.date,
      label: formatMonthLabel(snapshot.date),
      assets,
      liabilities,
      netWorth: assets - liabilities // liabilities are now positive
    }
  })
}

function computeMonthlyIncome(data: AppData): { net: number; gross: number } {
  const sources = (data.income ?? []).filter((s) => s.active)
  let net = 0
  let gross = 0
  for (const s of sources) {
    const factor = s.billingCycle === 'yearly' ? 1 / 12 : 1
    net += s.netAmount * factor
    gross += s.grossAmount * factor
  }
  return { net, gross }
}

function computeMonthlyExpenses(data: AppData): { total: number; byCategory: { category: string; amount: number }[] } {
  const active = (data.expenses ?? []).filter((e) => e.active)
  const byCategory: Record<string, number> = {}
  let total = 0
  for (const e of active) {
    const monthly = e.billingCycle === 'yearly' ? e.amount / 12 : e.amount
    total += monthly
    byCategory[e.category] = (byCategory[e.category] ?? 0) + monthly
  }
  const sorted = Object.entries(byCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
  return { total, byCategory: sorted }
}

const CATEGORY_COLORS: Record<string, string> = {
  housing: '#6366f1',
  childcare: '#ec4899',
  groceries: '#10b981',
  transport: '#f59e0b',
  utilities: '#3b82f6',
  insurance: '#8b5cf6',
  subscriptions: '#06b6d4',
  lifestyle: '#f97316',
  pets: '#84cc16',
  other: '#6b7280',
}

const INVESTMENT_COLORS = ['#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#06b6d4', '#14b8a6', '#f97316']

function normalizeCategory(category: string | undefined, name?: string): string {
  if (!category) {
    return 'Other'
  }
  const normalized = category.toLowerCase().trim()
  if (normalized.includes('אגח')) return 'אגרות חוב'
  if (normalized.includes('שקל')) return 'שקל'
  if (normalized.includes('מניות')) return 'מניות'
  return category
}

function computeInvestmentPortfolio(data: AppData): { name: string; value: number; category: string }[] {
  const holdings = data.accountHoldings ?? []
  const byCategory: Record<string, number> = {}

  for (const account of holdings) {
    for (const holding of account.holdings) {
      const category = normalizeCategory(holding.category, holding.name)
      byCategory[category] = (byCategory[category] ?? 0) + holding.valueNIS
    }
  }

  const totalValue = Object.values(byCategory).reduce((a, b) => a + b, 0)
  const minThreshold = totalValue * 0.02 // 2% minimum for visible slice

  const main: Array<{ name: string; value: number; category: string }> = []
  let otherValue = 0
  const otherCategories: string[] = []

  for (const [category, value] of Object.entries(byCategory)) {
    if (value >= minThreshold) {
      main.push({ name: category, value, category })
    } else {
      otherValue += value
      otherCategories.push(category)
    }
  }

  if (otherValue > 0) {
    main.push({ name: 'אחר', value: otherValue, category: 'OTHER_COMBINED' })
  }

  return main.sort((a, b) => b.value - a.value)
}

const tooltipStyle = {
  backgroundColor: '#a3a3ba',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  padding: '10px 14px'
}
const tooltipLabelStyle = { color: '#e5e7eb', fontWeight: 600, marginBottom: 4 }
const tooltipItemStyle = { color: '#d1d5db' }
const tooltipWrapperStyle = { outline: 'none' }
const tooltipCursor = { fill: 'rgba(255,255,255,0.05)' }

export function Dashboard({ data, onNavigate }: DashboardProps) {
  const { currency } = useCurrency()
  const { lang } = useLanguage()
  const fmt = (v: number) => formatCurrency(v, currency)
  const fmtShort = (v: number) => formatCurrencyShort(v, currency)

  const [selectedFamilyMembers, setSelectedFamilyMembers] = useState<Set<string>>(new Set())
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [selectedInvestmentCategory, setSelectedInvestmentCategory] = useState<string | null>(null)

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

  const { net: monthlyNetIncome, gross: monthlyGrossIncome } = computeMonthlyIncome(data)
  const { total: monthlyExpenses, byCategory: expensesByCategory } = computeMonthlyExpenses(data)
  const cashFlow = monthlyNetIncome > 0 ? monthlyNetIncome - monthlyExpenses : null
  const savingsRate = monthlyNetIncome > 0 && cashFlow !== null ? (cashFlow / monthlyNetIncome) * 100 : null
  const hasIncomeOrExpenses = monthlyNetIncome > 0 || monthlyExpenses > 0
  const debtToAsset = currentAssets > 0 && currentLiabilities > 0 ? (currentLiabilities / currentAssets) * 100 : null
  const investmentPortfolio = computeInvestmentPortfolio(data)
  const hasInvestments = investmentPortfolio.length > 0

  // Compute which categories are in the "OTHER" group
  const holdings = data.accountHoldings ?? []
  const byCategory: Record<string, number> = {}
  for (const account of holdings) {
    for (const holding of account.holdings) {
      const category = normalizeCategory(holding.category, holding.name)
      byCategory[category] = (byCategory[category] ?? 0) + holding.valueNIS
    }
  }
  const totalValue = Object.values(byCategory).reduce((a, b) => a + b, 0)
  const minThreshold = totalValue * 0.02
  const otherCategories = Object.entries(byCategory)
    .filter(([_, value]) => value < minThreshold)
    .map(([cat, _]) => cat)

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8 space-y-6 md:space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t('dashboard.title', lang)}</h1>
          {latest && (
            <p className="text-sm text-gray-500 mt-0.5">{t('dashboard.asOf', lang).replace('{month}', formatMonthFull(latest.date))}</p>
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
            {t('dashboard.filter.button', lang)}
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
                    <h3 className="text-xs font-semibold text-gray-300 uppercase mb-2">{t('dashboard.filter.familyMembersSection', lang)}</h3>
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
                    <h3 className="text-xs font-semibold text-gray-300 uppercase mb-2">{t('dashboard.filter.accountsSection', lang)}</h3>
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
                      {t('dashboard.filter.clearFilters', lang)}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className={`grid gap-3 grid-cols-2 ${currentLiabilities !== 0 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        {currentLiabilities !== 0 && (
          <SummaryCard
            label={t('dashboard.card.netWorth', lang)}
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
          label={t('dashboard.card.totalAssets', lang)}
          value={fmt(currentAssets)}
          icon={<TrendingUp size={18} />}
          accent="emerald"
          sub={
            debtToAsset !== null ? (
              <span className="text-gray-500">
                {debtToAsset.toFixed(1)}% {t('dashboard.card.debtToAsset', lang)}
              </span>
            ) : null
          }
        />
        {currentLiabilities !== 0 && (
          <SummaryCard
            label={t('dashboard.card.totalLiabilities', lang)}
            value={fmt(currentLiabilities)}
            icon={<TrendingDown size={18} />}
            accent="red"
          />
        )}
        <SummaryCard
          label={t('dashboard.card.momChange', lang)}
          value={momChange !== null ? (momChange >= 0 ? '+' : '') + fmt(momChange) : '—'}
          icon={<Minus size={18} />}
          accent={momChange === null ? 'gray' : momChange >= 0 ? 'emerald' : 'red'}
          sub={
            momPct !== null ? (
              <span className={momChange! >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {momPct > 0 ? '+' : ''}
                {momPct.toFixed(1)}% {t('dashboard.card.momPct', lang)}
              </span>
            ) : null
          }
        />
      </div>

      {/* Income & Expenses Cards */}
      {hasIncomeOrExpenses && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
          {monthlyNetIncome > 0 && (
            <SummaryCard
              label={t('dashboard.card.monthlyIncome', lang)}
              value={fmt(monthlyNetIncome)}
              icon={<Wallet size={18} />}
              accent="emerald"
              sub={
                monthlyGrossIncome !== monthlyNetIncome ? (
                  <span className="text-gray-500">
                    {fmtShort(monthlyGrossIncome)} {t('dashboard.card.grossLabel', lang)}
                  </span>
                ) : null
              }
            />
          )}
          {monthlyExpenses > 0 && (
            <SummaryCard
              label={t('dashboard.card.monthlyExpenses', lang)}
              value={fmt(monthlyExpenses)}
              icon={<Receipt size={18} />}
              accent="red"
            />
          )}
          {cashFlow !== null && (
            <SummaryCard
              label={t('dashboard.card.cashFlow', lang)}
              value={(cashFlow >= 0 ? '+' : '') + fmt(cashFlow)}
              icon={cashFlow >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
              accent={cashFlow >= 0 ? 'emerald' : 'red'}
              sub={
                savingsRate !== null ? (
                  <span className={cashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {savingsRate.toFixed(1)}% {t('dashboard.card.savingsRate', lang)}
                  </span>
                ) : null
              }
            />
          )}
        </div>
      )}

      {!hasData ? (
        <EmptyState onNavigate={onNavigate} lang={lang} />
      ) : (
        <>
          <ChartCard title={t('dashboard.chart.netWorth', lang)}>
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
                  formatter={(v) => [fmt(v as number), t('dashboard.chart.netWorthTooltip', lang)]}
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

          {currentLiabilities !== 0 && (
            <ChartCard title={t('dashboard.chart.assetsVsLiabilities', lang)}>
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
                      name === 'assets' ? t('dashboard.chart.assetsLegend', lang) : t('dashboard.chart.liabilitiesLegend', lang)
                    ]}
                  />
                  <Legend
                    formatter={(v) => (
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>
                        {v === 'assets' ? t('dashboard.chart.assetsLegend', lang) : t('dashboard.chart.liabilitiesLegend', lang)}
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

          {expensesByCategory.length > 0 && (
            <ChartCard title={t('dashboard.chart.expenseBreakdown', lang)}>
              <div dir="ltr">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={expensesByCategory}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={fmtShort}
                    width={60}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                    tickFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    wrapperStyle={tooltipWrapperStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    cursor={tooltipCursor}
                    formatter={(v) => fmt(v as number)}
                    labelFormatter={(label: string) => label.charAt(0).toUpperCase() + label.slice(1)}
                  />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                    {expensesByCategory.map((entry) => (
                      <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            </ChartCard>
          )}

          {hasInvestments && (
            <>
            <ChartCard title={t('dashboard.chart.investmentBreakdown', lang)}>
              <div dir="ltr">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Pie
                    data={investmentPortfolio}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => {
                      const pct = percent * 100
                      return `${name} ${pct < 1 ? pct.toFixed(1) : pct.toFixed(0)}%`
                    }}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    onClick={(entry) => setSelectedInvestmentCategory(entry.category)}
                  >
                    {investmentPortfolio.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={INVESTMENT_COLORS[index % INVESTMENT_COLORS.length]}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    wrapperStyle={tooltipWrapperStyle}
                    formatter={(v) => fmt(v as number)}
                  />
                </PieChart>
              </ResponsiveContainer>
              </div>
            </ChartCard>

            {selectedInvestmentCategory && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-[#14141f] border border-white/10 rounded-xl max-w-2xl w-full max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white">{selectedInvestmentCategory}</h3>
                    <button
                      onClick={() => setSelectedInvestmentCategory(null)}
                      className="text-gray-400 hover:text-white transition"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-6 space-y-3">
                    {(() => {
                      const categoryHoldings: Array<{ holding: any; accountName: string }> = []
                      const accs = data.accountHoldings ?? []

                      for (const account of accs) {
                        const accountName = data.accounts.find((a) => a.id === account.accountId)?.name || 'Unknown Account'
                        for (const holding of account.holdings) {
                          const normalizedHoldingCategory = normalizeCategory(holding.category, holding.name)
                          if (selectedInvestmentCategory === 'OTHER_COMBINED') {
                            // Show all holdings in otherCategories
                            if (otherCategories.includes(normalizedHoldingCategory)) {
                              categoryHoldings.push({ holding, accountName })
                            }
                          } else if (normalizedHoldingCategory === selectedInvestmentCategory) {
                            categoryHoldings.push({ holding, accountName })
                          }
                        }
                      }
                      return categoryHoldings.map(({ holding, accountName }, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white">{holding.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{holding.paperNumber} • {accountName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-white">{fmt(holding.valueNIS)}</p>
                            <p className={`text-xs mt-0.5 ${holding.gainFromCostPct > 0 ? 'text-emerald-400' : holding.gainFromCostPct < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                              {holding.gainFromCostPct > 0 ? '+' : ''}{holding.gainFromCostPct.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              </div>
            )}
            </>
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
    <div className="bg-[#14141f] border border-white/5 rounded-xl p-4 md:p-5 space-y-2 md:space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <span className={`p-1.5 rounded-md ${accentMap[accent]}`}>{icon}</span>
      </div>
      <div className="text-xl md:text-2xl font-bold text-white tracking-tight">{value}</div>
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

function EmptyState({ onNavigate, lang }: { onNavigate: (p: import('../types').Page) => void; lang: string }) {
  return (
    <div className="bg-[#14141f] border border-white/5 rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
        <TrendingUp size={28} className="text-indigo-400" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-white">{t('dashboard.empty.title', lang)}</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-xs">
          {t('dashboard.empty.message', lang)}
        </p>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onNavigate('accounts')}
          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 font-medium transition-colors"
        >
          {t('dashboard.empty.setupAccounts', lang)}
        </button>
        <button
          onClick={() => onNavigate('snapshot')}
          className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm text-white font-medium transition-colors"
        >
          {t('dashboard.empty.firstSnapshot', lang)}
        </button>
      </div>
    </div>
  )
}
