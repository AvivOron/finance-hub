'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, Mail, Users, Plus, X, Baby, Cloud, Home, Copy, Check, LogOut, Trash2, Link, RefreshCw } from 'lucide-react'
import { AppData, FamilyMember } from '../types'
import { cn } from '../utils'
import { useLanguage } from '@/context/LanguageContext'
import { t } from '@/translations'
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

// ─── Household types ──────────────────────────────────────────────────────────

type HouseholdStatus =
  | { status: 'loading' }
  | { status: 'none' }
  | {
      status: 'owner'
      householdId: string
      inviteToken: string | null
      members: { id: string; name: string | null; email: string | null; image: string | null; joinedAt: string }[]
    }
  | { status: 'member'; householdId: string; owner: { name: string | null; email: string | null; image: string | null } }

// ─── Household section component ─────────────────────────────────────────────

function HouseholdSection({ lang }: { lang: string }) {
  const [state, setState] = useState<HouseholdStatus>({ status: 'loading' })
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmDisband, setShowConfirmDisband] = useState(false)
  const [showConfirmLeave, setShowConfirmLeave] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/finance-hub/api/household')
      if (res.ok) setState(await res.json())
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function createHousehold() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/finance-hub/api/household', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error); return }
      await load()
    } catch {
      setError('Failed to create household')
    } finally {
      setBusy(false)
    }
  }

  async function generateInvite() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/finance-hub/api/household/invite', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error); return }
      await load()
    } catch {
      setError('Failed to generate invite link')
    } finally {
      setBusy(false)
    }
  }

  async function revokeInvite() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/finance-hub/api/household/invite', { method: 'DELETE' })
      if (!res.ok) { setError('Failed to revoke invite'); return }
      await load()
    } catch {
      setError('Failed to revoke invite')
    } finally {
      setBusy(false)
    }
  }

  async function removeMember(memberId: string) {
    // Owner removes a member by having the member's session, which we don't have.
    // Instead: we call a dedicated remove endpoint or re-use DELETE with a body.
    // For now we don't support owner-side removal via this UI; members leave themselves.
    // (Could be added later)
    void memberId
  }

  async function disband() {
    setBusy(true)
    setError(null)
    setShowConfirmDisband(false)
    try {
      const res = await fetch('/finance-hub/api/household', { method: 'DELETE' })
      if (!res.ok) { setError('Failed to disband household'); return }
      await load()
    } catch {
      setError('Failed to disband household')
    } finally {
      setBusy(false)
    }
  }

  async function leave() {
    setBusy(true)
    setError(null)
    setShowConfirmLeave(false)
    try {
      const res = await fetch('/finance-hub/api/household', { method: 'DELETE' })
      if (!res.ok) { setError('Failed to leave household'); return }
      // Reload page so data (now their own) is re-fetched
      window.location.reload()
    } catch {
      setError('Failed to leave household')
    } finally {
      setBusy(false)
    }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/finance-hub/invite/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (state.status === 'loading') {
    return (
      <div className="bg-[#14141f] border border-white/5 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Home size={20} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Household Sharing</h2>
            <p className="text-xs text-gray-500 mt-0.5">Invite family members to share your data</p>
          </div>
        </div>
        <div className="h-6 w-32 bg-white/5 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-[#14141f] border border-white/5 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
          <Home size={20} className="text-indigo-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Household Sharing</h2>
          <p className="text-xs text-gray-500 mt-0.5">Invite family members to share your data</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── No household ── */}
      {state.status === 'none' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 leading-relaxed">
            Create a household to generate an invite link you can share with your partner or family.
            They&apos;ll see and edit the same data as you.
          </p>
          <button
            onClick={createHousehold}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            <Plus size={14} />
            {busy ? 'Creating…' : 'Create Household'}
          </button>
        </div>
      )}

      {/* ── Owner view ── */}
      {state.status === 'owner' && (
        <div className="space-y-4">
          {/* Members list */}
          {state.members.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-400">Members</p>
              <div className="space-y-1.5">
                {state.members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5"
                  >
                    {m.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.image} alt="" className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-indigo-500/30 flex items-center justify-center text-xs text-indigo-300 font-medium">
                        {(m.name ?? m.email ?? '?')[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm text-gray-200 flex-1 min-w-0 truncate">
                      {m.name ?? m.email ?? 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-600">
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite link */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-400">Invite link</p>
            {state.inviteToken ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                  <Link size={13} className="text-gray-500 shrink-0" />
                  <span className="text-xs text-gray-400 flex-1 min-w-0 truncate font-mono">
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}/finance-hub/invite/${state.inviteToken}`
                      : `…/invite/${state.inviteToken}`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyLink(state.inviteToken!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-medium transition-colors"
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy link'}
                  </button>
                  <button
                    onClick={generateInvite}
                    disabled={busy}
                    title="Generate a new link (invalidates the current one)"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 text-gray-400 hover:text-gray-200 text-xs transition-colors disabled:opacity-40"
                  >
                    <RefreshCw size={12} />
                    Regenerate
                  </button>
                  <button
                    onClick={revokeInvite}
                    disabled={busy}
                    title="Revoke invite link"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 text-xs transition-colors disabled:opacity-40"
                  >
                    <X size={12} />
                    Revoke
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={generateInvite}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white text-xs font-medium transition-colors"
              >
                <Link size={12} />
                {busy ? 'Generating…' : 'Generate invite link'}
              </button>
            )}
          </div>

          {/* Danger zone */}
          <div className="pt-2 border-t border-white/5">
            <button
              onClick={() => setShowConfirmDisband(true)}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 text-xs transition-colors disabled:opacity-40"
            >
              <Trash2 size={12} />
              Disband household
            </button>
          </div>
        </div>
      )}

      {/* ── Member view ── */}
      {state.status === 'member' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5">
            {state.owner.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={state.owner.image} alt="" className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-indigo-500/30 flex items-center justify-center text-sm text-indigo-300 font-medium">
                {(state.owner.name ?? state.owner.email ?? '?')[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm text-gray-200 font-medium truncate">
                {state.owner.name ?? state.owner.email ?? 'Unknown'}
              </p>
              <p className="text-xs text-gray-500">Household owner</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            You&apos;re sharing financial data with this household. All changes are visible to all members.
          </p>
          <button
            onClick={() => setShowConfirmLeave(true)}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 text-xs transition-colors disabled:opacity-40"
          >
            <LogOut size={12} />
            Leave household
          </button>
        </div>
      )}

      {/* Confirm disband modal */}
      {showConfirmDisband && (
        <Modal title="Disband Household?" onClose={() => setShowConfirmDisband(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-400 leading-relaxed">
              This will remove all members from your household. They will no longer have access to
              your shared data. Your own data is unaffected.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowConfirmDisband(false)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-gray-200 hover:border-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={disband}
                className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-sm text-white font-medium transition-colors"
              >
                Disband
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm leave modal */}
      {showConfirmLeave && (
        <Modal title="Leave Household?" onClose={() => setShowConfirmLeave(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-400 leading-relaxed">
              You&apos;ll lose access to the shared household data and revert to your own private data.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowConfirmLeave(false)}
                className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-gray-400 hover:text-gray-200 hover:border-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={leave}
                className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-sm text-white font-medium transition-colors"
              >
                Leave
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Main Settings component ──────────────────────────────────────────────────

export function Settings({ data, onSaveFamilyMembers }: SettingsProps) {
  const { lang } = useLanguage()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [emailSending, setEmailSending] = useState(false)
  const [showFamilyModal, setShowFamilyModal] = useState(false)
  const [editingMemberName, setEditingMemberName] = useState<string | null>(null)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberIsChild, setNewMemberIsChild] = useState(false)
  const [savingMember, setSavingMember] = useState(false)

  const familyMembers: FamilyMember[] = (data.familyMembers || []).map((m: any) =>
    typeof m === 'string' ? { name: m, isChild: false } : (m as FamilyMember)
  )

  async function handleEmailExport() {
    setError(null)
    setSuccess(null)
    setEmailSending(true)
    try {
      const res = await fetch('/finance-hub/api/send-backup', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to send email')
      setSuccess(t('settings.backup.emailSuccess', lang))
    } catch (err) {
      setError(`Failed to send email: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setEmailSending(false)
    }
  }

  function handleExport() {
    setError(null)
    setSuccess(null)
    try {
      const dataStr = JSON.stringify(data, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `finance-hub-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      setSuccess(t('settings.backup.success', lang))
    } catch (err) {
      setError(`${t('settings.backup.errorPrefix', lang)}${err instanceof Error ? err.message : String(err)}`)
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
        updated = familyMembers.map((m) =>
          m.name === editingMemberName
            ? { ...m, name: newMemberName.trim(), isChild: newMemberIsChild }
            : m
        )
      } else {
        updated = [...familyMembers, { name: newMemberName.trim(), isChild: newMemberIsChild }]
      }
      await onSaveFamilyMembers(updated)
      setNewMemberName('')
      setNewMemberIsChild(false)
      setEditingMemberName(null)
      setShowFamilyModal(false)
    } catch (err) {
      setError(`${t('settings.error.saveMember', lang)}${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSavingMember(false)
    }
  }

  async function handleRemoveFamilyMember(memberName: string) {
    try {
      await onSaveFamilyMembers(familyMembers.filter((m) => m.name !== memberName))
    } catch (err) {
      setError(`${t('settings.error.removeMember', lang)}${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">{t('settings.title', lang)}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{t('settings.subtitle', lang)}</p>
      </div>

      {/* Household Sharing */}
      <HouseholdSection lang={lang} />

      {/* Family Members */}
      <div className="bg-[#14141f] border border-white/5 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Users size={20} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">{t('settings.family.title', lang)}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {t('settings.family.description', lang)}
              </p>
            </div>
          </div>
          <button
            onClick={openAddMember}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-sm text-white font-medium transition-colors"
          >
            <Plus size={14} />
            {t('settings.family.addButton', lang)}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {familyMembers.length === 0 ? (
            <p className="text-xs text-gray-600">{t('settings.family.empty', lang)}</p>
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

      {/* Data Backup */}
      <div className="bg-[#14141f] border border-white/5 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Download size={20} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">{t('settings.backup.title', lang)}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{t('settings.backup.description', lang)}</p>
          </div>
        </div>

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

        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition-colors"
          >
            <Download size={16} />
            {t('settings.backup.exportButton', lang)}
          </button>
          <button
            onClick={handleEmailExport}
            disabled={emailSending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 text-sm font-medium transition-colors"
          >
            <Mail size={16} />
            {emailSending ? t('settings.backup.emailSending', lang) : t('settings.backup.emailButton', lang)}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Cloud size={15} className="text-indigo-400" />
          <h3 className="text-sm font-semibold text-gray-300">{t('settings.howToBackup.title', lang)}</h3>
        </div>
        <ul className="text-xs text-gray-500 space-y-2">
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>{t('settings.howToBackup.step1', lang)}</span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>{t('settings.howToBackup.step2', lang)}</span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>{t('settings.howToBackup.step3', lang)}</span>
          </li>
        </ul>
      </div>

      {/* Add/Edit Family Member Modal */}
      {showFamilyModal && (
        <Modal
          title={editingMemberName ? t('settings.modal.editTitle', lang) : t('settings.modal.addTitle', lang)}
          onClose={() => setShowFamilyModal(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">{t('settings.modal.nameLabel', lang)}</label>
              <input
                autoFocus
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveFamilyMember()}
                placeholder={t('settings.modal.namePlaceholder', lang)}
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
                <span>{t('settings.modal.markAsChild', lang)}</span>
              </button>
              <p className="text-xs text-gray-600 mt-1.5">{t('settings.modal.childNote', lang)}</p>
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
                {t('settings.modal.cancel', lang)}
              </button>
              <button
                onClick={handleSaveFamilyMember}
                disabled={!newMemberName.trim() || savingMember}
                className="flex-1 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm text-white font-medium transition-colors"
              >
                {savingMember ? t('settings.modal.saving', lang) : editingMemberName ? t('settings.modal.saveChanges', lang) : t('settings.modal.addMember', lang)}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
