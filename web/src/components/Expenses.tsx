'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Plus, Pencil, Trash2, X, Check,
  RefreshCw,
  ToggleLeft, ToggleRight, TrendingUp, AlertTriangle
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts'
import { RecurringExpense, VariableExpense, ExpenseCategory, FamilyMember } from '../types'
import { generateId, formatCurrency, formatCurrencyShort, cn } from '../utils'
import { useCurrency } from '../context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { t, tn } from '@/translations'
import { Modal } from './Accounts'
import { useCategories, CategoryConfigMap } from '@/hooks/useCategories'

interface ExpensesProps {
  expenses: RecurringExpense[]
  variableExpenses: VariableExpense[]
  familyMembers: FamilyMember[]
  onSave: (expenses: RecurringExpense[]) => Promise<void>
  onSaveVariable: (expenses: VariableExpense[]) => Promise<void>
  txSummary: { byExpense: Record<string, Record<string, number>>; byCategory: Record<string, Record<string, number>> } | null
}

type FormState = {
  name: string
  amount: string
  category: ExpenseCategory
  billingCycle: 'monthly' | 'yearly'
  owner: string
  notes: string
}

const emptyForm: FormState = {
  name: '',
  amount: '',
  category: 'other',
  billingCycle: 'monthly',
  owner: '',
  notes: ''
}

function monthlyAmount(expense: RecurringExpense): number {
  return expense.billingCycle === 'yearly' ? expense.amount / 12 : expense.amount
}

function calculateCategoryData(expenses: RecurringExpense[], categoryConfig: CategoryConfigMap) {
  const active = expenses.filter((e) => e.active)
  const byCategory = active.reduce<Record<string, number>>((acc, expense) => {
    const amount = monthlyAmount(expense)
    acc[expense.category] = (acc[expense.category] ?? 0) + amount
    return acc
  }, {})
  return Object.entries(byCategory)
    .map(([category, amount]) => ({
      name: category,
      amount,
      label: categoryConfig[category]?.label ?? category
    }))
    .sort((a, b) => b.amount - a.amount)
}

// Rolling average — returns null if fewer than `months` months of data exist (for labeled avg columns)
function rollingAvg(byMonth: Record<string, number>, months: number): number | null {
  const sorted = Object.keys(byMonth).sort().slice(-months)
  if (sorted.length < months) return null
  const sum = sorted.reduce((s, m) => s + byMonth[m], 0)
  return sum / months
}

// Best-effort average over whatever data exists, up to `months` months (for chart/summary)
function rollingAvgBestEffort(byMonth: Record<string, number>, months: number): number | null {
  const sorted = Object.keys(byMonth).sort().slice(-months)
  if (sorted.length === 0) return null
  const sum = sorted.reduce((s, m) => s + byMonth[m], 0)
  return sum / sorted.length
}

