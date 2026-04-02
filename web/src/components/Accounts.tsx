'use client'

import { useState, useRef } from 'react'
import {
  Plus, Pencil, Trash2, TrendingUp, TrendingDown, Check,
  Landmark, LineChart, Baby, Globe, X, PiggyBank, GripVertical
} from 'lucide-react'
import { Account, AccountKind, FamilyMember } from '../types'
import { generateId, cn } from '../utils'
import { useLanguage } from '@/context/LanguageContext'
import { t } from '@/translations'

interface AccountsProps {
  accounts: Account[]
  familyMembers: FamilyMember[]
  onSave: (accounts: Account[]) => Promise<void>
}

type FormState = {
  name: string
  type: 'asset' | 'liability'
  kind: AccountKind
  owner: string
  notes: string
  url: string
  monthlyDeposit: string
  feesFixed: string
  feesOnBalance: string
  feesOnDeposit: string
  description: string
}

const emptyForm: FormState = { name: '', type: 'asset', kind: 'custom', owner: '', notes: '', url: '', monthlyDeposit: '', feesFixed: '', feesOnBalance: '', feesOnDeposit: '', description: '' }

export const ACCOUNT_KIND_CONFIG: Record<
  Exclude<AccountKind, 'custom'>,
  { label: string; icon: React.ReactNode; subLabels?: string[] }
> = {
  bank: {
    label: 'Bank Account',
    icon: <Landmark size={13} />,
    subLabels: ['checking', 'savings', 'investments']
  },
  brokerage: {
    label: 'Brokerage Account',
    icon: <LineChart size={13} />
  },
  child: {
    label: 'Child Savings',
    icon: <Baby size={13} />
  },
  piggyBank: {
    label: 'Savings Fund',
    icon: <PiggyBank size={13} />
  }
}

const ACCOUNT_KINDS: { value: AccountKind; label: string; description: string }[] = [
  { value: 'bank', label: 'Bank Account', description: 'Checking, Savings & Investments' },
  { value: 'brokerage', label: 'Brokerage Account', description: 'Single balance' },
  { value: 'child', label: 'Child Savings', description: 'Single balance' },
  { value: 'piggyBank', label: 'Savings Fund', description: 'Single balance' },
  { value: 'custom', label: 'Custom', description: 'Single balance' }
]

const FAMILY_MEMBER_COLORS = [
  'text-rose-300 bg-rose-500/10 border-rose-500/20',
  'text-violet-300 bg-violet-500/10 border-violet-500/20',
  'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  'text-lime-300 bg-lime-500/10 border-lime-500/20',
  'text-amber-300 bg-amber-500/10 border-amber-500/20',
  'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20'
]

