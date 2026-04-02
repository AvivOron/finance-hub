'use client'

import { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'
import { TrendingUp, Info } from 'lucide-react'
import { AppData, Account } from '@/types'
import { formatCurrencyShort, formatCurrency } from '@/utils'
import { useCurrency } from '@/context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { t } from '@/translations'
import { cn } from '@/utils'

interface ProjectionsProps {
  data: AppData
}

const YEAR_OPTIONS = [5, 10, 15, 20, 30]

const ACCOUNT_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6'
]

const tooltipStyle = {
  backgroundColor: '#1a1a27',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  padding: '10px 14px'
}

// Given a starting balance, compute year-by-year projection
function projectAccount(
  account: Account,
  startingBalance: number,
  years: number,
  annualInterestRate: number, // e.g. 0.07 for 7%
  includeDeposits: boolean,
  includeFees: boolean,
  inflationRate: number // e.g. 0.03 for 3%
): number[] {
  const results: number[] = []
  let balance = startingBalance

  const monthlyRate = annualInterestRate / 12
  const monthlyDeposit = includeDeposits ? (account.monthlyDeposit ?? 0) : 0
  const feesFixed = includeFees ? (account.feesFixed ?? 0) : 0
  const feesOnBalancePct = includeFees ? (account.feesOnBalance ?? 0) / 100 : 0
  const feesOnDepositPct = includeFees ? (account.feesOnDeposit ?? 0) / 100 : 0

  // liability balances should not grow through deposits/interest
  const isLiability = account.type === 'liability'

  for (let year = 1; year <= years; year++) {
    if (isLiability) {
      // liabilities: reduce by monthly deposit (payment), apply interest
      for (let m = 0; m < 12; m++) {
        const interestCharge = balance * monthlyRate
        balance = Math.max(0, balance + interestCharge - monthlyDeposit)
      }
    } else {
      // assets: compound monthly
      for (let m = 0; m < 12; m++) {
        const effectiveDeposit = monthlyDeposit * (1 - feesOnDepositPct)
        const growth = balance * monthlyRate
        balance = balance + growth + effectiveDeposit - feesFixed
        // annual fee on balance (charged monthly as 1/12)
        balance = balance * (1 - feesOnBalancePct / 12)
        if (balance < 0) balance = 0
      }
    }

    // optionally adjust for inflation (real terms)
    const inflationFactor = inflationRate > 0 ? Math.pow(1 + inflationRate, -year) : 1
    results.push(balance * inflationFactor)
  }

  return results
}

function getLatestBalance(account: Account, snapshots: AppData['snapshots']): number {
  if (!snapshots.length) return 0
  const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date))
  for (const snap of sorted) {
    const entry = snap.entries.find(e => e.accountId === account.id)
    if (entry !== undefined) return entry.balance
  }
  return 0
}

