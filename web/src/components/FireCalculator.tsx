'use client'

import { useEffect, useMemo, useState } from 'react'
import { Flame, Info } from 'lucide-react'
import { AppData } from '@/types'
import { formatCurrency, formatCurrencyShort } from '@/utils'
import { useCurrency } from '@/context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { t } from '@/translations'
import { cn } from '@/utils'

type TxSummary = { byExpense: Record<string, Record<string, number>>; byCategory: Record<string, Record<string, number>> } | null

interface FireCalculatorProps {
  data: AppData
  txSummary: TxSummary
}

const FALLBACK_USD_TO_NIS = 3.5

function toNIS(amount: number, rate: number, currency: 'NIS' | 'USD') {
  return currency === 'USD' ? amount * rate : amount
}

function fromNIS(amount: number, rate: number, currency: 'NIS' | 'USD') {
  return currency === 'USD' ? amount / rate : amount
}

function getLatestNetWorth(data: AppData): number {
  if (!data.snapshots.length) return 0
  const sorted = [...data.snapshots].sort((a, b) => b.date.localeCompare(a.date))
  const latest = sorted[0]
  const accountMap = new Map(data.accounts.map(a => [a.id, a]))
  let total = 0
  for (const entry of latest.entries) {
    const account = accountMap.get(entry.accountId)
    if (!account) continue
    total += account.type === 'liability' ? -entry.balance : entry.balance
  }
  return total
}

function rollingAvg12(byMonth: Record<string, number>): number {
  const months = Object.keys(byMonth).sort().slice(-12)
  if (!months.length) return 0
  const total = months.reduce((s, m) => s + byMonth[m], 0)
  return total / months.length
}

function getMonthlyExpenses(data: AppData, txSummary: TxSummary): number {
  const recurring = (data.expenses || [])
    .filter(e => e.active)
    .reduce((sum, e) => sum + (e.billingCycle === 'yearly' ? e.amount / 12 : e.amount), 0)

  const variableAvg = getVariableExpensesAvg(data, txSummary)

  return recurring + variableAvg
}

function getVariableExpensesAvg(data: AppData, txSummary: TxSummary): number {
  if (!txSummary || !data.variableExpenses?.length) return 0
  const variableIds = new Set(data.variableExpenses.filter(e => e.active).map(e => e.id))
  const combined: Record<string, number> = {}
  for (const [id, byMonth] of Object.entries(txSummary.byExpense)) {
    if (!variableIds.has(id)) continue
    for (const [month, amt] of Object.entries(byMonth)) {
      combined[month] = (combined[month] ?? 0) + amt
    }
  }
  return rollingAvg12(combined)
}

function getMonthlyIncome(data: AppData): number {
  return (data.income || [])
    .filter(s => s.active !== false)
    .reduce((sum, s) => sum + (s.billingCycle === 'yearly' ? s.netAmount / 12 : s.netAmount), 0)
}

