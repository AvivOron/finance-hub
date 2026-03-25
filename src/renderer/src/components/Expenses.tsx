import { useState, useRef } from 'react'
import {
  Plus, Pencil, Trash2, X, Check,
  Home, Baby, RefreshCw, Shield, Zap, Car, PawPrint, MoreHorizontal,
  ToggleLeft, ToggleRight
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
import { RecurringExpense, ExpenseCategory, FamilyMember } from '../types'
import { generateId, formatCurrency, cn } from '../utils'
import { useCurrency } from '../context/CurrencyContext'
import { Modal } from './Accounts'

interface ExpensesProps {
  expenses: RecurringExpense[]
  familyMembers: FamilyMember[]
  onSave: (expenses: RecurringExpense[]) => Promise<void>
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

export const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; icon: React.ReactNode; color: string }> = {
  housing:       { label: 'Housing',       icon: <Home size={14} />,         color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  childcare:     { label: 'Childcare',     icon: <Baby size={14} />,         color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  subscriptions: { label: 'Subscriptions', icon: <RefreshCw size={14} />,    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  insurance:     { label: 'Insurance',     icon: <Shield size={14} />,       color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  utilities:     { label: 'Utilities',     icon: <Zap size={14} />,          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  transport:     { label: 'Transport',     icon: <Car size={14} />,          color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  pets:          { label: 'Pets',          icon: <PawPrint size={14} />,     color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  other:         { label: 'Other',         icon: <MoreHorizontal size={14} />, color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' }
}

const CATEGORIES = Object.keys(CATEGORY_CONFIG) as ExpenseCategory[]

function monthlyAmount(expense: RecurringExpense): number {
  return expense.billingCycle === 'yearly' ? expense.amount / 12 : expense.amount
}

function calculateCategoryData(expenses: RecurringExpense[]) {
  const active = expenses.filter((e) => e.active)
  const byCategory = active.reduce<Record<string, number>>((acc, expense) => {
    const amount = monthlyAmount(expense)
    acc[expense.category] = (acc[expense.category] ?? 0) + amount
    return acc
  }, {})

  return Object.entries(byCategory).map(([category, amount]) => ({
    name: category,
    amount,
    label: CATEGORY_CONFIG[category as ExpenseCategory]?.label ?? category
  })).sort((a, b) => b.amount - a.amount)
}

export function Expenses({ expenses, familyMembers: rawFamilyMembers, onSave }: ExpensesProps) {
  const { currency } = useCurrency()
  const fmt = (v: number) => formatCurrency(v, currency)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null)
  const categoryRefs = useRef<Record<ExpenseCategory, HTMLDivElement | null>>({} as Record<ExpenseCategory, HTMLDivElement | null>)

  // Ensure familyMembers is properly formatted
  const familyMembers: FamilyMember[] = rawFamilyMembers.map((m: any) => {
    if (typeof m === 'string') {
      return { name: m, isChild: false }
    }
    return m as FamilyMember
  })

  // Filter expenses by selected owner
  const filteredExpenses = selectedOwner
    ? expenses.filter((e) => e.owner === selectedOwner)
    : expenses

  const activeExpenses = filteredExpenses.filter((e) => e.active)
  const totalMonthly = activeExpenses.reduce((sum, e) => sum + monthlyAmount(e), 0)
  const totalYearly = totalMonthly * 12
  const categoryData = calculateCategoryData(filteredExpenses)

  // Group all expenses by category
  const byCategory = CATEGORIES.reduce<Record<ExpenseCategory, RecurringExpense[]>>(
    (acc, cat) => {
      acc[cat] = filteredExpenses.filter((e) => e.category === cat)
      return acc
    },
    {} as Record<ExpenseCategory, RecurringExpense[]>
  )

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
      console.error('Error saving expense:', err)
      alert('Error saving expense: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await onSave(expenses.filter((e) => e.id !== id))
    setDeleteConfirm(null)
  }

  async function handleToggleActive(expense: RecurringExpense) {
    const updated = expenses.map((e) => (e.id === expense.id ? { ...e, active: !e.active } : e))
    await onSave(updated)
  }

  function handleBarClick(data: { name: string }) {
    const ref = categoryRefs.current[data.name as ExpenseCategory]
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const isFormValid = form.name.trim() && parseFloat(form.amount) > 0

  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Recurring Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your fixed monthly costs</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm text-white font-medium transition-colors"
        >
          <Plus size={15} />
          Add Expense
        </button>
      </div>

      {/* Family member filter */}
      {familyMembers.length > 0 && (
        <div className="flex items-center gap-2 mb-8 pb-4 border-b border-white/5">
          <span className="text-xs font-medium text-gray-500">Filter by owner:</span>
          <button
            onClick={() => setSelectedOwner(null)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm transition-colors',
              selectedOwner === null
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'bg-white/5 text-gray-400 border border-white/10 hover:border-white/20'
            )}
          >
            All
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

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <SummaryCard
          label="Total monthly"
          value={formatCurrency(totalMonthly, currency)}
          sub={`${activeExpenses.length} active expense${activeExpenses.length !== 1 ? 's' : ''}`}
        />
        <SummaryCard
          label="Total yearly"
          value={formatCurrency(totalYearly, currency)}
          sub="annualized"
        />
        <SummaryCard
          label="All expenses"
          value={String(expenses.length)}
          sub={expenses.length - activeExpenses.length > 0 ? `${expenses.length - activeExpenses.length} paused` : 'all active'}
          plain
        />
      </div>

      {/* Category chart */}
      {categoryData.length > 0 && (
        <div className="bg-[#14141f] border border-white/5 rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-300 mb-6">Expenses by Category</h2>
          <div className="[&_svg]:cursor-pointer">
            <ResponsiveContainer width="100%" height={260}>
            <BarChart data={categoryData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
                width={72}
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
                formatter={(v) => [fmt(v as number), 'Monthly Amount']}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar dataKey="amount" fill="#f59e0b" radius={[6, 6, 0, 0]} onClick={handleBarClick}>
                {categoryData.map((_, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={['#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#0ea5e9'][idx % 7]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Category groups */}
      {expenses.length === 0 ? (
        <div className="bg-[#14141f] border border-white/5 rounded-xl px-8 py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
            <RefreshCw size={22} className="text-indigo-400" />
          </div>
          <p className="text-sm font-medium text-gray-300 mb-1">No recurring expenses yet</p>
          <p className="text-xs text-gray-600 mb-5">Add subscriptions, rent, utilities and other fixed costs</p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm text-white font-medium transition-colors"
          >
            <Plus size={14} />
            Add your first expense
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.filter((cat) => byCategory[cat].length > 0)
            .sort((a, b) => {
              const aMonthly = byCategory[a].filter((e) => e.active).reduce((s, e) => s + monthlyAmount(e), 0)
              const bMonthly = byCategory[b].filter((e) => e.active).reduce((s, e) => s + monthlyAmount(e), 0)
              return bMonthly - aMonthly
            })
            .map((cat) => {
            const items = byCategory[cat]
            const catMonthly = items.filter((e) => e.active).reduce((s, e) => s + monthlyAmount(e), 0)
            const cfg = CATEGORY_CONFIG[cat]
            return (
              <div key={cat} ref={(el) => { if (el) categoryRefs.current[cat] = el }} className="bg-[#14141f] border border-white/5 rounded-xl overflow-hidden">
                {/* Category header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <span className={cn('flex items-center justify-center w-6 h-6 rounded-md border text-xs', cfg.color)}>
                      {cfg.icon}
                    </span>
                    <span className="text-sm font-semibold text-white">{cfg.label}</span>
                    <span className="text-xs text-gray-600 bg-white/5 rounded-full px-2 py-0.5">{items.length}</span>
                  </div>
                  {catMonthly > 0 && (
                    <span className="text-xs text-gray-400 font-medium">
                      {formatCurrency(catMonthly, currency)}<span className="text-gray-600">/mo</span>
                    </span>
                  )}
                </div>

                {/* Expense rows */}
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
                          <p className={cn('text-sm font-medium', expense.active ? 'text-gray-200' : 'text-gray-500 line-through')}>
                            {expense.name}
                          </p>
                          {expense.billingCycle === 'yearly' && (
                            <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                              yearly
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
                      </div>

                      <div className="flex items-center gap-4 ml-4 shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-200">
                            {formatCurrency(expense.amount, currency)}
                            <span className="text-xs text-gray-600 ml-1">
                              /{expense.billingCycle === 'yearly' ? 'yr' : 'mo'}
                            </span>
                          </p>
                          {expense.billingCycle === 'yearly' && (
                            <p className="text-xs text-gray-600">
                              {formatCurrency(expense.amount / 12, currency)}/mo
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {deleteConfirm === expense.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500 mr-1">Delete?</span>
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
                                title={expense.active ? 'Pause' : 'Activate'}
                              >
                                {expense.active
                                  ? <ToggleRight size={14} className="text-indigo-400" />
                                  : <ToggleLeft size={14} />
                                }
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

      {/* Add/Edit modal */}
      {showModal && (
        <Modal
          title={editingId ? 'Edit Expense' : 'New Expense'}
          onClose={() => setShowModal(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Name</label>
              <input
                autoFocus
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="e.g. Netflix, Kindergarten, Rent…"
                className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Amount</label>
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
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Billing cycle</label>
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
                      {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => {
                  const cfg = CATEGORY_CONFIG[cat]
                  return (
                    <button
                      key={cat}
                      onClick={() => setForm({ ...form, category: cat })}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all text-left',
                        form.category === cat
                          ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                          : 'bg-transparent border-white/10 text-gray-400 hover:border-white/20'
                      )}
                    >
                      <span className={cn('shrink-0', form.category === cat ? 'text-indigo-400' : '')}>{cfg.icon}</span>
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {familyMembers.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Owner <span className="text-gray-600">(optional)</span>
                </label>
                <select
                  value={form.owner}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                  className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                >
                  <option value="">Everyone / shared</option>
                  {familyMembers.map((m) => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Notes <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. 2 kids, premium plan…"
                className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-gray-200 hover:border-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!isFormValid || saving}
                className="flex-1 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white font-medium transition-colors"
              >
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Expense'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  plain
}: {
  label: string
  value: string
  sub: string
  plain?: boolean
}) {
  return (
    <div className="bg-[#14141f] border border-white/5 rounded-xl px-5 py-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={cn('text-2xl font-bold tracking-tight', plain ? 'text-white' : 'text-red-400')}>
        {value}
      </p>
      <p className="text-xs text-gray-600 mt-1">{sub}</p>
    </div>
  )
}