export function Expenses({ expenses, variableExpenses, familyMembers: rawFamilyMembers, onSave, onSaveVariable, txSummary }: ExpensesProps) {
  const { currency } = useCurrency()
  const { lang } = useLanguage()
  const { categoryConfig: resolvedConfig, categories: resolvedCategories } = useCategories()
  const fmt = (v: number) => formatCurrency(v, currency)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null)
  const [ignoredDrift, setIgnoredDrift] = useState<Set<string>>(new Set())

  // Variable expenses state
  const [showVarModal, setShowVarModal] = useState(false)
  const [editingVarId, setEditingVarId] = useState<string | null>(null)
  const [varForm, setVarForm] = useState<{ name: string; category: ExpenseCategory; owner: string }>({ name: '', category: 'other', owner: '' })
  const [varDeleteConfirm, setVarDeleteConfirm] = useState<string | null>(null)
  const [savingVar, setSavingVar] = useState(false)
  const [showVariable, setShowVariable] = useState(true)
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const familyMembers: FamilyMember[] = rawFamilyMembers.map((m: any) =>
    typeof m === 'string' ? { name: m, isChild: false } : (m as FamilyMember)
  )

  const filteredExpenses = selectedOwner
    ? expenses.filter((e) => e.owner === selectedOwner)
    : expenses

  const filteredVariableExpenses = selectedOwner
    ? variableExpenses.filter((e) => e.owner === selectedOwner)
    : variableExpenses

  const activeExpenses = filteredExpenses.filter((e) => e.active)
  const totalMonthly = activeExpenses.reduce((sum, e) => sum + monthlyAmount(e), 0)
  const totalYearly = totalMonthly * 12
  const categoryData = calculateCategoryData(filteredExpenses, resolvedConfig)

  // Compute 12-month average of all variable spending (mapped variable expenses + unmapped categories)
  const variableExpenseIds = new Set(filteredVariableExpenses.map(e => e.id))
  const avgVariable = (() => {
    if (!txSummary) return null
    // Merge monthly totals: only variable expense mappings (not recurring) + unmapped categories
    const combined: Record<string, number> = {}
    for (const [expenseId, byMonth] of Object.entries(txSummary.byExpense)) {
      if (!variableExpenseIds.has(expenseId)) continue
      for (const [month, amt] of Object.entries(byMonth)) {
        combined[month] = (combined[month] ?? 0) + amt
      }
    }
    return rollingAvgBestEffort(combined, 12)
  })()

  // Per-category avg for chart stacking (mapped variable expenses + unmapped)
  const varAvgByCategory = (() => {
    if (!txSummary) return {} as Record<string, number>
    const result: Record<string, number> = {}
    // byExpense = mapped variable expenses; use their category from variableExpenses list
    for (const ve of filteredVariableExpenses) {
      const byMonth = txSummary.byExpense[ve.id]
      if (!byMonth) continue
      const avg = rollingAvgBestEffort(byMonth, 12)
      if (avg != null) result[ve.category] = (result[ve.category] ?? 0) + avg
    }
    return result
  })()

  const chartData = categoryData.map(d => ({
    ...d,
    varAmount: varAvgByCategory[d.name] ?? 0
  }))
  // Also add variable-only categories not in recurring
  for (const [cat, avg] of Object.entries(varAvgByCategory)) {
    if (!chartData.find(d => d.name === cat)) {
      chartData.push({
        name: cat,
        amount: 0,
        label: resolvedConfig[cat]?.label ?? cat,
        varAmount: avg
      })
    }
  }
  chartData.sort((a, b) => (b.amount + b.varAmount) - (a.amount + a.varAmount))

  // Group by category slug — don't depend on resolvedCategories being loaded
  const byCategory = filteredExpenses.reduce<Record<string, RecurringExpense[]>>((acc, e) => {
    acc[e.category] = acc[e.category] ?? []
    acc[e.category].push(e)
    return acc
  }, {})
  // Order: DB order when loaded, otherwise whatever order slugs appear in data
  const orderedCategories = resolvedCategories.length > 0
    ? resolvedCategories.filter(cat => byCategory[cat])
    : Object.keys(byCategory)

  // Find last month that has any recurring expense transaction data
  const lastTxMonth = (() => {
    if (!txSummary) return null
    let latest = ''
    for (const byMonth of Object.values(txSummary.byExpense)) {
      for (const month of Object.keys(byMonth)) {
        if (month > latest) latest = month
      }
    }
    return latest || null
  })()

  // Per-expense drift: { expenseId -> { actual, set, pctDiff } }
  const driftWarnings = (() => {
    if (!txSummary || !lastTxMonth) return {} as Record<string, { actual: number; set: number; pct: number }>
    const result: Record<string, { actual: number; set: number; pct: number }> = {}
    for (const expense of expenses) {
      if (!expense.active) continue
      if (ignoredDrift.has(expense.id)) continue
      const byMonth = txSummary.byExpense[expense.id]
      if (!byMonth || byMonth[lastTxMonth] == null) continue
      const actual = byMonth[lastTxMonth]
      const set = monthlyAmount(expense)
      if (set === 0) continue
      const pct = Math.abs((actual - set) / set) * 100
      if (pct > 10) result[expense.id] = { actual, set, pct }
    }
    return result
  })()

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEdit(expense: RecurringExpense) {
    setEditingId(expense.id)
    setForm({
      name: expense.name,
      amount: String(expense.amount),
      category: expense.category,
      billingCycle: expense.billingCycle,
      owner: expense.owner ?? '',
      notes: expense.notes ?? ''
    })
    setShowModal(true)
  }

  async function handleSave() {
    const parsed = parseFloat(form.amount)
    if (!form.name.trim() || isNaN(parsed) || parsed <= 0) return
    setSaving(true)
    try {
      let updated: RecurringExpense[]
      if (editingId) {
        updated = expenses.map((e) =>
          e.id === editingId
            ? {
                ...e,
                name: form.name.trim(),
                amount: parsed,
                category: form.category,
                billingCycle: form.billingCycle,
                owner: form.owner || undefined,
                notes: form.notes.trim() || undefined
              }
            : e
        )
      } else {
        const newExpense: RecurringExpense = {
          id: generateId(),
          name: form.name.trim(),
          amount: parsed,
          category: form.category,
          billingCycle: form.billingCycle,
          owner: form.owner || undefined,
          notes: form.notes.trim() || undefined,
          active: true
        }
        updated = [...expenses, newExpense]
      }
      await onSave(updated)
      setShowModal(false)
    } catch (err) {
      alert(t('expenses.error.save', lang) + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await onSave(expenses.filter((e) => e.id !== id))
    setDeleteConfirm(null)
  }

  async function handleToggleActive(expense: RecurringExpense) {
    await onSave(expenses.map((e) => (e.id === expense.id ? { ...e, active: !e.active } : e)))
  }

  function handleBarClick(data: { name: string }) {
    const ref = categoryRefs.current[data.name as ExpenseCategory]
    if (ref) ref.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const isFormValid = form.name.trim() && parseFloat(form.amount) > 0

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t('expenses.title', lang)}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('expenses.subtitle', lang)}</p>
        </div>
      </div>

      {familyMembers.length > 0 && (
        <div className="flex items-center gap-2 mb-8 pb-4 border-b border-white/5">
          <span className="text-xs font-medium text-gray-500">{t('expenses.filter.label', lang)}</span>
          <button
            onClick={() => setSelectedOwner(null)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm transition-colors',
              selectedOwner === null
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
            )}
          >
            {t('expenses.filter.all', lang)}
          </button>
          {familyMembers.map((member) => (
            <button
              key={member.name}
              onClick={() => setSelectedOwner(member.name)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm transition-colors',
                selectedOwner === member.name
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
              )}
            >
              {member.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 md:mb-8">
        <SummaryCard
          label={t('expenses.summary.totalMonthly', lang)}
          value={avgVariable != null ? formatCurrency(totalMonthly + avgVariable, currency) : formatCurrency(totalMonthly, currency)}
          sub=''
          recurringSub={avgVariable != null ? t('expenses.summary.recurring', lang).replace('{amount}', formatCurrency(totalMonthly, currency)) : undefined}
          variableSub={avgVariable != null ? t('expenses.summary.variableAvg', lang).replace('{amount}', formatCurrency(avgVariable, currency)) : undefined}
        />
        <SummaryCard
          label={t('expenses.summary.totalYearly', lang)}
          value={avgVariable != null ? formatCurrency((totalMonthly + avgVariable) * 12, currency) : formatCurrency(totalYearly, currency)}
          sub=''
          recurringSub={avgVariable != null ? t('expenses.summary.recurring', lang).replace('{amount}', formatCurrency(totalYearly, currency)) : undefined}
          variableSub={avgVariable != null ? t('expenses.summary.variableAvg', lang).replace('{amount}', formatCurrency(avgVariable * 12, currency)) : undefined}
        />
      </div>

      {chartData.length > 0 && (
        <div className="bg-[#14141f] border border-white/5 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-gray-300">{t('expenses.chart.title', lang)}</h2>
            {txSummary && (
              <button
                onClick={() => setShowVariable(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  showVariable
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:border-white/20'
                )}
              >
                <TrendingUp size={12} />
                {t('expenses.chart.toggleVariable', lang)}
              </button>
            )}
          </div>
          <div className="[&_svg]:cursor-pointer" dir="ltr">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }} stackOffset="none">
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
                  width={60}
                  tickFormatter={(v) => formatCurrencyShort(v, currency)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a27',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '10px',
                    padding: '10px 14px'
                  }}
                  wrapperStyle={{ outline: 'none' }}
                  labelStyle={{ color: '#e5e7eb', fontWeight: 600, marginBottom: 4 }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null
                    const total = payload.reduce((s: number, p: any) => s + (p.value as number), 0)
                    return (
                      <div style={{ backgroundColor: '#1a1a27', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px' }}>
                        <p style={{ color: '#e5e7eb', fontWeight: 600, marginBottom: 6 }}>{label}</p>
                        {payload.map((p: any, i: number) => (
                          <p key={i} style={{ color: '#d1d5db', fontSize: 13, marginBottom: 2 }}>
                            <span style={{ color: p.color }}>{p.name === 'varAmount' ? t('expenses.chart.tooltipVariable', lang) : t('expenses.chart.tooltipLabel', lang)}</span>
                            {': '}{fmt(p.value as number)}
                          </p>
                        ))}
                        {payload.length > 1 && (
                          <p style={{ color: '#f3f4f6', fontWeight: 600, fontSize: 13, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 6, paddingTop: 6 }}>
                            {lang === 'he' ? 'סה״כ' : 'Total'}{': '}{fmt(total)}
                          </p>
                        )}
                      </div>
                    )
                  }}
                />
                <Bar dataKey="amount" stackId="a" fill="#6366f1" radius={showVariable ? [0, 0, 0, 0] : [6, 6, 0, 0]} onClick={handleBarClick}>
                  {chartData.map((_, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={
                        ['#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#0ea5e9'][
                          idx % 7
                        ]
                      }
                    />
                  ))}
                </Bar>
                {showVariable && (
                  <Bar dataKey="varAmount" stackId="a" radius={[6, 6, 0, 0]} onClick={handleBarClick}>
                    {chartData.map((_, idx) => (
                      <Cell
                        key={`varcell-${idx}`}
                        fill={
                          ['#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#0ea5e9'][idx % 7] + '88'
                        }
                      />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Variable Expenses Section */}
      <div className="mt-10 mb-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{t('expenses.variable.title', lang)}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{t('expenses.variable.subtitle', lang)}</p>
          </div>
          <button
            onClick={() => { setEditingVarId(null); setVarForm({ name: '', category: 'other', owner: '' }); setShowVarModal(true) }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-sm text-indigo-300 font-medium border border-indigo-500/20 transition-colors"
          >
            <Plus size={14} />{t('expenses.variable.add', lang)}
          </button>
        </div>

        <VariableExpensesList
          variableExpenses={filteredVariableExpenses}
          txSummary={txSummary}
          varDeleteConfirm={varDeleteConfirm}
          setVarDeleteConfirm={setVarDeleteConfirm}
          onSaveVariable={onSaveVariable}
          setEditingVarId={setEditingVarId}
          setVarForm={setVarForm}
          setShowVarModal={setShowVarModal}
          lang={lang}
          fmt={fmt}
          t={t}
        />
      </div>

      <div className="border-t border-white/5 mt-10 mb-6" />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">{t('expenses.recurring.title', lang)}</h2>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-sm text-indigo-300 font-medium border border-indigo-500/20 transition-colors"
        >
          <Plus size={14} />{t('expenses.modal.addExpense', lang)}
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-[#14141f] border border-white/5 rounded-xl px-8 py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
            <RefreshCw size={22} className="text-indigo-400" />
          </div>
          <p className="text-sm font-medium text-gray-300 mb-1">{t('expenses.empty.title', lang)}</p>
          <p className="text-xs text-gray-600 mb-5">
            {t('expenses.empty.message', lang)}
          </p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm text-white font-medium transition-colors"
          >
            <Plus size={14} />
            {t('expenses.empty.addButton', lang)}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {orderedCategories.filter((cat) => byCategory[cat].length > 0)
            .sort((a, b) => {
              const aMonthly = byCategory[a]
                .filter((e) => e.active)
                .reduce((s, e) => s + monthlyAmount(e), 0)
              const bMonthly = byCategory[b]
                .filter((e) => e.active)
                .reduce((s, e) => s + monthlyAmount(e), 0)
              return bMonthly - aMonthly
            })
            .map((cat) => {
              const items = byCategory[cat]
              const catMonthly = items
                .filter((e) => e.active)
                .reduce((s, e) => s + monthlyAmount(e), 0)
              const cfg = resolvedConfig[cat] ?? { label: cat, icon: null, color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' }
              return (
                <div
                  key={cat}
                  ref={(el) => {
                    if (el) categoryRefs.current[cat] = el
                  }}
                  className="bg-[#14141f] border border-white/5 rounded-xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'flex items-center justify-center w-6 h-6 rounded-md border text-xs',
                          cfg.color
                        )}
                      >
                        {cfg.icon}
                      </span>
                      <span className="text-sm font-semibold text-white">{cfg.label}</span>
                      <span className="text-xs text-gray-600 bg-white/5 rounded-full px-2 py-0.5">
                        {items.length}
                      </span>
                    </div>
                    {catMonthly > 0 && (
                      <span className="text-xs text-gray-400 font-medium">
                        {formatCurrency(catMonthly, currency)}
                        <span className="text-gray-600">{t('expenses.billing.perMonth', lang)}</span>
                      </span>
                    )}
                  </div>

                  <div className="divide-y divide-white/5">
                    {items.map((expense) => (
                      <div
                        key={expense.id}
                        className={cn(
                          'flex items-center justify-between px-5 py-3.5 group',
                          !expense.active && 'opacity-50'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className={cn(
                                'text-sm font-medium',
                                expense.active ? 'text-gray-200' : 'text-gray-500 line-through'
                              )}
                            >
                              {expense.name}
                            </p>
                            {expense.billingCycle === 'yearly' && (
                              <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                                {t('expenses.billing.yearly', lang)}
                              </span>
                            )}
                            {expense.owner && (
                              <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-2 py-0.5">
                                {expense.owner}
                              </span>
                            )}
                          </div>
                          {expense.notes && (
                            <p className="text-xs text-gray-600 mt-0.5 truncate">{expense.notes}</p>
                          )}
                          {driftWarnings[expense.id] && (() => {
                            const d = driftWarnings[expense.id]
                            const msg = t('expenses.drift.warning', lang)
                              .replace('{pct}', Math.round(d.pct).toString())
                              .replace('{actual}', fmt(d.actual))
                              .replace('{set}', fmt(d.set))
                            return (
                              <div className="flex items-start gap-1.5 mt-1.5">
                                <AlertTriangle size={11} className="text-amber-400 shrink-0 mt-0.5" />
                                <span className="text-[11px] text-amber-400 leading-snug">{msg}</span>
                                <span className="text-amber-600 shrink-0">·</span>
                                <button
                                  onClick={() => {
                                    setEditingId(expense.id)
                                    setForm({
                                      name: expense.name,
                                      amount: String(expense.billingCycle === 'yearly' ? d.actual * 12 : d.actual),
                                      category: expense.category,
                                      billingCycle: expense.billingCycle,
                                      owner: expense.owner ?? '',
                                      notes: expense.notes ?? ''
                                    })
                                    setShowModal(true)
                                  }}
                                  className="text-[11px] text-amber-400 hover:text-amber-200 underline underline-offset-2 transition-colors shrink-0"
                                >
                                  {t('expenses.drift.update', lang)}
                                </button>
                                <span className="text-amber-600 shrink-0">·</span>
                                <button
                                  onClick={() => setIgnoredDrift(prev => new Set([...prev, expense.id]))}
                                  className="text-[11px] text-amber-600 hover:text-amber-400 transition-colors shrink-0"
                                >
                                  {t('expenses.drift.ignore', lang)}
                                </button>
                              </div>
                            )
                          })()}
                        </div>

                        <div className="flex items-center gap-4 ml-4 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-200">
                              {formatCurrency(expense.amount, currency)}
                              <span className="text-xs text-gray-600 ml-1">
                                {expense.billingCycle === 'yearly' ? t('expenses.billing.perYear', lang) : t('expenses.billing.perMonth', lang)}
                              </span>
                            </p>
                            {expense.billingCycle === 'yearly' && (
                              <p className="text-xs text-gray-600">
                                {formatCurrency(expense.amount / 12, currency)}{t('expenses.billing.perMonth', lang)}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            {deleteConfirm === expense.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500 mr-1">{t('expenses.deleteConfirm', lang)}</span>
                                <button
                                  onClick={() => handleDelete(expense.id)}
                                  className="p-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                                >
                                  <Check size={13} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleToggleActive(expense)}
                                  className="p-1.5 rounded-md hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
                                  title={expense.active ? t('expenses.toggle.pause', lang) : t('expenses.toggle.activate', lang)}
                                >
                                  {expense.active ? (
                                    <ToggleRight size={14} className="text-indigo-400" />
                                  ) : (
                                    <ToggleLeft size={14} />
                                  )}
                                </button>
                                <button
                                  onClick={() => openEdit(expense)}
                                  className="p-1.5 rounded-md hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(expense.id)}
                                  className="p-1.5 rounded-md hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {showVarModal && (
        <Modal
          title={editingVarId ? t('expenses.variable.editTitle', lang) : t('expenses.variable.newTitle', lang)}
          onClose={() => setShowVarModal(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('expenses.modal.nameLabel', lang)}</label>
              <input
                autoFocus
                type="text"
                value={varForm.name}
                onChange={e => setVarForm({ ...varForm, name: e.target.value })}
                placeholder={t('expenses.modal.namePlaceholder', lang)}
                className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('expenses.modal.categoryLabel', lang)}</label>
              <div className="grid grid-cols-2 gap-2">
                {resolvedCategories.map(cat => {
                  const cfg = resolvedConfig[cat]
                  if (!cfg) return null
                  return (
                    <button
                      key={cat}
                      onClick={() => setVarForm({ ...varForm, category: cat as ExpenseCategory })}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all text-left',
                        varForm.category === cat
                          ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                          : 'bg-transparent border-white/10 text-gray-400 hover:border-white/20'
                      )}
                    >
                      <span className={cn('shrink-0', varForm.category === cat ? 'text-indigo-400' : '')}>{cfg.icon}</span>
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>
            {familyMembers.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  {t('expenses.modal.ownerLabel', lang)} <span className="text-gray-600">{t('expenses.modal.ownerOptional', lang)}</span>
                </label>
                <select
                  value={varForm.owner}
                  onChange={e => setVarForm({ ...varForm, owner: e.target.value })}
                  className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors"
                >
                  <option value="">{t('expenses.modal.ownerDefault', lang)}</option>
                  {familyMembers.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowVarModal(false)} className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-gray-200 hover:border-white/20 transition-colors">
                {t('expenses.modal.cancel', lang)}
              </button>
              <button
                disabled={!varForm.name.trim() || savingVar}
                onClick={async () => {
                  if (!varForm.name.trim()) return
                  setSavingVar(true)
                  try {
                    let updated: VariableExpense[]
                    if (editingVarId) {
                      updated = variableExpenses.map(e => e.id === editingVarId ? { ...e, name: varForm.name.trim(), category: varForm.category, owner: varForm.owner || undefined } : e)
                    } else {
                      updated = [...variableExpenses, { id: generateId(), name: varForm.name.trim(), category: varForm.category, owner: varForm.owner || undefined, active: true }]
                    }
                    await onSaveVariable(updated)
                    setShowVarModal(false)
                  } finally {
                    setSavingVar(false)
                  }
                }}
                className="flex-1 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-sm text-white font-medium transition-colors"
              >
                {savingVar ? t('expenses.modal.saving', lang) : editingVarId ? t('expenses.modal.saveChanges', lang) : t('expenses.variable.add', lang)}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal
          title={editingId ? t('expenses.modal.editTitle', lang) : t('expenses.modal.newTitle', lang)}
          onClose={() => setShowModal(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('expenses.modal.nameLabel', lang)}</label>
              <input
                autoFocus
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder={t('expenses.modal.namePlaceholder', lang)}
                className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('expenses.modal.amountLabel', lang)}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                  className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('expenses.modal.billingCycleLabel', lang)}</label>
                <div className="flex gap-2">
                  {(['monthly', 'yearly'] as const).map((cycle) => (
                    <button
                      key={cycle}
                      onClick={() => setForm({ ...form, billingCycle: cycle })}
                      className={cn(
                        'flex-1 py-2.5 rounded-lg text-sm border transition-all',
                        form.billingCycle === cycle
                          ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 font-medium'
                          : 'bg-transparent border-white/10 text-gray-400 hover:border-white/20'
                      )}
                    >
                      {cycle === 'monthly' ? t('expenses.modal.monthly', lang) : t('expenses.modal.yearly', lang)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('expenses.modal.categoryLabel', lang)}</label>
              <div className="grid grid-cols-2 gap-2">
                {resolvedCategories.map((cat) => {
                  const cfg = resolvedConfig[cat]
                  if (!cfg) return null
                  return (
                    <button
                      key={cat}
                      onClick={() => setForm({ ...form, category: cat as ExpenseCategory })}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all text-left',
                        form.category === cat
                          ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                          : 'bg-transparent border-white/10 text-gray-400 hover:border-white/20'
                      )}
                    >
                      <span className={cn('shrink-0', form.category === cat ? 'text-indigo-400' : '')}>
                        {cfg.icon}
                      </span>
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {familyMembers.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  {t('expenses.modal.ownerLabel', lang)} <span className="text-gray-600">{t('expenses.modal.ownerOptional', lang)}</span>
                </label>
                <select
                  value={form.owner}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                  className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                >
                  <option value="">{t('expenses.modal.ownerDefault', lang)}</option>
                  {familyMembers.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                {t('expenses.modal.notesLabel', lang)} <span className="text-gray-600">{t('expenses.modal.notesOptional', lang)}</span>
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t('expenses.modal.notesPlaceholder', lang)}
                className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-gray-200 hover:border-white/20 transition-colors"
              >
                {t('expenses.modal.cancel', lang)}
              </button>
              <button
                onClick={handleSave}
                disabled={!isFormValid || saving}
                className="flex-1 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white font-medium transition-colors"
              >
                {saving ? t('expenses.modal.saving', lang) : editingId ? t('expenses.modal.saveChanges', lang) : t('expenses.modal.addExpense', lang)}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function VariableExpenseRow({
  label, byMonth, actions, fmt, lang, t: tFn
}: {
  label: string
  byMonth: Record<string, number>
  actions?: React.ReactNode
  fmt: (v: number) => string
  lang: string
  t: typeof import('@/translations').t
}) {
  const months = Object.keys(byMonth).sort()
  const thisMonth = byMonth[months[months.length - 1]]
  const avg3 = rollingAvg(byMonth, 3)
  const avg6 = rollingAvg(byMonth, 6)
  const avg12 = rollingAvg(byMonth, 12)
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200">{label}</p>
      </div>
      <div className="hidden sm:flex items-center text-right shrink-0">
        <div className="w-28">
          <p className="text-xs text-gray-500">{tFn('expenses.variable.thisMonth', lang as any)}</p>
          <p className="text-sm font-medium text-white">{thisMonth ? fmt(thisMonth) : '—'}</p>
        </div>
        <div className="w-28">
          <p className="text-xs text-gray-500">{tFn('expenses.variable.avg3', lang as any)}</p>
          <p className="text-sm font-medium text-white">{avg3 != null ? fmt(avg3) : '—'}</p>
        </div>
        <div className="w-28">
          <p className="text-xs text-gray-500">{tFn('expenses.variable.avg6', lang as any)}</p>
          <p className="text-sm font-medium text-white">{avg6 != null ? fmt(avg6) : '—'}</p>
        </div>
        <div className="w-28">
          <p className="text-xs text-gray-500">{tFn('expenses.variable.avg12', lang as any)}</p>
          <p className="text-sm font-medium text-white">{avg12 != null ? fmt(avg12) : '—'}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 w-[74px]">
        {actions && (
          <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

function VariableExpensesList({
  variableExpenses, txSummary, varDeleteConfirm, setVarDeleteConfirm,
  onSaveVariable, setEditingVarId, setVarForm, setShowVarModal, lang, fmt, t: tFn
}: {
  variableExpenses: VariableExpense[]
  txSummary: { byExpense: Record<string, Record<string, number>>; byCategory: Record<string, Record<string, number>> } | null
  varDeleteConfirm: string | null
  setVarDeleteConfirm: (id: string | null) => void
  onSaveVariable: (expenses: VariableExpense[]) => Promise<void>
  setEditingVarId: (id: string | null) => void
  setVarForm: (f: { name: string; category: ExpenseCategory; owner: string }) => void
  setShowVarModal: (v: boolean) => void
  lang: string
  fmt: (v: number) => string
  t: typeof import('@/translations').t
}) {
  const { categoryConfig: resolvedConfig, categories: resolvedCategories } = useCategories()

  const unmappedRows = Object.entries(txSummary?.byCategory ?? {})
    .map(([cat, byMonth]) => ({ cat, byMonth }))
    .filter(({ byMonth }) => Object.keys(byMonth).length > 0)

  const hasAnything = variableExpenses.length > 0 || unmappedRows.length > 0

  if (!hasAnything) {
    return (
      <div className="bg-[#14141f] border border-white/5 rounded-xl px-6 py-8 text-center">
        <TrendingUp size={22} className="mx-auto mb-2 text-slate-600" />
        <p className="text-sm text-gray-500">{tFn('expenses.variable.empty', lang as any)}</p>
      </div>
    )
  }

  // Group by category slug — don't depend on resolvedCategories being loaded
  const byCategory = variableExpenses.reduce<Record<string, VariableExpense[]>>((acc, e) => {
    acc[e.category] = acc[e.category] ?? []
    acc[e.category].push(e)
    return acc
  }, {})
  const orderedCategories = resolvedCategories.length > 0
    ? resolvedCategories.filter(cat => byCategory[cat])
    : Object.keys(byCategory)

  const categoriesWithItems = orderedCategories

  // Merge byMonth for a category's variable expenses
  function catByMonth(items: VariableExpense[]): Record<string, number> {
    const merged: Record<string, number> = {}
    for (const ve of items) {
      const bm = txSummary?.byExpense?.[ve.id] ?? {}
      for (const [month, amt] of Object.entries(bm)) {
        merged[month] = (merged[month] ?? 0) + amt
      }
    }
    return merged
  }

  const hasUnmapped = unmappedRows.length > 0

  return (
    <div className="space-y-4">
      {categoriesWithItems.map(cat => {
        const items = byCategory[cat]
        const cfg = resolvedConfig[cat] ?? { label: cat, icon: null, color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' }
        const catTotal = catByMonth(items)
        const catAvg12 = rollingAvgBestEffort(catTotal, 12)

        return (
          <div key={cat} className="bg-[#14141f] border border-white/5 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <span className={cn('flex items-center justify-center w-6 h-6 rounded-md border text-xs', cfg.color)}>
                  {cfg.icon}
                </span>
                <span className="text-sm font-semibold text-white">{cfg.label}</span>
                <span className="text-xs text-gray-600 bg-white/5 rounded-full px-2 py-0.5">{items.length}</span>
              </div>
              {catAvg12 != null && (
                <span className="text-xs text-gray-400 font-medium">
                  ~{fmt(catAvg12)}<span className="text-gray-600">/mo avg</span>
                </span>
              )}
            </div>
            <div className="divide-y divide-white/5">
              {items.map(ve => {
                const byMonth = txSummary?.byExpense?.[ve.id] ?? {}
                const actions = varDeleteConfirm === ve.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 mr-1">{tFn('expenses.deleteConfirm', lang as any)}</span>
                    <button onClick={async () => { await onSaveVariable(variableExpenses.filter(e => e.id !== ve.id)); setVarDeleteConfirm(null) }} className="p-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400"><Check size={13} /></button>
                    <button onClick={() => setVarDeleteConfirm(null)} className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-gray-400"><X size={13} /></button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => onSaveVariable(variableExpenses.map(e => e.id === ve.id ? { ...e, active: !e.active } : e))} className="p-1.5 rounded-md hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors">
                      {ve.active ? <ToggleRight size={14} className="text-indigo-400" /> : <ToggleLeft size={14} />}
                    </button>
                    <button onClick={() => { setEditingVarId(ve.id); setVarForm({ name: ve.name, category: ve.category, owner: ve.owner ?? '' }); setShowVarModal(true) }} className="p-1.5 rounded-md hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setVarDeleteConfirm(ve.id)} className="p-1.5 rounded-md hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </>
                )
                return (
                  <div key={ve.id} className={cn(!ve.active && 'opacity-50')}>
                    <VariableExpenseRow
                      label={ve.name}
                      byMonth={byMonth}
                      actions={actions}
                      fmt={fmt}
                      lang={lang}
                      t={tFn}
                    />
                    {ve.owner && (
                      <p className="text-xs text-indigo-400 px-5 -mt-2 pb-2">{ve.owner}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {hasUnmapped && (() => {
        const mergedByMonth: Record<string, number> = {}
        for (const { byMonth } of unmappedRows) {
          for (const [month, amt] of Object.entries(byMonth)) {
            mergedByMonth[month] = (mergedByMonth[month] ?? 0) + amt
          }
        }
        return (
          <div className="bg-[#14141f] border border-white/5 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-white/5">
              <span className="flex items-center justify-center w-6 h-6 rounded-md border text-xs border-white/10 bg-white/5 text-slate-400">?</span>
              <span className="text-sm font-semibold text-white">{tFn('expenses.variable.unmappedHeader', lang as any)}</span>
            </div>
            <VariableExpenseRow
              label={tFn('expenses.variable.unmappedHeader', lang as any)}
              byMonth={mergedByMonth}
              fmt={fmt}
              lang={lang}
              t={tFn}
            />
          </div>
        )
      })()}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  recurringSub,
  variableSub,
  plain
}: {
  label: string
  value: string
  sub: string
  recurringSub?: string
  variableSub?: string
  plain?: boolean
}) {
  return (
    <div className="bg-[#14141f] border border-white/5 rounded-xl px-5 py-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={cn('text-2xl font-bold tracking-tight', plain ? 'text-white' : 'text-red-400')}>
        {value}
      </p>
      <p className="text-xs text-gray-600 mt-1">{sub}</p>
      {recurringSub && (
        <p className="text-xs text-gray-500 mt-0.5">{recurringSub}</p>
      )}
      {variableSub && (
        <p className="text-xs text-amber-500/70 mt-0.5">{variableSub}</p>
      )}
    </div>
  )
}
