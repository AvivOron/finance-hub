'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, TrendingUp, ToggleLeft, ToggleRight } from 'lucide-react'
import { IncomeSource, FamilyMember } from '../types'
import { generateId, formatCurrency, cn } from '../utils'
import { useCurrency } from '../context/CurrencyContext'
import { Modal } from './Accounts'

interface IncomeProps {
  income: IncomeSource[]
  familyMembers: FamilyMember[]
  onSave: (income: IncomeSource[]) => Promise<void>
}

type FormState = {
  name: string
  grossAmount: string
  netAmount: string
  billingCycle: 'monthly' | 'yearly'
  owner: string
  notes: string
}

const emptyForm: FormState = {
  name: '',
  grossAmount: '',
  netAmount: '',
  billingCycle: 'monthly',
  owner: '',
  notes: ''
}

function monthlyGross(source: IncomeSource): number {
  return source.billingCycle === 'yearly' ? source.grossAmount / 12 : source.grossAmount
}

function monthlyNet(source: IncomeSource): number {
  return source.billingCycle === 'yearly' ? source.netAmount / 12 : source.netAmount
}

export function Income({ income, familyMembers: rawFamilyMembers, onSave }: IncomeProps) {
  const { currency } = useCurrency()
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null)

  const familyMembers: FamilyMember[] = rawFamilyMembers.map((m: any) =>
    typeof m === 'string' ? { name: m, isChild: false } : (m as FamilyMember)
  )

  const filteredIncome = selectedOwner
    ? income.filter((s) => s.owner === selectedOwner)
    : income

  const activeIncome = filteredIncome.filter((s) => s.active)
  const totalMonthlyGross = activeIncome.reduce((sum, s) => sum + monthlyGross(s), 0)
  const totalMonthlyNet = activeIncome.reduce((sum, s) => sum + monthlyNet(s), 0)
  const totalYearlyGross = totalMonthlyGross * 12

  const byOwner: Record<string, IncomeSource[]> = {}
  filteredIncome.forEach((source) => {
    const owner = source.owner || 'Unassigned'
    if (!byOwner[owner]) byOwner[owner] = []
    byOwner[owner].push(source)
  })

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEdit(source: IncomeSource) {
    setEditingId(source.id)
    setForm({
      name: source.name,
      grossAmount: String(source.grossAmount),
      netAmount: String(source.netAmount),
      billingCycle: source.billingCycle,
      owner: source.owner ?? '',
      notes: source.notes ?? ''
    })
    setShowModal(true)
  }

  async function handleSave() {
    const gross = parseFloat(form.grossAmount)
    const net = parseFloat(form.netAmount)
    if (!form.name.trim() || isNaN(gross) || isNaN(net) || gross <= 0 || net <= 0) return
    setSaving(true)
    try {
      let updated: IncomeSource[]
      if (editingId) {
        updated = income.map((s) =>
          s.id === editingId
            ? {
                ...s,
                name: form.name.trim(),
                grossAmount: gross,
                netAmount: net,
                billingCycle: form.billingCycle,
                owner: form.owner || undefined,
                notes: form.notes.trim() || undefined
              }
            : s
        )
      } else {
        const newSource: IncomeSource = {
          id: generateId(),
          name: form.name.trim(),
          type: 'salary',
          grossAmount: gross,
          netAmount: net,
          billingCycle: form.billingCycle,
          owner: form.owner || undefined,
          notes: form.notes.trim() || undefined,
          active: true
        }
        updated = [...income, newSource]
      }
      await onSave(updated)
      setShowModal(false)
    } catch (err) {
      alert('Error saving income: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await onSave(income.filter((s) => s.id !== id))
    setDeleteConfirm(null)
  }

  async function handleToggleActive(source: IncomeSource) {
    await onSave(income.map((s) => (s.id === source.id ? { ...s, active: !s.active } : s)))
  }

  const isFormValid =
    form.name.trim() && parseFloat(form.grossAmount) > 0 && parseFloat(form.netAmount) > 0

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Income</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track gross and net income sources</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm text-white font-medium transition-colors"
        >
          <Plus size={15} />
          Add Income
        </button>
      </div>

      {filteredIncome.some((s) => s.owner) && (
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
          {familyMembers
            .filter((m) => !m.isChild)
            .map((member) => (
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

      <div className="grid grid-cols-4 gap-4 mb-8">
        <SummaryCard
          label="Total gross / month"
          value={formatCurrency(totalMonthlyGross, currency)}
          sub={`${activeIncome.length} active income${activeIncome.length !== 1 ? 's' : ''}`}
        />
        <SummaryCard
          label="Total net / month"
          value={formatCurrency(totalMonthlyNet, currency)}
          sub="take home"
        />
        <SummaryCard
          label="Total gross / year"
          value={formatCurrency(totalYearlyGross, currency)}
          sub="annualized"
        />
        <SummaryCard
          label="All sources"
          value={String(income.length)}
          sub={
            income.length - activeIncome.length > 0
              ? `${income.length - activeIncome.length} paused`
              : 'all active'
          }
          plain
        />
      </div>

      {income.length === 0 ? (
        <div className="bg-[#14141f] border border-white/5 rounded-xl px-8 py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
            <TrendingUp size={22} className="text-indigo-400" />
          </div>
          <p className="text-sm font-medium text-gray-300 mb-1">No income sources yet</p>
          <p className="text-xs text-gray-600 mb-5">Add salaries and other income sources</p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm text-white font-medium transition-colors"
          >
            <Plus size={14} />
            Add your first income
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byOwner)
            .sort((a, b) => {
              const aNet = a[1].filter((s) => s.active).reduce((sum, s) => sum + monthlyNet(s), 0)
              const bNet = b[1].filter((s) => s.active).reduce((sum, s) => sum + monthlyNet(s), 0)
              return bNet - aNet
            })
            .map(([owner, sources]) => (
              <div
                key={owner}
                className="bg-[#14141f] border border-white/5 rounded-xl overflow-hidden"
              >
                <div className="px-5 py-3.5 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-white">{owner}</span>
                    <span className="text-xs text-gray-600 bg-white/5 rounded-full px-2 py-0.5">
                      {sources.length}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-white/5">
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      className={cn(
                        'flex items-center justify-between px-5 py-3.5 group',
                        !source.active && 'opacity-50'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p
                            className={cn(
                              'text-sm font-medium',
                              source.active ? 'text-gray-200' : 'text-gray-500 line-through'
                            )}
                          >
                            {source.name}
                          </p>
                          {source.billingCycle === 'yearly' && (
                            <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                              yearly
                            </span>
                          )}
                        </div>
                        {source.notes && (
                          <p className="text-xs text-gray-600 mt-0.5 truncate">{source.notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        <div className="text-right">
                          <div className="flex items-baseline gap-2">
                            <div className="flex flex-col items-start">
                              <div className="flex items-baseline gap-1">
                                <span className="text-sm font-semibold text-green-400">
                                  {formatCurrency(source.grossAmount, currency)}
                                </span>
                                <span className="text-xs text-gray-600">gross</span>
                              </div>
                              <p className="text-xs text-gray-600 mt-0.5">
                                {source.billingCycle === 'yearly'
                                  ? `${formatCurrency(source.grossAmount / 12, currency)}/mo`
                                  : `${formatCurrency(source.grossAmount * 12, currency)}/yr`}
                              </p>
                            </div>
                            <span className="text-xs text-gray-700">•</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm font-semibold text-green-300">
                                {formatCurrency(source.netAmount, currency)}
                              </span>
                              <span className="text-xs text-gray-600">net</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {deleteConfirm === source.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500 mr-1">Delete?</span>
                              <button
                                onClick={() => handleDelete(source.id)}
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
                                onClick={() => handleToggleActive(source)}
                                className="p-1.5 rounded-md hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
                                title={source.active ? 'Pause' : 'Activate'}
                              >
                                {source.active ? (
                                  <ToggleRight size={14} className="text-indigo-400" />
                                ) : (
                                  <ToggleLeft size={14} />
                                )}
                              </button>
                              <button
                                onClick={() => openEdit(source)}
                                className="p-1.5 rounded-md hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(source.id)}
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
            ))}
        </div>
      )}

      {showModal && (
        <Modal
          title={editingId ? 'Edit Income' : 'New Income'}
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
                placeholder="e.g. Main Job, Part-time…"
                className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Gross amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.grossAmount}
                  onChange={(e) => setForm({ ...form, grossAmount: e.target.value })}
                  placeholder="0"
                  className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Net amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.netAmount}
                  onChange={(e) => setForm({ ...form, netAmount: e.target.value })}
                  placeholder="0"
                  className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
              </div>
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
                  <option value="">Unassigned / shared</option>
                  {familyMembers
                    .filter((m) => !m.isChild)
                    .map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
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
                placeholder="e.g. Annual review, depends on bonus…"
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
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Income'}
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
      <p className={cn('text-2xl font-bold tracking-tight', plain ? 'text-white' : 'text-green-400')}>
        {value}
      </p>
      <p className="text-xs text-gray-600 mt-1">{sub}</p>
    </div>
  )
}
