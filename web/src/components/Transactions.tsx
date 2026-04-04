'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Upload, Check, X, Link2, HelpCircle, EyeOff,
  ChevronDown, ChevronLeft, ChevronRight, Loader2, AlertCircle, Trash2, CreditCard, Pencil
} from 'lucide-react'
import { AppData, RecurringExpense, VariableExpense, ExpenseCategory, Transaction } from '../types'
import { formatCurrency, getCurrentMonth, formatMonthFull, cn } from '../utils'
import { useCurrency } from '../context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { t } from '@/translations'
import { useCategories, CategoryConfigMap } from '@/hooks/useCategories'

interface TransactionsProps {
  data: AppData
}

type FilterStatus = 'all' | 'auto' | 'manual' | 'unmapped' | 'ignored'

const CAL_TRANSACTIONS_URL = 'https://digital-web.cal-online.co.il/transactions'

const STATUS_COLORS: Record<string, string> = {
  auto:     'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  manual:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
  unmapped: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  ignored:  'text-slate-400 bg-slate-500/10 border-slate-500/20',
}

function changeMonth(date: string, delta: number): string {
  const [y, m] = date.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function StatusBadge({ status, lang }: { status: string; lang: string }) {
  const color = STATUS_COLORS[status] ?? STATUS_COLORS.unmapped
  const labelKey = `tx.filter.${status}` as any
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', color)}>
      {t(labelKey, lang as any)}
    </span>
  )
}

