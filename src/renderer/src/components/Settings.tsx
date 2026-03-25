import { useState } from 'react'
import { Download, Users, Plus, X, Baby } from 'lucide-react'
import { AppData, FamilyMember } from '../types'
import { cn } from '../utils'
import { Modal } from './Accounts'

interface SettingsProps {
  data: AppData
  onSaveFamilyMembers: (members: FamilyMember[]) => Promise<void>
}

const FAMILY_MEMBER_COLORS = [
  'text-rose-300 bg-rose-500/10 border-rose-500/20',
  'text-violet-300 bg-violet-500/10 border-violet-500/20',
  'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  'text-lime-300 bg-lime-500/10 border-lime-500/20',
  'text-amber-300 bg-amber-500/10 border-amber-500/20',
  'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/20'
]

export function Settings({ data, onSaveFamilyMembers }: SettingsProps) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showFamilyModal, setShowFamilyModal] = useState(false)
  const [editingMemberName, setEditingMemberName] = useState<string | null>(null)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberIsChild, setNewMemberIsChild] = useState(false)
  const [savingMember, setSavingMember] = useState(false)

  // Ensure familyMembers is properly formatted (FamilyMember[] not string[])
  const familyMembers: FamilyMember[] = (data.familyMembers || []).map((m: any) => {
    if (typeof m === 'string') {
      return { name: m, isChild: false }
    }
    return m as FamilyMember
  })

  function handleExport() {
    setError(null)
    setSuccess(null)

    try {
      const dataStr = JSON.stringify(data, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `networth-tracker-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setSuccess('Data exported successfully!')
    } catch (err) {
      setError(`Failed to export: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  function openAddMember() {
    setEditingMemberName(null)
    setNewMemberName('')
    setNewMemberIsChild(false)
    setShowFamilyModal(true)
  }

  function openEditMember(member: FamilyMember) {
    setEditingMemberName(member.name)
    setNewMemberName(member.name)
    setNewMemberIsChild(member.isChild || false)
    setShowFamilyModal(true)
  }

  async function handleSaveFamilyMember() {
    if (!newMemberName.trim()) return
    setSavingMember(true)
    try {
      let updated: FamilyMember[]
      if (editingMemberName) {
        // Editing existing member
        updated = familyMembers.map((m) =>
          m.name === editingMemberName
            ? { ...m, name: newMemberName.trim(), isChild: newMemberIsChild }
            : m
        )
      } else {
        // Adding new member
        const newMember: FamilyMember = {
          name: newMemberName.trim(),
          isChild: newMemberIsChild
        }
        updated = [...familyMembers, newMember]
      }
      await onSaveFamilyMembers(updated)
      setNewMemberName('')
      setNewMemberIsChild(false)
      setEditingMemberName(null)
      setShowFamilyModal(false)
    } catch (err) {
      setError(`Failed to save member: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSavingMember(false)
    }
  }

  async function handleRemoveFamilyMember(memberName: string) {
    try {
      const updated = familyMembers.filter((m) => m.name !== memberName)
      await onSaveFamilyMembers(updated)
    } catch (err) {
      setError(`Failed to remove member: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure app preferences</p>
      </div>

      {/* Family Members Section */}
      <div className="space-y-6">
        <div className="bg-[#14141f] border border-white/5 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <Users size={20} className="text-indigo-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Family Members</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Add family members to organize accounts, expenses, and income
                </p>
              </div>
            </div>
            <button
              onClick={openAddMember}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm text-white font-medium transition-colors"
            >
              <Plus size={14} />
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {familyMembers.length === 0 ? (
              <p className="text-xs text-gray-600">No family members added yet</p>
            ) : (
              familyMembers.map((member, index) => {
                const colorClass = FAMILY_MEMBER_COLORS[index % FAMILY_MEMBER_COLORS.length]
                return (
                  <div
                    key={member.name}
                    className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border cursor-pointer hover:shadow-md transition-all ${colorClass}`}
                    onClick={() => openEditMember(member)}
                    role="button"
                  >
                    {member.isChild && <Baby size={13} className="shrink-0" />}
                    <span className="whitespace-nowrap">{member.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveFamilyMember(member.name)
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Backup Section */}
      <div className="space-y-6">
        <div className="bg-[#14141f] border border-white/5 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Download size={20} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Data Backup</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Export your data as a JSON file for backup
              </p>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-400">
              {success}
            </div>
          )}

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition-colors"
          >
            <Download size={16} />
            Export Data as JSON
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-300">How to backup</h3>
        <ul className="text-xs text-gray-500 space-y-2">
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>Click "Export Data as JSON" to download your data</span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>Save the file to Dropbox, Google Drive, or email it to yourself</span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>Your data is always saved locally on this computer</span>
          </li>
        </ul>
      </div>

      {/* Add Family Member Modal */}
      {showFamilyModal && (
        <Modal
          title={editingMemberName ? 'Edit Family Member' : 'Add Family Member'}
          onClose={() => setShowFamilyModal(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Name</label>
              <input
                autoFocus
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveFamilyMember()}
                placeholder="e.g. John"
                className="w-full bg-[#1c1c2a] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
            </div>

            <div>
              <button
                onClick={() => setNewMemberIsChild(!newMemberIsChild)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border transition-all',
                  newMemberIsChild
                    ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                    : 'bg-transparent border-white/10 text-gray-400 hover:border-white/20'
                )}
              >
                <Baby size={14} />
                <span>Mark as child</span>
              </button>
              <p className="text-xs text-gray-600 mt-1.5">Children won't be shown in income filters</p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setShowFamilyModal(false)
                  setNewMemberIsChild(false)
                  setEditingMemberName(null)
                }}
                className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-gray-200 hover:border-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFamilyMember}
                disabled={!newMemberName || !newMemberName.trim() || savingMember}
                className="flex-1 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white font-medium transition-colors"
              >
                {savingMember ? 'Saving…' : editingMemberName ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
