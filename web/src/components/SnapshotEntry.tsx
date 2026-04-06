'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Save, AlertCircle, ExternalLink, Upload } from 'lucide-react'
import { Account, MonthlySnapshot, SnapshotEntry as SnapshotEntryType, AppData, AccountHoldings, Investment } from '../types'
import { getCurrentMonth, generateId, formatMonthFull, formatCurrency, cn } from '../utils'
import { useCurrency } from '../context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { t } from '@/translations'
import { ACCOUNT_KIND_CONFIG } from './Accounts'

interface SnapshotEntryProps {
  accounts: Account[]
  snapshots: MonthlySnapshot[]
  onSave: (snapshots: MonthlySnapshot[]) => Promise<void>
  onSaveWithHoldings?: (snapshots: MonthlySnapshot[], holdings?: AccountHoldings[]) => Promise<void>
  editingSnapshotId?: string | null
  onEditDone?: () => void
  data?: AppData
  onRefreshData?: () => Promise<void>
  onSaveAccountHoldings?: (holdings: AccountHoldings[]) => Promise<void>
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
  onSaveWithHoldings,
  editingSnapshotId,
  onEditDone,
  data,
  onRefreshData,
  onSaveAccountHoldings
}: SnapshotEntryProps) {
  const { currency } = useCurrency()
  const { lang } = useLanguage()
  const fmt = (v: number) => formatCurrency(v, currency)
  const currencySymbol = currency === 'NIS' ? '₪' : '$'

  const [month, setMonth] = useState(getCurrentMonth())
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement>>({})
  const [uploadError, setUploadError] = useState<string | null>(null)
  const skipNextReInitRef = useRef(false)

  const existingSnapshot = editingSnapshotId
    ? snapshots.find((s) => s.id === editingSnapshotId)
    : snapshots.find((s) => s.date === month)

  // Initialize balances from snapshot
  useEffect(() => {
    if (skipNextReInitRef.current) {
      skipNextReInitRef.current = false
      return
    }

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

  function copyFromLast() {
    // Find the most recent snapshot (excluding current month if editing)
    const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date))
    const lastSnapshot = sorted.find((s) => s.date !== month)

    if (!lastSnapshot) return

    // Reuse the same balance initialization logic
    const init: Record<string, string> = {}
    for (const e of lastSnapshot.entries) {
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
  }

  async function handleFileUpload(accountId: string, subLabel: string | null, file: File) {
    setUploadingFieldId(`${accountId}:${subLabel || 'single'}`)
    setUploadError(null)

    try {
      const account = accounts.find((a) => a.id === accountId)
      const vendor = account?.kind === 'bank' ? account?.bankVendor : account?.brokerageVendor

      if (!vendor) {
        throw new Error('Vendor not configured for this account')
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('vendor', vendor)

      const response = await fetch('/finance-hub/api/parse-investments', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to parse file')
      }

      const { totalValueNIS, holdings, updatedAt } = await response.json()
      console.log('Upload to accountId:', accountId, 'totalValueNIS:', totalValueNIS)

      // Update the balance field
      const fieldKey = subLabel ? `${accountId}:${subLabel}` : accountId
      setBalances((prev) => ({
        ...prev,
        [fieldKey]: String(totalValueNIS)
      }))

      // Save accountHoldings immediately
      if (onSaveAccountHoldings) {
        // Build a map of all known fees across all accounts
        const allKnownFees = new Map<string, number>()
        data?.accountHoldings?.forEach((ah) => {
          ah.holdings.forEach((holding) => {
            if (holding.managementFee !== undefined) {
              allKnownFees.set(holding.paperNumber, holding.managementFee)
            }
          })
        })

        // Preserve existing fees for papers that already exist (including from other accounts)
        const holdingsWithPreservedFees = holdings.map((holding: Investment) => ({
          ...holding,
          managementFee: allKnownFees.has(holding.paperNumber)
            ? allKnownFees.get(holding.paperNumber)
            : holding.managementFee
        }))

        const newHoldings: AccountHoldings = {
          accountId,
          totalValueNIS,
          holdings: holdingsWithPreservedFees,
          updatedAt
        }
        const updatedHoldings = [
          ...(data?.accountHoldings || []).filter((h) => h.accountId !== accountId),
          newHoldings
        ]

        await onSaveAccountHoldings(updatedHoldings)
        console.log('Saved holdings with total:', totalValueNIS)

        // Update the balance field display with the new value
        const fieldKey = subLabel ? `${accountId}:${subLabel}` : accountId
        setBalances((prev) => ({
          ...prev,
          [fieldKey]: String(totalValueNIS)
        }))

        // Tell useEffect to skip re-init on next run (since snapshots might change)
        skipNextReInitRef.current = true
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploadingFieldId(null)
    }
  }

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
          <h3 className="text-base font-semibold text-white">{t('snapshot.empty.title', lang)}</h3>
          <p className="text-sm text-gray-500">{t('snapshot.empty.message', lang)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {editingSnapshotId ? t('snapshot.title.edit', lang) : t('snapshot.title.new', lang)}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {existingSnapshot ? t('snapshot.subtitle.existing', lang) : t('snapshot.subtitle.new', lang)}
          </p>
        </div>

        {/* Month picker */}
        <div className="bg-[#14141f] border border-white/5 rounded-xl p-4 flex items-center justify-between">
          {lang === 'he' ? (
            <>
              <button
                onClick={() => !editingSnapshotId && setMonth(changeMonth(month, -1))}
                disabled={!!editingSnapshotId}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
              <div className="text-center">
                <p className="text-base font-semibold text-white">{formatMonthFull(month, lang)}</p>
                {existingSnapshot && (
                  <p className="text-xs text-amber-400 mt-0.5">{t('snapshot.existingBadge', lang)}</p>
                )}
              </div>
              <button
                onClick={() => !editingSnapshotId && setMonth(changeMonth(month, 1))}
                disabled={!!editingSnapshotId}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => !editingSnapshotId && setMonth(changeMonth(month, -1))}
                disabled={!!editingSnapshotId}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <p className="text-base font-semibold text-white">{formatMonthFull(month, lang)}</p>
                {existingSnapshot && (
                  <p className="text-xs text-amber-400 mt-0.5">{t('snapshot.existingBadge', lang)}</p>
                )}
              </div>
              <button
                onClick={() => !editingSnapshotId && setMonth(changeMonth(month, 1))}
                disabled={!!editingSnapshotId}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>

        {/* Copy from last button - only for new snapshots */}
        {!existingSnapshot && snapshots.length > 0 && Object.keys(balances).length === 0 && (
          <div className="text-center">
            <button
              onClick={copyFromLast}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {t('snapshot.copyFromLast', lang)}
            </button>
          </div>
        )}

        {assets.length > 0 && (
          <AccountSection
            title={t('snapshot.sectionAssets', lang)}
            color="emerald"
            accounts={assets}
            balances={balances}
            currencySymbol={currencySymbol}
            onChange={(id, val) => setBalances({ ...balances, [id]: val })}
            snapshot={existingSnapshot}
            lang={lang}
            onFileUpload={handleFileUpload}
            uploadingFieldId={uploadingFieldId}
            fileInputRefs={fileInputRefs}
          />
        )}

        {liabilities.length > 0 && (
          <AccountSection
            title={t('snapshot.sectionLiabilities', lang)}
            color="red"
            accounts={liabilities}
            balances={balances}
            currencySymbol={currencySymbol}
            onChange={(id, val) => setBalances({ ...balances, [id]: val })}
            snapshot={existingSnapshot}
            lang={lang}
            onFileUpload={handleFileUpload}
            uploadingFieldId={uploadingFieldId}
            fileInputRefs={fileInputRefs}
          />
        )}

        {uploadError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded p-3 text-sm">
            {uploadError}
          </div>
        )}

        {/* Summary + Save */}
        <div className="bg-[#14141f] border border-white/5 rounded-xl p-5 space-y-3">
          {totalLiabilities > 0 && (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{t('snapshot.summary.totalAssets', lang)}</p>
                <p className="font-semibold text-emerald-400">{fmt(totalAssets)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{t('snapshot.summary.totalLiabilities', lang)}</p>
                <p className="font-semibold text-red-400">{fmt(totalLiabilities)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{t('snapshot.summary.netWorth', lang)}</p>
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
              ? t('snapshot.button.saving', lang)
              : saved
              ? t('snapshot.button.saved', lang)
              : existingSnapshot
              ? t('snapshot.button.update', lang)
              : t('snapshot.button.save', lang)}
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
  snapshot,
  lang,
  onFileUpload,
  uploadingFieldId,
  fileInputRefs
}: {
  title: string
  color: 'emerald' | 'red'
  accounts: Account[]
  balances: Record<string, string>
  currencySymbol: string
  onChange: (id: string, val: string) => void
  snapshot?: MonthlySnapshot
  lang: string
  onFileUpload?: (accountId: string, subLabel: string | null, file: File) => Promise<void>
  uploadingFieldId?: string | null
  fileInputRefs?: React.MutableRefObject<Record<string, HTMLInputElement>>
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
                    title={t('snapshot.tooltip.openVendor', lang)}
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
                <div key={sub} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 capitalize">{sub}</span>
                  <div className="flex items-center gap-3">
                    <div className={cn('relative', lang === 'he' ? 'right-3 pr-7' : 'left-3 pl-7')}>
                      <span className={cn('absolute top-1/2 -translate-y-1/2 text-gray-500 text-sm', lang === 'he' ? 'right-3' : 'left-3')}>
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={balances[account.id + ':' + sub] ?? ''}
                        onChange={(e) => onChange(account.id + ':' + sub, e.target.value)}
                        placeholder="0"
                        className={cn('w-32 sm:w-40 bg-[#1c1c2a] border border-white/10 rounded-lg py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors text-right', lang === 'he' ? 'pr-3 pl-7' : 'pl-7 pr-3')}
                      />
                    </div>
                    {sub === 'investments' && onFileUpload && fileInputRefs ? (
                      <>
                        {(() => {
                          const bankVendor = account.kind === 'bank' ? account.bankVendor : undefined
                          const brokerageVendor = account.kind === 'brokerage' ? account.brokerageVendor : undefined
                          const isDisabled = account.kind === 'bank' ? !bankVendor || bankVendor === 'other' : !brokerageVendor || brokerageVendor === 'other'
                          const tooltipText = isDisabled ? t('holdings.vendorRequired', lang) : t('holdings.upload', lang)
                          return (
                            <button
                              onClick={() => fileInputRefs.current[`${account.id}:${sub}`]?.click()}
                              disabled={uploadingFieldId === `${account.id}:${sub}` || isDisabled}
                              className="p-2 rounded hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-300 transition disabled:opacity-50"
                              title={tooltipText}
                            >
                              <Upload size={16} />
                            </button>
                          )
                        })()}
                        <input
                          ref={(el) => {
                            if (el && fileInputRefs.current) fileInputRefs.current[`${account.id}:${sub}`] = el
                          }}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={(e) => {
                            const file = e.currentTarget.files?.[0]
                            if (file && onFileUpload) {
                              onFileUpload(account.id, sub, file)
                            }
                          }}
                          className="hidden"
                        />
                      </>
                    ) : (
                      <div className="w-8" />
                    )}
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
                      title={t('snapshot.tooltip.openVendor', lang)}
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
              <div className="flex items-center gap-3">
                <div className={cn('relative flex items-center', lang === 'he' ? 'right-3 pr-7' : 'left-3 pl-7')}>
                  <span className={cn('absolute top-1/2 -translate-y-1/2 text-gray-500 text-sm', lang === 'he' ? 'right-3' : 'left-3')}>
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={balances[account.id] ?? ''}
                    onChange={(e) => onChange(account.id, e.target.value)}
                    placeholder="0"
                    className={cn('w-32 sm:w-40 bg-[#1c1c2a] border border-white/10 rounded-lg py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-colors text-right', lang === 'he' ? 'pr-3 pl-7' : 'pl-7 pr-3')}
                  />
                </div>
                {(account.kind === 'brokerage' || account.kind === 'bank') && onFileUpload && fileInputRefs ? (
                  <>
                    {(() => {
                      const bankVendor = account.kind === 'bank' ? account.bankVendor : undefined
                      const brokerageVendor = account.kind === 'brokerage' ? account.brokerageVendor : undefined
                      const isDisabled = account.kind === 'bank' ? !bankVendor || bankVendor === 'other' : !brokerageVendor || brokerageVendor === 'other'
                      const tooltipText = isDisabled ? t('holdings.vendorRequired', lang) : t('holdings.upload', lang)
                      return (
                        <button
                          onClick={() => fileInputRefs.current[account.id]?.click()}
                          disabled={uploadingFieldId === `${account.id}:single` || isDisabled}
                          className="p-2 rounded hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-300 transition disabled:opacity-50"
                          title={tooltipText}
                        >
                          <Upload size={16} />
                        </button>
                      )
                    })()}
                    <input
                      ref={(el) => {
                        if (el && fileInputRefs.current) fileInputRefs.current[account.id] = el
                      }}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        const file = e.currentTarget.files?.[0]
                        if (file && onFileUpload) {
                          onFileUpload(account.id, null, file)
                        }
                      }}
                      className="hidden"
                    />
                  </>
                ) : (
                  <div className="w-8" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