function CategoryBadge({ category, config }: { category?: string; config: CategoryConfigMap }) {
  if (!category) return null
  const cfg = config[category as ExpenseCategory]
  if (!cfg) return <span className="text-xs text-slate-400">{category}</span>
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded border flex items-center gap-1 w-fit', cfg.color)}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

export function Transactions({ data }: TransactionsProps) {
  const { currency } = useCurrency()
  const { lang } = useLanguage()
  const fmt = (v: number) => formatCurrency(v, currency)
  const { categoryConfig: resolvedConfig } = useCategories()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [month, setMonth] = useState(getCurrentMonth())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [mapping, setMapping] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [cardFilter, setCardFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [expenseFilter, setExpenseFilter] = useState<string | null>(null)
  const [linkFilter, setLinkFilter] = useState<'all' | 'recurring' | 'variable' | 'unlinked'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const recurringExpenses: RecurringExpense[] = data.expenses ?? []
  const variableExpenses: VariableExpense[] = data.variableExpenses ?? []

  const loadTransactions = useCallback(async (m: string) => {
    setLoading(true)
    setTransactions([])
    try {
      const res = await fetch(`/finance-hub/api/transactions?month=${m}`)
      if (res.ok) {
        const { transactions: txs } = await res.json()
        setTransactions(txs)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTransactions(month) }, [month, loadTransactions])

  // Cards uploaded this month (unique per card last 4)
  const uploadedCards = [...new Set(transactions.map(t => t.cardLast4).filter(Boolean))] as string[]

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      Array.from(files).forEach(f => formData.append('files', f))

      const parseRes = await fetch('/finance-hub/api/parse-cal', { method: 'POST', body: formData })
      if (!parseRes.ok) throw new Error('Failed to parse files')
      const { transactions: parsed } = await parseRes.json()

      if (!parsed.length) {
        setMessage({ type: 'error', text: 'No transactions found in files' })
        return
      }

      setMapping(true)
      const mapRes = await fetch('/finance-hub/api/map-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: parsed, recurringExpenses, variableExpenses }),
      })
      if (!mapRes.ok) throw new Error('Failed to map transactions')
      const { saved, duplicates } = await mapRes.json()

      const newWord = saved === 1 ? t('tx.import.new', lang) : t('tx.import.new.plural', lang)
      const dupText = duplicates
        ? ` · ${duplicates} ${duplicates === 1 ? t('tx.import.skipped', lang) : t('tx.import.skipped.plural', lang)}`
        : ''
      setMessage({
        type: 'success',
        text: `${t('tx.import.success', lang)} ${saved} ${newWord}${dupText}.`,
      })
      await loadTransactions(month)
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message ?? 'Something went wrong' })
    } finally {
      setUploading(false)
      setMapping(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function updateTransaction(
    id: string,
    patch: { recurringExpenseId?: string | null; expenseCategory?: string | null; mappingStatus?: string; overrideAmount?: number | null }
  ) {
    const res = await fetch('/finance-hub/api/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    if (res.ok) {
      const { transaction } = await res.json()
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...transaction } : t))
    }
  }

  async function deleteTransaction(id: string) {
    const res = await fetch(`/finance-hub/api/transactions?id=${id}`, { method: 'DELETE' })
    if (res.ok) setTransactions(prev => prev.filter(t => t.id !== id))
  }

  const effectiveCategory = (tx: Transaction) =>
    tx.expenseCategory
    ?? recurringExpenses.find(e => e.id === tx.recurringExpenseId)?.category
    ?? variableExpenses.find(e => e.id === tx.recurringExpenseId)?.category
    ?? null

  const matchesLinkFilter = (t: Transaction) => {
    if (linkFilter === 'all') return true
    if (linkFilter === 'unlinked') return !t.recurringExpenseId
    if (linkFilter === 'recurring') return !!recurringExpenses.find(e => e.id === t.recurringExpenseId)
    if (linkFilter === 'variable') return !!variableExpenses.find(e => e.id === t.recurringExpenseId)
    return true
  }

  const filtered = transactions.filter(t =>
    (filter === 'all' || t.mappingStatus === filter) &&
    (cardFilter === null || t.cardLast4 === cardFilter) &&
    (categoryFilter === null || effectiveCategory(t) === categoryFilter) &&
    (expenseFilter === null || t.recurringExpenseId === expenseFilter) &&
    matchesLinkFilter(t)
  )

  const availableCategories = [...new Set(transactions.map(effectiveCategory).filter(Boolean))] as string[]
  const availableExpenses = [...new Map(
    transactions
      .filter(t => t.recurringExpenseId)
      .map(t => {
        const exp = recurringExpenses.find(e => e.id === t.recurringExpenseId)
          ?? variableExpenses.find(e => e.id === t.recurringExpenseId)
        if (!exp) return null
        if (categoryFilter && exp.category !== categoryFilter) return null
        return [exp.id, { name: exp.name, category: exp.category }] as [string, { name: string; category: string }]
      })
      .filter((x): x is [string, { name: string; category: string }] => x !== null)
  ).entries()]

  const availableExpensesByCategory = (Object.keys(resolvedConfig) as ExpenseCategory[])
    .map(cat => ({ cat, items: availableExpenses.filter(([, e]) => e.category === cat) }))
    .filter(g => g.items.length > 0)

  const baseFiltered = transactions.filter(t =>
    (cardFilter === null || t.cardLast4 === cardFilter) &&
    (categoryFilter === null || effectiveCategory(t) === categoryFilter) &&
    (expenseFilter === null || t.recurringExpenseId === expenseFilter) &&
    matchesLinkFilter(t)
  )

  const counts: Record<FilterStatus, number> = {
    all: baseFiltered.length,
    auto: baseFiltered.filter(tx => tx.mappingStatus === 'auto').length,
    manual: baseFiltered.filter(tx => tx.mappingStatus === 'manual').length,
    unmapped: baseFiltered.filter(tx => tx.mappingStatus === 'unmapped').length,
    ignored: baseFiltered.filter(tx => tx.mappingStatus === 'ignored').length,
  }

  const totalAmount = filtered
    .filter(t => t.mappingStatus !== 'ignored')
    .reduce((s, t) => s + (t.overrideAmount ?? t.amount), 0)

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('tx.title', lang)}</h1>
          <p className="text-sm text-slate-400 mt-0.5">{t('tx.subtitle', lang)}</p>
        </div>
        <div className="flex items-center gap-1 bg-[#14141f] border border-white/8 rounded-xl px-1 py-1">
          <button
            onClick={() => setMonth(m => changeMonth(m, -1))}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors"
          >
            {lang === 'he' ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <span className="px-3 text-sm font-semibold text-white min-w-[130px] text-center">
            {formatMonthFull(month, lang)}
          </span>
          <button
            onClick={() => setMonth(m => changeMonth(m, 1))}
            disabled={month >= getCurrentMonth()}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors disabled:opacity-30"
          >
            {lang === 'he' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      {/* Upload area */}
      <div className="bg-[#14141f] border border-white/8 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={15} className="text-slate-400" />
            <span className="text-sm font-medium text-white">{t('tx.cards.title', lang)}</span>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || mapping}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
          >
            {uploading || mapping
              ? <><Loader2 size={13} className="animate-spin" />{mapping ? t('tx.mapping', lang) : t('tx.parsing', lang)}</>
              : <><Upload size={13} />{t('tx.upload', lang)}</>}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
        </div>

        {uploadedCards.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {uploadedCards.map(card => (
              <button
                key={card}
                onClick={() => setCardFilter(f => f === card ? null : card)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-lg border transition-colors',
                  cardFilter === card
                    ? 'bg-indigo-500/30 border-indigo-500/50 text-indigo-200'
                    : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20'
                )}
              >
                {card}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            {t('tx.empty.cards', lang)} {formatMonthFull(month, lang)}.{' '}
            <a
              href={CAL_TRANSACTIONS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-indigo-400 underline underline-offset-2 transition-colors"
            >
              {t('tx.empty.cards.hint', lang)}
            </a>
          </p>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={cn(
          'flex items-start gap-3 px-4 py-3 rounded-lg text-sm',
          message.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
            : 'bg-red-500/10 text-red-300 border border-red-500/20'
        )}>
          {message.type === 'success'
            ? <Check size={15} className="mt-0.5 shrink-0" />
            : <AlertCircle size={15} className="mt-0.5 shrink-0" />}
          <span>{message.text}</span>
          <button className="ml-auto shrink-0" onClick={() => setMessage(null)}><X size={14} /></button>
        </div>
      )}

      {/* Filter tabs + summary */}
      {transactions.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1 bg-[#14141f] border border-white/8 rounded-lg p-1">
              {(['all', 'unmapped', 'auto', 'manual', 'ignored'] as FilterStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={cn(
                    'px-2 sm:px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap',
                    filter === s ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  )}
                >
                  {t(s === 'all' ? 'tx.filter.all' : `tx.filter.${s}` as any, lang)}
                  {counts[s] > 0 && <span className="ms-1.5 opacity-60">{counts[s]}</span>}
                </button>
              ))}
            </div>
            {availableCategories.length > 0 && (
              <div className="relative">
                <select
                  value={categoryFilter ?? ''}
                  onChange={e => { setCategoryFilter(e.target.value || null); setExpenseFilter(null); }}
                  className={`appearance-none bg-[#14141f] border border-white/8 rounded-lg text-xs font-medium text-slate-400 focus:outline-none transition-colors h-[38px] ${lang === 'he' ? 'pr-2 sm:pr-3 pl-7' : 'pl-2 sm:pl-3 pr-7'}`}
                >
                  <option value="">{t('tx.filter.allCategories', lang)}</option>
                  {availableCategories.map(c => (
                    <option key={c} value={c}>{resolvedConfig[c as ExpenseCategory]?.label ?? c}</option>
                  ))}
                </select>
                <svg className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${lang === 'he' ? 'left-2' : 'right-2'}`} width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            )}
            {availableExpenses.length > 0 && (
              <div className="relative">
                <select
                  value={expenseFilter ?? ''}
                  onChange={e => setExpenseFilter(e.target.value || null)}
                  className={`appearance-none bg-[#14141f] border border-white/8 rounded-lg text-xs font-medium text-slate-400 focus:outline-none transition-colors h-[38px] ${lang === 'he' ? 'pr-2 sm:pr-3 pl-7' : 'pl-2 sm:pl-3 pr-7'}`}
                >
                  <option value="">{t('tx.filter.allExpenses', lang)}</option>
                  {availableExpensesByCategory.map(({ cat, items }) => (
                    <optgroup key={cat} label={resolvedConfig[cat].label}>
                      {items.map(([id, e]) => (
                        <option key={id} value={id}>{e.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <svg className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${lang === 'he' ? 'left-2' : 'right-2'}`} width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            )}
            <div className="relative">
              <select
                value={linkFilter}
                onChange={e => { setLinkFilter(e.target.value as any); setExpenseFilter(null); }}
                className={`appearance-none bg-[#14141f] border border-white/8 rounded-lg text-xs font-medium text-slate-400 focus:outline-none transition-colors h-[38px] ${lang === 'he' ? 'pr-2 sm:pr-3 pl-7' : 'pl-2 sm:pl-3 pr-7'}`}
              >
                {(['all', 'recurring', 'variable', 'unlinked'] as const).map(v => (
                  <option key={v} value={v}>{t(`tx.linkFilter.${v}`, lang)}</option>
                ))}
              </select>
              <svg className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${lang === 'he' ? 'left-2' : 'right-2'}`} width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
          <span className="text-sm text-slate-400">
            {filtered.length} {filtered.length === 1 ? t('tx.count', lang) : t('tx.count.plural', lang)}
            {filter !== 'ignored' && <> · <span className="text-white font-medium">{fmt(totalAmount)}</span></>}
          </span>
        </div>
      )}

      {/* Transaction list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-slate-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14 bg-[#14141f] rounded-xl border border-white/8">
          <Upload className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400 font-medium">
            {filter !== 'all'
              ? `${t('tx.empty.filter', lang)} (${t(`tx.filter.${filter}` as any, lang).toLowerCase()})`
              : `${t('tx.empty.month', lang)} ${formatMonthFull(month, lang)}`}
          </p>
          {filter === 'all' && (
            <p className="text-slate-500 text-sm mt-1">{t('tx.empty.hint', lang)}</p>
          )}
        </div>
      ) : (
        <div className="bg-[#14141f] rounded-xl border border-white/8 divide-y divide-white/5">
          <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-b border-white/8">
            <span className="text-[11px] text-slate-500 w-20 shrink-0">{t('tx.col.date', lang)}</span>
            <span className="text-[11px] text-slate-500 flex-1 min-w-0">{t('tx.col.merchant', lang)}</span>
            <span className="text-[11px] text-slate-500 w-44 shrink-0">{t('tx.col.expense', lang)}</span>
            <span className="text-[11px] text-slate-500 w-36 shrink-0">{t('tx.col.status', lang)}</span>
            <div className="text-[11px] text-slate-500 w-20 shrink-0 flex justify-end">{t('tx.col.amount', lang)}</div>
            <span className="w-[14px] shrink-0" />
          </div>

          {filtered.map(tx => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              recurringExpenses={recurringExpenses}
              variableExpenses={variableExpenses}
              expanded={expandedId === tx.id}
              onToggle={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
              onUpdate={patch => updateTransaction(tx.id, patch)}
              onDelete={() => deleteTransaction(tx.id)}
              fmt={fmt}
              lang={lang}
              categoryConfig={resolvedConfig}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface TransactionRowProps {
  tx: Transaction
  recurringExpenses: RecurringExpense[]
  variableExpenses: VariableExpense[]
  expanded: boolean
  onToggle: () => void
  onUpdate: (patch: { recurringExpenseId?: string | null; expenseCategory?: string | null; mappingStatus?: string; overrideAmount?: number | null }) => void
  onDelete: () => void
  fmt: (v: number) => string
  lang: string
  categoryConfig: CategoryConfigMap
}

function TransactionRow({ tx, recurringExpenses, variableExpenses, expanded, onToggle, onUpdate, onDelete, fmt, lang, categoryConfig }: TransactionRowProps) {
  const matchedRecurring = recurringExpenses.find(e => e.id === tx.recurringExpenseId)
  const matchedVariable = variableExpenses.find(e => e.id === tx.recurringExpenseId)
  const matchedExpense = matchedRecurring ?? matchedVariable
  const amountMismatch = tx.mappingStatus === 'auto' && matchedRecurring != null && Math.abs(tx.amount - matchedRecurring.amount) > 10
  const displayAmount = tx.overrideAmount ?? tx.amount

  const [editingAmount, setEditingAmount] = useState(false)
  const [amountInput, setAmountInput] = useState('')

  function startEditAmount(e: React.MouseEvent) {
    e.stopPropagation()
    setAmountInput(String(tx.overrideAmount ?? tx.amount))
    setEditingAmount(true)
  }

  async function saveAmount() {
    const val = parseFloat(amountInput)
    if (!isNaN(val) && val > 0) {
      await onUpdate({ overrideAmount: val })
    }
    setEditingAmount(false)
  }

  function clearOverride() {
    onUpdate({ overrideAmount: null })
  }

  return (
    <div>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/3 transition-colors"
        onClick={onToggle}
      >
        <span className="text-xs text-slate-500 w-20 shrink-0">{tx.date.slice(8)}-{tx.date.slice(5, 7)}</span>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate">{tx.merchant}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {tx.calCategory && <span className="text-xs text-slate-500">{tx.calCategory}</span>}
            {tx.cardLast4 && <span className="text-xs text-slate-600">·{tx.cardLast4}</span>}
          </div>
        </div>

        <div className="hidden sm:block w-44 shrink-0 min-w-0">
          {matchedExpense ? (
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-1 text-xs text-indigo-400 min-w-0">
                <Link2 size={10} className="shrink-0" />
                <span className="truncate min-w-0">{matchedExpense.name}</span>
              </div>
              <span className={cn('text-[10px] px-1 rounded w-fit', matchedRecurring ? 'bg-indigo-900/60 text-indigo-300' : 'bg-purple-900/60 text-purple-300')}>
                {matchedRecurring ? t('tx.badge.recurring', lang) : t('tx.badge.variable', lang)}
              </span>
            </div>
          ) : tx.expenseCategory ? (
            <CategoryBadge category={tx.expenseCategory} config={categoryConfig} />
          ) : null}
        </div>

        <div className="hidden sm:block w-36 shrink-0">
          <StatusBadge status={tx.mappingStatus} lang={lang} />
        </div>

        <div className="text-right shrink-0 w-20">
          <div className="flex items-center justify-end gap-1.5">
            {amountMismatch && (
              <span title={`Expected ${fmt(matchedRecurring!.amount)}`} className="text-amber-400 text-xs font-bold leading-none">!</span>
            )}
            <span className={cn('text-sm font-medium', tx.overrideAmount != null ? 'text-amber-300' : 'text-white')}>
              {fmt(displayAmount)}
            </span>
          </div>
        </div>

        <ChevronDown size={14} className={cn('text-slate-500 shrink-0 transition-transform', expanded && 'rotate-180')} />
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 bg-white/2 border-t border-white/5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">{t('tx.map.expense', lang)}</label>
              <div className="relative">
                <select
                  value={recurringExpenses.find(e => e.id === tx.recurringExpenseId) ? tx.recurringExpenseId ?? '' : ''}
                  onChange={e => {
                    const re = recurringExpenses.find(r => r.id === e.target.value)
                    onUpdate({
                      recurringExpenseId: e.target.value || null,
                      mappingStatus: e.target.value ? 'manual' : (variableExpenses.find(v => v.id === tx.recurringExpenseId) ? 'manual' : 'unmapped'),
                      expenseCategory: re ? re.category : null,
                    })
                  }}
                  className={`appearance-none w-full bg-[#09090f] border border-white/10 text-slate-300 text-xs rounded-lg py-2 ${lang === 'he' ? 'pr-3 pl-7' : 'pl-3 pr-7'}`}
                >
                  <option value="">{t('tx.map.none', lang)}</option>
                  {(Object.keys(categoryConfig) as ExpenseCategory[])
                    .filter(cat => recurringExpenses.some(e => e.active && e.category === cat))
                    .map(cat => (
                      <optgroup key={cat} label={categoryConfig[cat].label}>
                        {recurringExpenses.filter(e => e.active && e.category === cat).map(e => (
                          <option key={e.id} value={e.id}>{e.name} (₪{e.amount})</option>
                        ))}
                      </optgroup>
                    ))}
                </select>
                <svg className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${lang === 'he' ? 'left-2' : 'right-2'}`} width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">{t('tx.map.variable', lang)}</label>
              <div className="relative">
                <select
                  value={variableExpenses.find(e => e.id === tx.recurringExpenseId) ? tx.recurringExpenseId ?? '' : ''}
                  onChange={e => {
                    const ve = variableExpenses.find(v => v.id === e.target.value)
                    onUpdate({
                      recurringExpenseId: e.target.value || null,
                      mappingStatus: e.target.value ? 'manual' : (recurringExpenses.find(r => r.id === tx.recurringExpenseId) ? 'manual' : 'unmapped'),
                      expenseCategory: ve ? ve.category : null,
                    })
                  }}
                  className={`appearance-none w-full bg-[#09090f] border border-white/10 text-slate-300 text-xs rounded-lg py-2 ${lang === 'he' ? 'pr-3 pl-7' : 'pl-3 pr-7'}`}
                >
                  <option value="">{t('tx.map.none', lang)}</option>
                  {(Object.keys(categoryConfig) as ExpenseCategory[])
                    .filter(cat => variableExpenses.some(e => e.active && e.category === cat))
                    .map(cat => (
                      <optgroup key={cat} label={categoryConfig[cat].label}>
                        {variableExpenses.filter(e => e.active && e.category === cat).map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </optgroup>
                    ))}
                </select>
                <svg className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${lang === 'he' ? 'left-2' : 'right-2'}`} width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">{t('tx.map.category', lang)}</label>
              <div className="relative">
                <select
                  value={tx.expenseCategory ?? ''}
                  disabled={!!recurringExpenses.find(e => e.id === tx.recurringExpenseId) || !!variableExpenses.find(e => e.id === tx.recurringExpenseId)}
                  onChange={e => onUpdate({ expenseCategory: e.target.value || null })}
                  className={`appearance-none w-full bg-[#09090f] border border-white/10 text-slate-300 text-xs rounded-lg py-2 disabled:opacity-40 disabled:cursor-not-allowed ${lang === 'he' ? 'pr-3 pl-7' : 'pl-3 pr-7'}`}
                >
                  <option value="">{t('tx.map.none', lang)}</option>
                  {(Object.keys(categoryConfig) as ExpenseCategory[]).map(c => (
                    <option key={c} value={c}>{categoryConfig[c].label}</option>
                  ))}
                </select>
                <svg className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${lang === 'he' ? 'left-2' : 'right-2'}`} width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          </div>

          {/* Amount override */}
          <div className="flex items-center gap-2">
            {editingAmount ? (
              <>
                <input
                  autoFocus
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountInput}
                  onChange={e => setAmountInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveAmount(); if (e.key === 'Escape') setEditingAmount(false) }}
                  className="w-28 bg-[#09090f] border border-indigo-500/50 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none"
                />
                <button onClick={saveAmount} className="p-1.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300"><Check size={12} /></button>
                <button onClick={() => setEditingAmount(false)} className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-slate-400"><X size={12} /></button>
              </>
            ) : (
              <>
                <span className="text-xs text-slate-500">{t('tx.amount.label', lang as any)}</span>
                <span className={cn('text-xs font-medium', tx.overrideAmount != null ? 'text-amber-300' : 'text-slate-300')}>{fmt(displayAmount)}</span>
                {tx.overrideAmount != null && (
                  <span className="text-xs text-slate-600 line-through">{fmt(tx.amount)}</span>
                )}
                <button onClick={startEditAmount} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-200 px-2 py-1 rounded border border-white/8 transition-colors">
                  <Pencil size={11} />{t('tx.amount.fix', lang as any)}
                </button>
                {tx.overrideAmount != null && (
                  <button onClick={clearOverride} className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded border border-white/8 transition-colors">
                    {t('tx.amount.reset', lang as any)}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {tx.mappingStatus !== 'ignored' ? (
              <button
                onClick={() => onUpdate({ mappingStatus: 'ignored' })}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-2 py-1.5 rounded border border-white/8 transition-colors"
              >
                <EyeOff size={12} />{t('tx.action.ignore', lang)}
              </button>
            ) : (
              <button
                onClick={() => onUpdate({ mappingStatus: 'unmapped' })}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-2 py-1.5 rounded border border-white/8 transition-colors"
              >
                <HelpCircle size={12} />{t('tx.action.unignore', lang)}
              </button>
            )}
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 px-2 py-1.5 rounded border border-red-500/20 transition-colors ml-auto"
            >
              <Trash2 size={12} />{t('tx.action.delete', lang)}
            </button>
          </div>

          <div className="text-xs text-slate-600 flex gap-4 flex-wrap">
            {tx.accountLabel && <span>{tx.accountLabel}</span>}
            {tx.type && <span>{tx.type}</span>}
            {tx.notes && <span>{tx.notes}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
