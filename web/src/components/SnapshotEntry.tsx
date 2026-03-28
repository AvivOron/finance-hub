'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Save, AlertCircle, ExternalLink } from 'lucide-react'
import { Account, MonthlySnapshot, SnapshotEntry as SnapshotEntryType } from '../types'
import { getCurrentMonth, generateId, formatMonthFull, formatCurrency, cn } from '../utils'
import { useCurrency } from '../context/CurrencyContext'
import { ACCOUNT_KIND_CONFIG } from './Accounts'

interface SnapshotEntryProps {
  accounts: Account[]
  snapshots: MonthlySnapshot[]
  onSave: (snapshots: MonthlySnapshot[]) => Promise<void>
  editingSnapshotId?: string | null
  onEditDone?: () => void
}

function changeMonth(date: string, delta: number): string {
  const [y, m] = date.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function SnapshotEntry({
  accounts,
  snapshots,
  onSave,
  editingSnapshotId,
  onEditDone
}: SnapshotEntryProps) {
  const { currency } = useCurrency()
  const fmt = (v: number) => formatCurrency(v, currency)
  const currencySymbol = currency === 'NIS' ? '₪' : '$'

  const [month, setMonth] = useState(getCurrentMonth())
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const existingSnapshot = editingSnapshotId
    ? snapshots.find((s) => s.id === editingSnapshotId)
    : snapshots.find((s) => s.date === month)

  useEffect(() => {
    const snap = editingSnapshotId
      ? snapshots.find((s) => s.id === editingSnapshotId)
      : snapshots.find((s) => s.date === month)

    if (editingSnapshotId && snap) setMonth(snap.date)

    if (snap) {
      const init: Record<string, string> = {}
      for (const e of snap.entries) {
        const account = accounts.find((a) => a.id === e.accountId)
        const kindConfig =
          account?.kind && account.kind !== 'custom' ? ACCOUNT_KIND_CONFIG[account.kind] : null
        if (kindConfig?.subLabels?.length) {
          for (const sub of kindConfig.subLabels) {
            init[e.accountId + ':' + sub] = String(e.subBalances?.[sub] ?? 0)
          }
        } else {
          init[e.accountId] = String(e.balance)
        }
      }
      setBalances(init)
    } else {
      setBalances({})
    }
  }, [month, editingSnapshotId, snapshots])

  const assets = accounts.filter((a) => a.type === 'asset')
  const liabilities = accounts.filter((a) => a.type === 'liability')

  function getBalance(account: Account): number {
    const kindConfig =
      account.kind && account.kind !== 'custom' ? ACCOUNT_KIND_CONFIG[account.kind] : null
    if (kindConfig?.subLabels?.length) {
      return kindConfig.subLabels.reduce(
        (sum, sub) => sum + (parseFloat(balances[account.id + ':' + sub]) || 0),
        0
      )
    }
    return parseFloat(balances[account.id]) || 0
  }

  const totalAssets = assets.reduce((s, a) => s + getBalance(a), 0)
  const totalLiabilities = liabilities.reduce((s, a) => s + getBalance(a), 0)
  const netWorth = totalAssets - totalLiabilities

  async function handleSave() {
    setSaving(true)
    const now = new Date().toISOString()
    const entries: SnapshotEntryType[] = accounts
      .filter((a) => {
        const kindConfig =
          a.kind && a.kind !== 'custom' ? ACCOUNT_KIND_CONFIG[a.kind] : null
        if (kindConfig?.subLabels?.length) {
          return kindConfig.subLabels.some(
            (sub) =>
              balances[a.id + ':' + sub] !== undefined && balances[a.id + ':' + sub] !== ''
          )
        }
        return balances[a.id] !== undefined && balances[a.id] !== ''
      })
      .map((a) => {
        const kindConfig =
          a.kind && a.kind !== 'custom' ? ACCOUNT_KIND_CONFIG[a.kind] : null
        if (kindConfig?.subLabels?.length) {
          const subBalances: Record<string, number> = {}
          let total = 0
          for (const sub of kindConfig.subLabels) {
            const val = parseFloat(balances[a.id + ':' + sub]) || 0
            subBalances[sub] = val
            total += val
          }
          return { accountId: a.id, balance: total, subBalances, lastUpdatedAt: now }
        }
        return { accountId: a.id, balance: parseFloat(balances[a.id]) || 0, lastUpdatedAt: now }
      })

    let updated: MonthlySnapshot[]
    if (existingSnapshot) {
      updated = snapshots.map((s) =>
        s.id === existingSnapshot.id ? { ...s, entries, updatedAt: now } : s
      )
    } else {
      const newSnap: MonthlySnapshot = {
        id: generateId(),
        date: month,
        entries,
        createdAt: now,
        updatedAt: now
      }
      updated = [...snapshots, newSnap]
    }

    await onSave(updated)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    if (onEditDone) onEditDone()
  }

  if (accounts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 py-8">
        <div className="text-center space-y-3">
          <AlertCircle size={36} className="mx-auto text-gray-600" />
          <h3 className="text-base font-semibold text-white">No accounts set up</h3>
          <p className="text-sm text-gray-500">Add some accounts first before recording a snapshot.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {editingSnapshotId ? 'Edit Snapshot' : 'Monthly Snapshot'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {existingSnapshot ? 'Updating existing snapshot' : 'Record your current balances'}
          </p>
        </div>

        {/* Month picker */}
        <div className="bg-[#14141f] border border-white/5 rounded-xl p-4 flex items-center justify-between">
          <button
            onClick={() => !editingSnapshotId && setMonth(changeMonth(month, -1))}
            disabled={!!editingSnapshotId}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="text-base font-semibold text-white">{formatMonthFull(month)}</p>
            {existingSnapshot && (
              <p className="text-xs text-amber-400 mt-0.5">Snapshot exists — editing</p>
            )}
          </div>
          <button
            onClick={() => !editingSnapshotId && setMonth(changeMonth(month, 1))}
            disabled={!!editingSnapshotId}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {assets.length > 0 && (
          <AccountSection
            title="Assets"
            color="emerald"
            accounts={assets}
            balances={balances}
            currencySymbol={currencySymbol}
            onChange={(id, val) => setBalances({ ...balances, [id]: val })}
            snapshot={existingSnapshot}
          />
        )}

        {liabilities.length > 0 && (
          <AccountSection
            title="Liabilities"
            color="red"
            accounts={liabilities}
            balances={balances}
            currencySymbol={currencySymbol}
            onChange={(id, val) => setBalances({ ...balances, [id]: val })}
            snapshot={existingSnapshot}
          />
        )}

        {/* Summary + Save */}
        <div className="bg-[#14141f] border border-white/5 rounded-xl p-5 space-y-3">
          {totalLiabilities > 0 && (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Total Assets</p>
                <p className="font-semibold text-emerald-400">{fmt(totalAssets)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Total Liabilities</p>
                <p className="font-semibold text-red-400">{fmt(totalLiabilities)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Net Worth</p>
                <p className={cn('font-bold text-base', netWorth >= 0 ? 'text-white' : 'text-red-400')}>
                  {fmt(netWorth)}
                </p>
              </div>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
              saved
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-indigo-500 hover:bg-indigo-400 text-white'
            )}
          >
            <Save size={15} />
            {saving
              ? 'Saving…'
              : saved
              ? 'Saved!'
              : existingSnapshot
              ? 'Update Snapshot'
              : 'Save Snapshot'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AccountSection({
  title,
  color,
  accounts,
  balances,
  currencySymbol,
  onChange,
  snapshot
}: {
  title: string
  color: 'emerald' | 'red'
  accounts: Account[]
  balances: Record<string, string>
  currencySymbol: string
  onChange: (id: string, val: string) => void
  snapshot?: MonthlySnapshot
}) {
  return (
    <div className="bg-[#14141f] border border-white/5 rounded-xl overflow-hidden">
      <div
        className={cn(
          'px-5 py-3.5 border-b border-white/5 text-xs font-semibold uppercase tracking-wide',
          color === 'emerald' ? 'text-emerald-400' : 'text-red-400'
        )}
      >
        {title}
      </div>
      <div className="divide-y divide-white/5">
        {accounts.map((account) => {
          const kindConfig =
            account.kind && account.kind !== 'custom' ? ACCOUNT_KIND_CONFIG[account.kind] : null
          return kindConfig?.subLabels?.length ? (
            <div key={account.id} className="px-5 py-3.5 space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-indigo-400 shrink-0">{kindConfig.icon}</span>
                <p className="text-sm text-gray-200 font-medium truncate">{account.name}</p>
                {account.url && (
                  <a
                    href={account.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-1 text-gray-400 hover:text-indigo-400 transition-colors"
                    title="Open vendor website"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
                {account.owner && <span className="text-xs text-gray-500">({account.owner})</span>}
                {snapshot &&
                  (() => {
                    const entry = snapshot.entries.find((e) => e.accountId === account.id)
                    return entry?.lastUpdatedAt ? (
                      <span className="text-xs text-gray-600">
                        {new Date(entry.lastUpdatedAt).toLocaleDateString()}
                      </span>
                    ) : null
                  })()}
                {account.notes && (
                  <p className="text-xs text-gray-600 truncate">· {account.notes}</p>
                )}
              </div>
              {kindConfig.subLabels.map((sub) => (
                <div key={sub} className="flex items-center justify-between pl-5">
                  <span className="text-xs text-gray-500 capitalize">{sub}</span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={balances[account.id + ':' + sub] ?? ''}
                      onChange={(e) => onChange(account.id + ':' + sub, e.target.value)}
                      placeholder="0"
                      className="w-32 sm:w-40 bg-[#1c1c2a] border border-white/10 rounded-lg pl-7 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors text-right"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div key={account.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {kindConfig && (
                    <span className="text-indigo-400 shrink-0">{kindConfig.icon}</span>
                  )}
                  <p className="text-sm text-gray-200 font-medium truncate">{account.name}</p>
                  {account.url && (
                    <a
                      href={account.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-1 text-gray-400 hover:text-indigo-400 transition-colors"
                      title="Open vendor website"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                  {account.owner && <span className="text-xs text-gray-500">({account.owner})</span>}
                  {snapshot &&
                    (() => {
                      const entry = snapshot.entries.find((e) => e.accountId === account.id)
                      return entry?.lastUpdatedAt ? (
                        <span className="text-xs text-gray-600">
                          {new Date(entry.lastUpdatedAt).toLocaleDateString()}
                        </span>
                      ) : null
                    })()}
                </div>
                {account.notes && (
                  <p className="text-xs text-gray-600 truncate mt-0.5">{account.notes}</p>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={balances[account.id] ?? ''}
                  onChange={(e) => onChange(account.id, e.target.value)}
                  placeholder="0"
                  className="w-32 sm:w-40 bg-[#1c1c2a] border border-white/10 rounded-lg pl-7 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors text-right"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