export function Projections({ data }: ProjectionsProps) {
  const { currency } = useCurrency()
  const { lang } = useLanguage()
  const T = (key: string) => t(key, lang)

  const assetAccounts = data.accounts.filter(a => a.type === 'asset')

  const [years, setYears] = useState(20)
  const [interestRate, setInterestRate] = useState(7)
  const [includeDeposits, setIncludeDeposits] = useState(true)
  const [includeFees, setIncludeFees] = useState(true)
  const [inflationAdjusted, setInflationAdjusted] = useState(false)
  const [inflationRate, setInflationRate] = useState(3)
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(
    () => new Set(assetAccounts.map(a => a.id))
  )
  const [showPerAccount, setShowPerAccount] = useState(false)

  const selectedAccounts = assetAccounts.filter(a => selectedAccountIds.has(a.id))

  function toggleAccount(id: string) {
    setSelectedAccountIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size > 1) next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleAll() {
    if (selectedAccountIds.size === assetAccounts.length) {
      // deselect all except first
      setSelectedAccountIds(new Set(assetAccounts.slice(0, 1).map(a => a.id)))
    } else {
      setSelectedAccountIds(new Set(assetAccounts.map(a => a.id)))
    }
  }

  const chartData = useMemo(() => {
    const annualRate = interestRate / 100
    const infRate = inflationAdjusted ? inflationRate / 100 : 0

    // per-account projections
    const perAccountData: Record<string, number[]> = {}
    for (const account of selectedAccounts) {
      const startBalance = getLatestBalance(account, data.snapshots)
      perAccountData[account.id] = projectAccount(
        account,
        startBalance,
        years,
        annualRate,
        includeDeposits,
        includeFees,
        infRate
      )
    }

    // total projection (sum of selected accounts)
    const totals = Array.from({ length: years }, (_, i) =>
      selectedAccounts.reduce((sum, acc) => sum + (perAccountData[acc.id]?.[i] ?? 0), 0)
    )

    return Array.from({ length: years }, (_, i) => {
      const point: Record<string, number | string> = {
        year: `Year ${i + 1}`,
        total: Math.round(totals[i])
      }
      for (const acc of selectedAccounts) {
        point[acc.id] = Math.round(perAccountData[acc.id]?.[i] ?? 0)
      }
      return point
    })
  }, [selectedAccounts, data.snapshots, years, interestRate, includeDeposits, includeFees, inflationAdjusted, inflationRate])

  // Summary stats
  const startingTotal = selectedAccounts.reduce(
    (sum, acc) => sum + getLatestBalance(acc, data.snapshots), 0
  )
  const totalDeposits = includeDeposits
    ? selectedAccounts.reduce((sum, acc) => sum + (acc.monthlyDeposit ?? 0), 0) * 12 * years
    : 0
  const finalValue = (chartData[chartData.length - 1]?.total as number) ?? 0
  const totalGrowth = finalValue - startingTotal - totalDeposits
  const growthPct = startingTotal > 0 ? ((finalValue - startingTotal) / startingTotal) * 100 : 0

  const hasDeposits = data.accounts.some(a => a.monthlyDeposit && a.monthlyDeposit > 0)
  const hasFees = data.accounts.some(a => (a.feesFixed ?? 0) > 0 || (a.feesOnBalance ?? 0) > 0 || (a.feesOnDeposit ?? 0) > 0)

  const tickFormatter = (v: number) => formatCurrencyShort(v, currency)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white/90">{T('projections.title')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{T('projections.subtitle')}</p>
      </div>

      {/* Controls */}
      <div className="bg-[#14141f] border border-white/5 rounded-xl p-5 space-y-5">
        <h2 className="text-sm font-medium text-gray-300">{T('projections.assumptions')}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Years */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500">{T('projections.timeHorizon')}</label>
            <div className="flex gap-1.5 flex-wrap">
              {YEAR_OPTIONS.map(y => (
                <button
                  key={y}
                  onClick={() => setYears(y)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    years === y
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-white/5 text-gray-400 border border-white/5 hover:text-gray-200 hover:bg-white/10'
                  )}
                >
                  {y}y
                </button>
              ))}
            </div>
          </div>

          {/* Interest rate */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500">{T('projections.annualReturn')}</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={20}
                step={0.5}
                value={interestRate}
                onChange={e => setInterestRate(parseFloat(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-sm font-mono text-indigo-300 w-12 text-right">{interestRate}%</span>
            </div>
            <div className="flex gap-1.5">
              {[4, 7, 10].map(r => (
                <button
                  key={r}
                  onClick={() => setInterestRate(r)}
                  className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors"
                >
                  {r}%
                </button>
              ))}
            </div>
          </div>

          {/* Inflation */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500">
              {T('projections.inflationAdjustment')}
              <span className={cn(
                'ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium',
                inflationAdjusted ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-gray-600'
              )}>
                {inflationAdjusted ? T('projections.inflationReal') : T('projections.inflationNominal')}
              </span>
            </label>
            <div className="flex items-center gap-3">
              <Toggle checked={inflationAdjusted} onChange={setInflationAdjusted} color="emerald" />
              {inflationAdjusted && (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    value={inflationRate}
                    onChange={e => setInflationRate(parseFloat(e.target.value))}
                    className="flex-1 accent-emerald-500"
                  />
                  <span className="text-sm font-mono text-emerald-300 w-10 text-right">{inflationRate}%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toggles row */}
        <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1 border-t border-white/5">
          <ToggleRow
            checked={includeDeposits}
            onChange={setIncludeDeposits}
            disabled={!hasDeposits}
            label={T('projections.toggleDeposits')}
            sub={hasDeposits
              ? T('projections.toggleDeposits.sub').replace('{amount}', formatCurrency(selectedAccounts.reduce((s, a) => s + (a.monthlyDeposit ?? 0), 0), currency))
              : T('projections.toggleDeposits.none')}
          />
          <ToggleRow
            checked={includeFees}
            onChange={setIncludeFees}
            disabled={!hasFees}
            label={T('projections.toggleFees')}
            sub={hasFees ? T('projections.toggleFees.sub') : T('projections.toggleFees.none')}
          />
          <ToggleRow
            checked={showPerAccount}
            onChange={setShowPerAccount}
            label={T('projections.toggleBreakdown')}
            className="ml-auto"
          />
        </div>
      </div>

      {/* Account selector */}
      {assetAccounts.length > 1 && (
        <div className="bg-[#14141f] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-300">{T('projections.accounts')}</h2>
            <button
              onClick={toggleAll}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {selectedAccountIds.size === assetAccounts.length ? T('projections.deselectAll') : T('projections.selectAll')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {assetAccounts.map((acc, i) => {
              const selected = selectedAccountIds.has(acc.id)
              const color = ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]
              const balance = getLatestBalance(acc, data.snapshots)
              return (
                <button
                  key={acc.id}
                  onClick={() => toggleAccount(acc.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-all',
                    selected
                      ? 'border-white/10 bg-white/5 text-gray-200'
                      : 'border-white/5 bg-transparent text-gray-600 hover:text-gray-400'
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: selected ? color : '#374151' }}
                  />
                  <span>{acc.name}</span>
                  {balance > 0 && (
                    <span className={cn('text-[10px]', selected ? 'text-gray-500' : 'text-gray-700')}>
                      {formatCurrencyShort(balance, currency)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label={T('projections.card.startingValue')}
          value={formatCurrencyShort(startingTotal, currency)}
          sub={T('projections.card.startingValue.sub').replace('{n}', String(selectedAccounts.length))}
          color="text-gray-200"
        />
        <SummaryCard
          label={T('projections.card.futureValue').replace('{n}', String(years))}
          value={formatCurrencyShort(finalValue, currency)}
          sub={inflationAdjusted ? T('projections.card.futureValue.inflationSub') : T('projections.card.futureValue.nominalSub')}
          color="text-indigo-300"
          highlight
        />
        <SummaryCard
          label={T('projections.card.deposited')}
          value={formatCurrencyShort(totalDeposits, currency)}
          sub={includeDeposits && hasDeposits ? T('projections.card.deposited.sub').replace('{n}', String(years)) : T('projections.card.deposited.excluded')}
          color={includeDeposits && hasDeposits ? 'text-emerald-300' : 'text-gray-600'}
        />
        <SummaryCard
          label={T('projections.card.growth')}
          value={totalGrowth >= 0 ? `+${formatCurrencyShort(totalGrowth, currency)}` : formatCurrencyShort(totalGrowth, currency)}
          sub={`${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(0)}% total`}
          color={totalGrowth >= 0 ? 'text-emerald-300' : 'text-red-400'}
        />
      </div>

      {/* Chart */}
      <div className="bg-[#14141f] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp size={15} className="text-indigo-400" />
          <h2 className="text-sm font-medium text-gray-300">
            {showPerAccount ? T('projections.chart.perAccount') : T('projections.chart.title')}
          </h2>
          {inflationAdjusted && (
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
              {T('projections.chart.realTerms').replace('{n}', String(inflationRate))}
            </span>
          )}
        </div>

        {chartData.length === 0 || startingTotal === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <Info size={24} className="text-gray-600 mb-2" />
            <p className="text-sm text-gray-500">{T('projections.empty.title')}</p>
            <p className="text-xs text-gray-600 mt-1">{T('projections.empty.sub')}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {showPerAccount ? (
                  selectedAccounts.map((acc, i) => {
                    const color = ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]
                    return (
                      <linearGradient key={acc.id} id={`grad-${acc.id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                      </linearGradient>
                    )
                  })
                ) : (
                  <linearGradient id="grad-total" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                )}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="year"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={Math.floor(years / 5) - 1}
              />
              <YAxis
                tickFormatter={tickFormatter}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}
                formatter={(value: number, name: string) => {
                  const acc = selectedAccounts.find(a => a.id === name)
                  return [formatCurrency(value, currency), acc ? acc.name : 'Total']
                }}
                cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
              />
              {showPerAccount ? (
                <>
                  <Legend
                    formatter={(value) => {
                      const acc = selectedAccounts.find(a => a.id === value)
                      return <span style={{ color: '#9ca3af', fontSize: 11 }}>{acc?.name ?? value}</span>
                    }}
                  />
                  {selectedAccounts.map((acc, i) => {
                    const color = ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]
                    return (
                      <Area
                        key={acc.id}
                        type="monotone"
                        dataKey={acc.id}
                        stroke={color}
                        strokeWidth={1.5}
                        fill={`url(#grad-${acc.id})`}
                        stackId="1"
                        dot={false}
                        activeDot={{ r: 4, fill: color }}
                      />
                    )
                  })}
                </>
              ) : (
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#grad-total)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#6366f1' }}
                  name="total"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Fee impact insight */}
      {hasFees && (
        <FeeImpactCard
          selectedAccounts={selectedAccounts}
          snapshots={data.snapshots}
          years={years}
          interestRate={interestRate / 100}
          includeDeposits={includeDeposits}
          currency={currency}
          lang={lang}
        />
      )}
    </div>
  )
}

function Toggle({ checked, onChange, color = 'indigo' }: {
  checked: boolean
  onChange: (v: boolean) => void
  color?: 'indigo' | 'emerald'
}) {
  const onColor = color === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500'
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex w-9 h-5 shrink-0 rounded-full transition-colors duration-200 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        checked ? onColor : 'bg-white/10'
      )}
    >
      <span
        className="pointer-events-none absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200"
        style={{ left: checked ? '18px' : '2px' }}
      />
    </button>
  )
}

function ToggleRow({ checked, onChange, disabled, label, sub, className }: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label: string
  sub?: string
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2.5', disabled && 'opacity-40', className)}>
      <Toggle checked={checked && !disabled} onChange={v => !disabled && onChange(v)} />
      <div>
        <p className="text-xs font-medium text-gray-300">{label}</p>
        {sub && <p className="text-[10px] text-gray-600">{sub}</p>}
      </div>
    </div>
  )
}

function SummaryCard({
  label, value, sub, color, highlight
}: {
  label: string
  value: string
  sub: string
  color: string
  highlight?: boolean
}) {
  return (
    <div className={cn(
      'rounded-xl p-4 border',
      highlight ? 'bg-indigo-500/5 border-indigo-500/15' : 'bg-[#14141f] border-white/5'
    )}>
      <p className="text-[11px] text-gray-500 mb-1">{label}</p>
      <p className={cn('text-lg font-semibold tabular-nums', color)}>{value}</p>
      <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>
    </div>
  )
}

function FeeImpactCard({
  selectedAccounts, snapshots, years, interestRate, includeDeposits, currency, lang
}: {
  selectedAccounts: Account[]
  snapshots: AppData['snapshots']
  years: number
  interestRate: number
  includeDeposits: boolean
  currency: ReturnType<typeof useCurrency>['currency']
  lang: string
}) {
  // Compare with fees vs without fees
  const withFees = selectedAccounts.reduce((sum, acc) => {
    const bal = getLatestBalance(acc, snapshots)
    const proj = projectAccount(acc, bal, years, interestRate, includeDeposits, true, 0)
    return sum + (proj[proj.length - 1] ?? 0)
  }, 0)

  const withoutFees = selectedAccounts.reduce((sum, acc) => {
    const bal = getLatestBalance(acc, snapshots)
    const proj = projectAccount(acc, bal, years, interestRate, includeDeposits, false, 0)
    return sum + (proj[proj.length - 1] ?? 0)
  }, 0)

  const feeCost = withoutFees - withFees
  if (feeCost <= 0) return null

  const title = t('projections.feeImpact.title', lang).replace('{n}', String(years))
  const body = t('projections.feeImpact.body', lang)
    .replace('{cost}', formatCurrencyShort(feeCost, currency))
    .replace('{without}', formatCurrencyShort(withoutFees, currency))
    .replace('{with}', formatCurrencyShort(withFees, currency))

  return (
    <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 flex items-start gap-3">
      <Info size={14} className="text-amber-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs font-medium text-amber-300">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{body}</p>
      </div>
    </div>
  )
}
