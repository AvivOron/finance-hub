import { useState } from 'react'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, X, Check } from 'lucide-react'
import { Account } from '../types'
import { generateId, cn } from '../utils'

interface AccountsProps {
  accounts: Account[]
  onSave: (accounts: Account[]) => Promise<void>
}

type FormState = {
  name: string
  type: 'asset' | 'liability'
  notes: string
}

const emptyForm: FormState = { name: '', type: 'asset', notes: '' }

export function Accounts({ accounts, onSave }: AccountsProps) {
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const assets = accounts.filter((a) => a.type === 'asset')
  const liabilities = accounts.filter((a) => a.type === 'liability')

  function openAdd(type: 'asset' | 'liability' = 'asset') {
    setEditingId(null)
    setForm({ ...emptyForm, type })
    setShowModal(true)
  }

  function openEdit(account: Account) {
    setEditingId(account.id)
    setForm({ name: account.name, type: account.type, notes: account.notes ?? '' })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    let updated: Account[]
    if (editingId) {
      updated = accounts.map((a) =>
        a.id === editingId ? { ...a, name: form.name.trim(), type: form.type, notes: form.notes.trim() || undefined } : a
      )
    } else {
      const newAccount: Account = {
        id: generateId(),
        name: form.name.trim(),
        type: form.type,
        notes: form.notes.trim() || undefined
      }
      updated = [...accounts, newAccount]
    }
    await onSave(updated)
    setSaving(false)
    setShowModal(false)
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
                <p className="text-sm font-medium text-gray-200 truncate">{account.name}</p>
                {account.notes && (
                  <p className="text-xs text-gray-600 truncate mt-0.5">{account.notes}</p>
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