export function FireCalculator({ data, txSummary }: FireCalculatorProps) {
  const { currency } = useCurrency()
  const { lang } = useLanguage()

  const [usdToNis, setUsdToNis] = useState(FALLBACK_USD_TO_NIS)

  useEffect(() => {
    fetch('/api/exchange-rate')
      .then(r => r.json())
      .then(j => { if (j.rate) setUsdToNis(j.rate) })
      .catch(() => {})
  }, [])

  // Derived defaults (in NIS internally, displayed in user's currency)
  const defaultNetWorthNIS = getLatestNetWorth(data)
  const defaultExpensesNIS = getMonthlyExpenses(data, txSummary)
  const defaultIncomeNIS = getMonthlyIncome(data)

  const defaultNetWorth = Math.round(fromNIS(defaultNetWorthNIS, usdToNis, currency))
  const defaultMonthlyExpenses = Math.round(fromNIS(defaultExpensesNIS, usdToNis, currency))
  const defaultMonthlySavings = Math.max(0, Math.round(fromNIS(defaultIncomeNIS - defaultExpensesNIS, usdToNis, currency)))

  const [monthlyExpenses, setMonthlyExpenses] = useState<string>(
    defaultMonthlyExpenses > 0 ? String(defaultMonthlyExpenses) : ''
  )
  const [currentNetWorth, setCurrentNetWorth] = useState<string>(
    defaultNetWorth > 0 ? String(defaultNetWorth) : ''
  )
  const [withdrawalRate, setWithdrawalRate] = useState<string>('4')
  const [annualReturn, setAnnualReturn] = useState<string>('7')
  const [inflationRate, setInflationRate] = useState<string>('3')
  const [monthlyContribution, setMonthlyContribution] = useState<string>(
    defaultMonthlySavings > 0 ? String(defaultMonthlySavings) : ''
  )

  const results = useMemo(() => {
    const expenses = parseFloat(monthlyExpenses) || 0
    const netWorth = parseFloat(currentNetWorth) || 0
    const wr = (parseFloat(withdrawalRate) || 4) / 100
    const returnRate = (parseFloat(annualReturn) || 7) / 100
    const inflation = (parseFloat(inflationRate) || 3) / 100
    const contribution = parseFloat(monthlyContribution) || 0

    if (expenses <= 0) return null

    const annualExpenses = expenses * 12
    const fiNumber = annualExpenses / wr

    const gap = fiNumber - netWorth
    const currentProgress = netWorth >= fiNumber ? 100 : Math.max(0, (netWorth / fiNumber) * 100)

    // Real return rate (Fisher equation)
    const realReturn = (1 + returnRate) / (1 + inflation) - 1
    const monthlyRealReturn = realReturn / 12

    // Years to FI — solve for n in FV formula with contributions
    let yearsToFI: number | null = null
    if (netWorth >= fiNumber) {
      yearsToFI = 0
    } else if (contribution > 0 || netWorth > 0) {
      // Iterate month by month
      let balance = netWorth
      let months = 0
      const maxMonths = 12 * 100
      while (balance < fiNumber && months < maxMonths) {
        balance = balance * (1 + monthlyRealReturn) + contribution
        months++
      }
      yearsToFI = months < maxMonths ? months / 12 : null
    }

    // Coast FIRE — amount needed today that grows to FI number without contributions
    const coastFIRE =
      yearsToFI !== null && yearsToFI > 0
        ? fiNumber / Math.pow(1 + returnRate, yearsToFI)
        : null

    // Lean FIRE (75% of current spending) and Fat FIRE (150%)
    const leanFI = (annualExpenses * 0.75) / wr
    const fatFI = (annualExpenses * 1.5) / wr

    // Monthly safe withdrawal once at FI
    const monthlyWithdrawal = (fiNumber * wr) / 12

    return {
      fiNumber,
      gap: Math.max(0, gap),
      currentProgress,
      yearsToFI,
      annualExpenses,
      leanFI,
      fatFI,
      coastFIRE,
      monthlyWithdrawal,
    }
  }, [monthlyExpenses, currentNetWorth, withdrawalRate, annualReturn, inflationRate, monthlyContribution])

  const fmt = (n: number) => formatCurrencyShort(n, currency)
  const fmtFull = (n: number) => formatCurrency(n, currency)
  const currSymbol = currency === 'NIS' ? '₪' : '$'

  return (
    <div className="w-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
          <Flame size={18} className="text-orange-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-white">{t('fire.title', lang)}</h1>
            <a
              href="https://en.wikipedia.org/wiki/FIRE_movement"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
            >
              Wikipedia ↗
            </a>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{t('fire.subtitle', lang)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="bg-[#14141f] border border-white/5 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white/80">{t('fire.inputs', lang)}</h2>

          <div className="space-y-3">
            <InputRow
              label={t('fire.monthlyExpenses', lang)}
              hint={t('fire.monthlyExpenses.hint', lang)}
              value={monthlyExpenses}
              onChange={setMonthlyExpenses}
              prefix={currSymbol}
            />
            <InputRow
              label={t('fire.currentNetWorth', lang)}
              hint={t('fire.currentNetWorth.hint', lang)}
              value={currentNetWorth}
              onChange={setCurrentNetWorth}
              prefix={currSymbol}
            />
            <InputRow
              label={t('fire.monthlyContribution', lang)}
              hint={t('fire.monthlyContribution.hint', lang)}
              value={monthlyContribution}
              onChange={setMonthlyContribution}
              prefix={currSymbol}
            />
            <InputRow
              label={t('fire.withdrawalRate', lang)}
              hint={t('fire.withdrawalRate.hint', lang)}
              value={withdrawalRate}
              onChange={setWithdrawalRate}
              suffix="%"
              step="0.1"
            />
            <InputRow
              label={t('fire.annualReturn', lang)}
              hint={t('fire.annualReturn.hint', lang)}
              value={annualReturn}
              onChange={setAnnualReturn}
              suffix="%"
              step="0.1"
            />
            <InputRow
              label={t('fire.inflationRate', lang)}
              hint={t('fire.inflationRate.hint', lang)}
              value={inflationRate}
              onChange={setInflationRate}
              suffix="%"
              step="0.1"
            />
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {!results ? (
            <div className="bg-[#14141f] border border-white/5 rounded-2xl p-8 flex items-center justify-center h-full">
              <p className="text-sm text-gray-500 text-center">{t('fire.enterExpenses', lang)}</p>
            </div>
          ) : (
            <>
              {/* FI Number card */}
              <div className="bg-[#14141f] border border-white/5 rounded-2xl p-5">
                <p className="text-xs text-gray-500 mb-1">{t('fire.fiNumber', lang)}</p>
                <p className="text-3xl font-bold text-white">{fmt(results.fiNumber)}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {t('fire.annualSpend', lang)}: {fmtFull(results.annualExpenses)}
                  {' · '}{withdrawalRate}% {t('fire.withdrawalRule', lang)}
                </p>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                    <span>{t('fire.progress', lang)}</span>
                    <span>{results.currentProgress.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, results.currentProgress)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>{fmt(parseFloat(currentNetWorth) || 0)}</span>
                    <span>{fmt(results.fiNumber)}</span>
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label={t('fire.yearsToFI', lang)}
                  value={
                    results.yearsToFI === 0
                      ? t('fire.alreadyFI', lang)
                      : results.yearsToFI === null
                      ? '—'
                      : results.yearsToFI < 1
                      ? `< 1 ${t('fire.year', lang)}`
                      : `${results.yearsToFI.toFixed(1)} ${t('fire.years', lang)}`
                  }
                  accent="orange"
                />
                <StatCard
                  label={t('fire.gap', lang)}
                  value={results.gap === 0 ? '🎉' : fmt(results.gap)}
                  accent="indigo"
                />
                <StatCard
                  label={t('fire.leanFIRE', lang)}
                  value={fmt(results.leanFI)}
                  sub="75% spending"
                  accent="green"
                  tooltip={t('fire.leanFIRE.tooltip', lang)}
                />
                <StatCard
                  label={t('fire.fatFIRE', lang)}
                  value={fmt(results.fatFI)}
                  sub="150% spending"
                  accent="purple"
                  tooltip={t('fire.fatFIRE.tooltip', lang)}
                />
                {results.coastFIRE !== null && results.coastFIRE > 0 && (
                  <StatCard
                    label={t('fire.coastFIRE', lang)}
                    value={fmt(results.coastFIRE)}
                    sub={t('fire.coastFIRE.sub', lang)}
                    accent="cyan"
                    wide
                    tooltip={t('fire.coastFIRE.tooltip', lang)}
                  />
                )}
              </div>

              {/* Disclaimer */}
              <div className="flex gap-2 bg-white/3 rounded-xl p-3">
                <Info size={14} className="text-gray-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-600 leading-relaxed">{t('fire.disclaimer', lang)}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function InputRow({
  label,
  hint,
  value,
  onChange,
  prefix,
  suffix,
  step = '1',
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  prefix?: string
  suffix?: string
  step?: string
}) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <label className="text-xs text-gray-400">{label}</label>
        {hint && (
          <span className="group relative">
            <Info size={11} className="text-gray-700 cursor-help" />
            <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block w-48 text-[10px] text-gray-400 bg-[#1e1e30] border border-white/10 rounded-lg px-2.5 py-1.5 z-10 shadow-lg">
              {hint}
            </span>
          </span>
        )}
      </div>
      <div className="flex items-center bg-white/5 border border-white/8 rounded-lg overflow-hidden">
        {prefix && (
          <span className="px-3 text-sm text-gray-500 border-r border-white/8">{prefix}</span>
        )}
        <input
          type="number"
          step={step}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-transparent px-3 py-1.5 text-sm text-white outline-none placeholder:text-gray-600"
          placeholder="0"
        />
        {suffix && (
          <span className="px-3 text-sm text-gray-500 border-l border-white/8">{suffix}</span>
        )}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub,
  accent,
  wide,
  tooltip,
}: {
  label: string
  value: string
  sub?: string
  accent: 'orange' | 'indigo' | 'green' | 'purple' | 'cyan'
  wide?: boolean
  tooltip?: string
}) {
  const accentClass: Record<string, string> = {
    orange: 'text-orange-400',
    indigo: 'text-indigo-400',
    green: 'text-emerald-400',
    purple: 'text-purple-400',
    cyan: 'text-cyan-400',
  }
  return (
    <div className={cn('bg-[#14141f] border border-white/5 rounded-xl p-4', wide && 'col-span-2')}>
      <div className="flex items-center gap-1 mb-1">
        <p className="text-xs text-gray-500">{label}</p>
        {tooltip && (
          <span className="group relative">
            <Info size={11} className="text-gray-700 cursor-help" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-52 text-[10px] text-gray-400 bg-[#1e1e30] border border-white/10 rounded-lg px-2.5 py-1.5 z-10 shadow-lg">
              {tooltip}
            </span>
          </span>
        )}
      </div>
      <p className={cn('text-lg font-bold', accentClass[accent])}>{value}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}