export function Accounts({ accounts, familyMembers: rawFamilyMembers, onSave }: AccountsProps) {
  const { lang } = useLanguage()
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const familyMembers: FamilyMember[] = rawFamilyMembers.map((m: any) =>
    typeof m === 'string' ? { name: m, isChild: false } : (m as FamilyMember)
  )

  const assets = accounts.filter((a) => a.type === 'asset')
  const liabilities = accounts.filter((a) => a.type === 'liability')

  function openAdd(type: 'asset' | 'liability' = 'asset') {
    setEditingId(null)
    setForm({ ...emptyForm, type })
    setShowModal(true)
  }

  function openEdit(account: Account) {
    setEditingId(account.id)
    setForm({
      name: account.name,
      type: account.type,
      kind: account.kind ?? 'custom',
      owner: account.owner ?? '',
      notes: account.notes ?? '',
      url: account.url ?? '',
      monthlyDeposit: account.monthlyDeposit != null ? String(account.monthlyDeposit) : '',
      feesFixed: account.feesFixed != null ? String(account.feesFixed) : '',
      feesOnBalance: account.feesOnBalance != null ? String(account.feesOnBalance) : '',
      feesOnDeposit: account.feesOnDeposit != null ? String(account.feesOnDeposit) : '',
      description: account.description ?? ''
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      let updated: Account[]
      const monthlyDeposit = form.monthlyDeposit.trim() ? parseFloat(form.monthlyDeposit) : undefined
      const feesFixed = form.feesFixed.trim() ? parseFloat(form.feesFixed) : undefined
      const feesOnBalance = form.feesOnBalance.trim() ? parseFloat(form.feesOnBalance) : undefined
      const feesOnDeposit = form.feesOnDeposit.trim() ? parseFloat(form.feesOnDeposit) : undefined
      const description = form.description.trim() || undefined

      if (editingId) {
        updated = accounts.map((a) =>
          a.id === editingId
            ? {
                ...a,
                name: form.name.trim(),
                type: form.type,
                kind: form.kind,
                owner: form.owner || undefined,
                notes: form.notes.trim() || undefined,
                url: form.url.trim() || undefined,
                monthlyDeposit,
                feesFixed,
                feesOnBalance,
                feesOnDeposit,
                description
              }
            : a
        )
      } else {
        const newAccount: Account = {
          id: generateId(),
          name: form.name.trim(),
          type: form.type,
          kind: form.kind,
          owner: form.owner || undefined,
          notes: form.notes.trim() || undefined,
          url: form.url.trim() || undefined,
          monthlyDeposit,
          feesFixed,
          feesOnBalance,
          feesOnDeposit,
          description
        }
        updated = [...accounts, newAccount]
      }
      await onSave(updated)
    } catch (error) {
      alert(t('accounts.error.save', lang) + (error instanceof Error ? error.message : String(error)))
    } finally {
      setSaving(false)
      setShowModal(false)
    }
  }

  async function handleDelete(id: string) {
    await onSave(accounts.filter((a) => a.id !== id))
    setDeleteConfirm(null)
  }

  async function handleReorder(reordered: Account[]) {
    const groupType = reordered[0]?.type
    if (!groupType) return
    const others = accounts.filter((a) => a.type !== groupType)
    await onSave([...reordered, ...others])
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t('accounts.title', lang)}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('accounts.subtitle', lang)}</p>
        </div>
        <button
          onClick={() => openAdd()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm text-white font-medium transition-colors"
        >
          <Plus size={15} />
          {t('accounts.addButton', lang)}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AccountGroup
          title={t('accounts.group.assets', lang)}
          icon={<TrendingUp size={15} className="text-emerald-400" />}
          color="emerald"
          accounts={assets}
          familyMembers={familyMembers}
          deleteConfirm={deleteConfirm}
          onAdd={() => openAdd('asset')}
          onEdit={openEdit}
          onDeleteRequest={(id) => setDeleteConfirm(id)}
          onDeleteConfirm={handleDelete}
          onDeleteCancel={() => setDeleteConfirm(null)}
          onReorder={handleReorder}
          lang={lang}
        />
        <AccountGroup
          title={t('accounts.group.liabilities', lang)}
          icon={<TrendingDown size={15} className="text-red-400" />}
          color="red"
          accounts={liabilities}
          familyMembers={familyMembers}
          deleteConfirm={deleteConfirm}
          onAdd={() => openAdd('liability')}
          onEdit={openEdit}
          onDeleteRequest={(id) => setDeleteConfirm(id)}
          onDeleteConfirm={handleDelete}
          onDeleteCancel={() => setDeleteConfirm(null)}
          onReorder={handleReorder}
          lang={lang}
        />
      </div>

      {showModal && (
        <Modal title={editingId ? t('accounts.modal.editTitle', lang) : t('accounts.modal.newTitle', lang)} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('accounts.modal.nameLabel', lang)}</label>
              <input
                autoFocus
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder={t('accounts.modal.namePlaceholder', lang)}
                className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('accounts.modal.kindLabel', lang)}</label>
              <div className="flex flex-col gap-2">
                {ACCOUNT_KINDS.map((k) => (
                  <button
                    key={k.value}
                    onClick={() => setForm({ ...form, kind: k.value })}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm border transition-all text-left',
                      form.kind === k.value
                        ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                        : 'bg-transparent border-white/10 text-gray-400 hover:border-white/20'
                    )}
                  >
                    {k.value !== 'custom' && (
                      <span className="shrink-0">{ACCOUNT_KIND_CONFIG[k.value].icon}</span>
                    )}
                    <div>
                      <span className="font-medium">{k.label}</span>
                      <span className="ml-2 text-xs opacity-60">{k.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('accounts.modal.typeLabel', lang)}</label>
              <div className="flex gap-2">
                {(['asset', 'liability'] as const).map((t_) => (
                  <button
                    key={t_}
                    onClick={() => setForm({ ...form, type: t_ })}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium border transition-all',
                      form.type === t_
                        ? t_ === 'asset'
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-red-500/15 border-red-500/30 text-red-300'
                        : 'bg-transparent border-white/10 text-gray-400 hover:border-white/20'
                    )}
                  >
                    {t_ === 'asset' ? t('accounts.modal.type.asset', lang) : t('accounts.modal.type.liability', lang)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                {t('accounts.modal.ownerLabel', lang)} <span className="text-gray-600">{t('accounts.modal.ownerOptional', lang)}</span>
              </label>
              <select
                value={form.owner}
                onChange={(e) => setForm({ ...form, owner: e.target.value })}
                className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              >
                <option value="">{t('accounts.modal.ownerPlaceholder', lang)}</option>
                {familyMembers?.map((member) => (
                  <option key={member.name} value={member.name}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                {t('accounts.modal.notesLabel', lang)} <span className="text-gray-600">{t('accounts.modal.notesOptional', lang)}</span>
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t('accounts.modal.notesPlaceholder', lang)}
                rows={2}
                className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                {t('accounts.modal.urlLabel', lang)} <span className="text-gray-600">{t('accounts.modal.urlOptional', lang)}</span>
              </label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder={t('accounts.modal.urlPlaceholder', lang)}
                className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-medium text-gray-400 mb-1.5 min-h-[2.5rem] flex items-end">
                  <span>{t('accounts.modal.monthlyDepositLabel', lang)} <span className="text-gray-600">{t('accounts.modal.optional', lang)}</span></span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.monthlyDeposit}
                  onChange={(e) => setForm({ ...form, monthlyDeposit: e.target.value })}
                  placeholder={t('accounts.modal.monthlyDepositPlaceholder', lang)}
                  className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
              </div>
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-medium text-gray-400 mb-1.5 min-h-[2.5rem] flex items-end">
                  <span>{t('accounts.modal.feesFixedLabel', lang)} <span className="text-gray-600">{t('accounts.modal.optional', lang)}</span></span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.feesFixed}
                  onChange={(e) => setForm({ ...form, feesFixed: e.target.value })}
                  placeholder={t('accounts.modal.feesPlaceholder', lang)}
                  className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-medium text-gray-400 mb-1.5 min-h-[2.5rem] flex items-end">
                  <span>{t('accounts.modal.feesOnBalanceLabel', lang)} <span className="text-gray-600">{t('accounts.modal.optional', lang)}</span></span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.feesOnBalance}
                    onChange={(e) => setForm({ ...form, feesOnBalance: e.target.value })}
                    placeholder="0.5"
                    className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 ltr:pr-10 rtl:pl-10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                  />
                  <span className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">%/yr</span>
                </div>
              </div>
              <div className="flex-1 flex flex-col">
                <label className="text-xs font-medium text-gray-400 mb-1.5 min-h-[2.5rem] flex items-end">
                  <span>{t('accounts.modal.feesOnDepositLabel', lang)} <span className="text-gray-600">{t('accounts.modal.optional', lang)}</span></span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.feesOnDeposit}
                    onChange={(e) => setForm({ ...form, feesOnDeposit: e.target.value })}
                    placeholder="1.5"
                    className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 ltr:pr-8 rtl:pl-8 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                  />
                  <span className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">%</span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                {t('accounts.modal.descriptionLabel', lang)} <span className="text-gray-600">{t('accounts.modal.optional', lang)}</span>
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('accounts.modal.descriptionPlaceholder', lang)}
                rows={2}
                className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-gray-200 hover:border-white/20 transition-colors"
              >
                {t('accounts.modal.cancel', lang)}
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || saving}
                className="flex-1 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white font-medium transition-colors"
              >
                {saving ? t('accounts.modal.saving', lang) : editingId ? t('accounts.modal.saveChanges', lang) : t('accounts.modal.create', lang)}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function AccountGroup({
  title,
  icon,
  color,
  accounts,
  familyMembers,
  deleteConfirm,
  onAdd,
  onEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  onReorder,
  lang
}: {
  title: string
  icon: React.ReactNode
  color: 'emerald' | 'red'
  accounts: Account[]
  familyMembers: FamilyMember[]
  deleteConfirm: string | null
  onAdd: () => void
  onEdit: (a: Account) => void
  onDeleteRequest: (id: string) => void
  onDeleteConfirm: (id: string) => void
  onDeleteCancel: () => void
  onReorder: (reordered: Account[]) => void
  lang: string
}) {
  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function handleDragStart(index: number) {
    dragIndex.current = index
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDragOverIndex(index)
  }

  function handleDrop(index: number) {
    if (dragIndex.current === null || dragIndex.current === index) {
      dragIndex.current = null
      setDragOverIndex(null)
      return
    }
    const reordered = [...accounts]
    const [moved] = reordered.splice(dragIndex.current, 1)
    reordered.splice(index, 0, moved)
    dragIndex.current = null
    setDragOverIndex(null)
    onReorder(reordered)
  }

  function handleDragEnd() {
    dragIndex.current = null
    setDragOverIndex(null)
  }

  return (
    <div className="bg-[#14141f] border border-white/5 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-white">{title}</span>
          <span className="ml-1 text-xs text-gray-600 bg-white/5 rounded-full px-2 py-0.5">
            {accounts.length}
          </span>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          <Plus size={13} />
          {t(`accounts.group.addShort`, lang)}
        </button>
      </div>

      <div className="divide-y divide-white/5">
        {accounts.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-600">{t(color === 'emerald' ? 'accounts.empty.assets' : 'accounts.empty.liabilities', lang)}</p>
            <button
              onClick={onAdd}
              className={cn(
                'mt-2 text-xs font-medium transition-colors',
                color === 'emerald'
                  ? 'text-emerald-500 hover:text-emerald-400'
                  : 'text-red-500 hover:text-red-400'
              )}
            >
              {t(color === 'emerald' ? 'accounts.group.addAsset' : 'accounts.group.addLiability', lang)}
            </button>
          </div>
        ) : (
          accounts.map((account, index) => (
            <div
              key={account.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={cn(
                'flex items-center justify-between pl-1 pr-5 py-3.5 group transition-colors',
                dragOverIndex === index && dragIndex.current !== index
                  ? 'bg-indigo-500/10 border-t border-indigo-500/30'
                  : ''
              )}
            >
              <div className="flex items-start gap-4 min-w-0">
                <GripVertical
                  size={18}
                  className="shrink-0 text-gray-600 cursor-grab active:cursor-grabbing mt-1"
                />
                <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-200 truncate">{account.name}</p>
                  {account.url && (
                    <a
                      href={account.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-1 text-gray-400 hover:text-indigo-400 transition-colors"
                      title={t('accounts.tooltip.openVendor', lang)}
                    >
                      <Globe size={13} />
                    </a>
                  )}
                  {account.kind && account.kind !== 'custom' && (
                    <span className="shrink-0 flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-2.5 py-0.5">
                      {ACCOUNT_KIND_CONFIG[account.kind].icon}
                      {ACCOUNT_KIND_CONFIG[account.kind].label.replace(' Account', '')}
                    </span>
                  )}
                  {account.owner &&
                    (() => {
                      const colorIndex =
                        familyMembers.findIndex((m) => m.name === account.owner) %
                        FAMILY_MEMBER_COLORS.length
                      return (
                        <span
                          className={`shrink-0 flex items-center text-[10px] border rounded-full px-2.5 py-0.5 ${FAMILY_MEMBER_COLORS[colorIndex]}`}
                        >
                          {account.owner}
                        </span>
                      )
                    })()}
                </div>
                {account.notes && (
                  <p className="text-xs text-gray-600 truncate mt-1">{account.notes}</p>
                )}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                {deleteConfirm === account.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 mr-1">{t('accounts.deleteConfirm', lang)}</span>
                    <button
                      onClick={() => onDeleteConfirm(account.id)}
                      className="p-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={onDeleteCancel}
                      className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => onEdit(account)}
                      className="p-1.5 rounded-md hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => onDeleteRequest(account.id)}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#14141f] border border-white/10 rounded-2xl w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
