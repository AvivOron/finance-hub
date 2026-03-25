import { useState } from 'react'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Check, Landmark, LineChart, Baby, Globe, X } from 'lucide-react'
import { Account, AccountKind, FamilyMember } from '../types'
import { generateId, cn } from '../utils'

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
}

const emptyForm: FormState = { name: '', type: 'asset', kind: 'custom', owner: '', notes: '', url: '' }

export const ACCOUNT_KIND_CONFIG: Record<
  Exclude<AccountKind, 'custom'>,
  { label: string; icon: React.ReactNode; subLabels?: string[] }
> = {
  bank: {
    label: 'Bank Account',
    icon: <Landmark size={13} />,
    subLabels: ['checking', 'savings']
  },
  brokerage: {
    label: 'Brokerage Account',
    icon: <LineChart size={13} />
  },
  child: {
    label: 'Child Savings',
    icon: <Baby size={13} />
  }
}

const ACCOUNT_KINDS: { value: AccountKind; label: string; description: string }[] = [
  { value: 'bank', label: 'Bank Account', description: 'Checking + Savings balances' },
  { value: 'brokerage', label: 'Brokerage Account', description: 'Single balance' },
  { value: 'child', label: 'Child Savings', description: 'Single balance' },
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
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Ensure familyMembers is properly formatted
  const familyMembers: FamilyMember[] = rawFamilyMembers.map((m: any) => {
    if (typeof m === 'string') {
      return { name: m, isChild: false }
    }
    return m as FamilyMember
  })

  const assets = accounts.filter((a) => a.type === 'asset')
  const liabilities = accounts.filter((a) => a.type === 'liability')

  function openAdd(type: 'asset' | 'liability' = 'asset') {
    setEditingId(null)
    setForm({ ...emptyForm, type })
    setShowModal(true)
  }

  function openEdit(account: Account) {
    setEditingId(account.id)
    setForm({ name: account.name, type: account.type, kind: account.kind ?? 'custom', owner: account.owner ?? '', notes: account.notes ?? '', url: account.url ?? '' })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      let updated: Account[]
      if (editingId) {
        updated = accounts.map((a) =>
          a.id === editingId ? { ...a, name: form.name.trim(), type: form.type, kind: form.kind, owner: form.owner || undefined, notes: form.notes.trim() || undefined, url: form.url.trim() || undefined } : a
        )
      } else {
        const newAccount: Account = {
          id: generateId(),
          name: form.name.trim(),
          type: form.type,
          kind: form.kind,
          owner: form.owner || undefined,
          notes: form.notes.trim() || undefined,
          url: form.url.trim() || undefined
        }
        updated = [...accounts, newAccount]
      }
      console.log('Calling onSave with', updated.length, 'accounts')
      await onSave(updated)
      console.log('Save completed')
    } catch (error) {
      console.error('Error saving account:', error)
      alert('Error saving account: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      console.log('Resetting save state')
      setSaving(false)
      setShowModal(false)
    }
  }

  async function handleDelete(id: string) {
    const updated = accounts.filter((a) => a.id !== id)
    await onSave(updated)
    setDeleteConfirm(null)
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your asset and liability categories</p>
        </div>
        <button
          onClick={() => openAdd()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm text-white font-medium transition-colors"
        >
          <Plus size={15} />
          Add Account
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <AccountGroup
          title="Assets"
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
        />
        <AccountGroup
          title="Liabilities"
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
        />
      </div>

      {showModal && (
        <Modal
          title={editingId ? 'Edit Account' : 'New Account'}
          onClose={() => setShowModal(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Account Name</label>
              <input
                autoFocus
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="e.g. Checking Account"
                className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Account Kind</label>
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
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Type</label>
              <div className="flex gap-2">
                {(['asset', 'liability'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, type: t })}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-medium border transition-all',
                      form.type === t
                        ? t === 'asset'
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-red-500/15 border-red-500/30 text-red-300'
                        : 'bg-transparent border-white/10 text-gray-400 hover:border-white/20'
                    )}
                  >
                    {t === 'asset' ? 'Asset' : 'Liability'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Owner <span className="text-gray-600">(optional)</span>
              </label>
              <select
                value={form.owner}
                onChange={(e) => setForm({ ...form, owner: e.target.value })}
                className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              >
                <option value="">Select family member...</option>
                {familyMembers?.map((member) => (
                  <option key={member.name} value={member.name}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Notes <span className="text-gray-600">(optional)</span>
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="e.g. Chase bank, joint account..."
                rows={2}
                className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Vendor URL <span className="text-gray-600">(optional)</span>
              </label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="e.g. https://www.chase.com"
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
                disabled={!form.name.trim() || saving}
                className="flex-1 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white font-medium transition-colors"
              >
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Account'}
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
  onDeleteCancel
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
}) {
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
          Add
        </button>
      </div>

      <div className="divide-y divide-white/5">
        {accounts.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-600">No {title.toLowerCase()} yet</p>
            <button
              onClick={onAdd}
              className={cn(
                'mt-2 text-xs font-medium transition-colors',
                color === 'emerald' ? 'text-emerald-500 hover:text-emerald-400' : 'text-red-500 hover:text-red-400'
              )}
            >
              + Add {color === 'emerald' ? 'asset' : 'liability'}
            </button>
          </div>
        ) : (
          accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between px-5 py-3.5 group">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-200 truncate">{account.name}</p>
                  {account.url && (
                    <button
                      onClick={() => window.api.openExternal(account.url!)}
                      className="shrink-0 p-1 text-gray-400 hover:text-indigo-400 transition-colors"
                      title="Open vendor website"
                    >
                      <Globe size={13} />
                    </button>
                  )}
                  {account.kind && account.kind !== 'custom' && (
                    <span className="shrink-0 flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-2.5 py-0.5">
                      {ACCOUNT_KIND_CONFIG[account.kind].icon}
                      {ACCOUNT_KIND_CONFIG[account.kind].label.replace(' Account', '')}
                    </span>
                  )}
                  {account.owner && (() => {
                    const colorIndex = familyMembers.findIndex((m) => m.name === account.owner) % FAMILY_MEMBER_COLORS.length
                    return (
                      <span className={`shrink-0 flex items-center text-[10px] border rounded-full px-2.5 py-0.5 ${FAMILY_MEMBER_COLORS[colorIndex]}`}>
                        {account.owner}
                      </span>
                    )
                  })()}
                </div>
                {account.notes && (
                  <p className="text-xs text-gray-600 truncate mt-1">{account.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                {deleteConfirm === account.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 mr-1">Delete?</span>
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
      <div className="bg-[#14141f] border border-white/10 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
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
