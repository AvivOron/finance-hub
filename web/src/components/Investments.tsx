'use client'

import { useState, useRef } from 'react'
import { Upload, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { Account, AccountHoldings, AppData, Investment } from '../types'
import { cn, formatCurrency } from '../utils'
import { useCurrency } from '../context/CurrencyContext'
import { useLanguage } from '@/context/LanguageContext'
import { t } from '@/translations'

interface InvestmentsProps {
  data: AppData
  onSave?: (data: AppData) => Promise<void>
}

export function Investments({ data, onSave }: InvestmentsProps) {
  const { currency } = useCurrency()
  const { lang } = useLanguage()
  const fmt = (v: number) => formatCurrency(v, currency)

  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null)
  const [loadingAccountId, setLoadingAccountId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editingFeeCell, setEditingFeeCell] = useState<{ accountId: string; paperNumber: string } | null>(null)
  const [feeInputValue, setFeeInputValue] = useState<string>('')
  const [savingFeeCell, setSavingFeeCell] = useState<{ accountId: string; paperNumber: string } | null>(null)
  const fileInputRef = useRef<Record<string, HTMLInputElement>>({})

  // Filter to investment-related accounts
  const investmentAccounts = (data.accounts || []).filter(
    (a) => a.type === 'asset' && (a.kind === 'brokerage' || a.kind === 'bank')
  )

  if (investmentAccounts.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-6">{t('nav.investments', lang)}</h1>
        <div className="text-center py-12 bg-slate-800/50 rounded border border-slate-700">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <p className="text-slate-400">{t('holdings.empty', lang)}</p>
        </div>
      </div>
    )
  }

  async function handleFileUpload(accountId: string, file: File) {
    setLoadingAccountId(accountId)
    setMessage(null)

    try {
      const account = data.accounts.find((a) => a.id === accountId)
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

      const { holdings, totalValueNIS, updatedAt } = await response.json()

      // Build a map of all known fees across all accounts
      const allKnownFees = new Map<string, number>()
      data.accountHoldings?.forEach((ah) => {
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

      // Update accountHoldings
      const newHoldings: AccountHoldings = {
        accountId,
        totalValueNIS,
        holdings: holdingsWithPreservedFees,
        updatedAt
      }

      const updatedHoldings = [
        ...(data.accountHoldings || []).filter((h) => h.accountId !== accountId),
        newHoldings
      ]

      if (onSave) {
        await onSave({
          ...data,
          accountHoldings: updatedHoldings
        })
      }

      setMessage({
        type: 'success',
        text: `${t('holdings.uploaded', lang)} (${holdings.length} ${t('holdings.count', lang)})`
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoadingAccountId(null)
    }
  }

  async function handleSaveFee(accountId: string, paperNumber: string, newFee: number | null) {
    if (!data.accountHoldings) return

    setSavingFeeCell({ accountId, paperNumber })

    try {
      const updatedHoldings = data.accountHoldings.map((h) => {
        if (h.accountId === accountId) {
          return {
            ...h,
            holdings: h.holdings.map((inv) => {
              if (inv.paperNumber === paperNumber) {
                return {
                  ...inv,
                  managementFee: newFee ?? undefined
                }
              }
              return inv
            })
          }
        }
        return h
      })

      if (onSave) {
        await onSave({
          ...data,
          accountHoldings: updatedHoldings
        })
      }
    } finally {
      setEditingFeeCell(null)
      setFeeInputValue('')
      setSavingFeeCell(null)
    }
  }

  function renderFeeEditor(accountId: string, inv: Investment) {
    if (savingFeeCell?.accountId === accountId && savingFeeCell?.paperNumber === inv.paperNumber) {
      return (
        <div className="flex gap-2 items-center justify-end">
          <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        </div>
      )
    }

    if (editingFeeCell?.accountId === accountId && editingFeeCell?.paperNumber === inv.paperNumber) {
      return (
        <div className="flex gap-2 items-center justify-end">
          <input
            type="number"
            step="0.01"
            value={feeInputValue}
            onChange={(e) => setFeeInputValue(e.target.value)}
            className="w-16 px-2 py-1 bg-slate-700 border border-indigo-500 rounded text-sm text-white"
            autoFocus
            onBlur={() => {
              const fee = feeInputValue === '' ? null : parseFloat(feeInputValue)
              handleSaveFee(accountId, inv.paperNumber, fee)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const fee = feeInputValue === '' ? null : parseFloat(feeInputValue)
                handleSaveFee(accountId, inv.paperNumber, fee)
              } else if (e.key === 'Escape') {
                setEditingFeeCell(null)
                setFeeInputValue('')
              }
            }}
          />
          <span className="text-slate-400 text-xs">%</span>
        </div>
      )
    }

    return (
      <button
        onClick={() => {
          setEditingFeeCell({ accountId, paperNumber: inv.paperNumber })
          setFeeInputValue((inv.managementFee ?? '').toString())
        }}
        className="rounded px-2 py-1 transition hover:bg-slate-700/50"
      >
        {inv.managementFee !== undefined ? (
          <div className="font-mono">{inv.managementFee}%</div>
        ) : (
          <span className="text-slate-500 text-xs">—</span>
        )}
      </button>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">{t('nav.investments', lang)}</h1>

      {message && (
        <div
          className={cn(
            'mb-6 p-4 rounded border',
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          )}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {/* Accounts with holdings */}
        {(() => {
          // Calculate total portfolio value
          const totalPortfolioValue = (data.accountHoldings ?? [])
            .filter((h) => data.accounts.some((a) => a.id === h.accountId && a.type === 'asset' && (a.kind === 'brokerage' || a.kind === 'bank')))
            .reduce((sum, h) => sum + h.totalValueNIS, 0)

          return investmentAccounts
            .filter((a) => data.accountHoldings?.some((h) => h.accountId === a.id && h.holdings.length > 0))
            .map((account) => {
              const holding = data.accountHoldings?.find((h) => h.accountId === account.id)
              const accountPct = totalPortfolioValue > 0 ? ((holding?.totalValueNIS ?? 0) / totalPortfolioValue) * 100 : 0
              return { account, holding, accountPct }
            })
            .sort((a, b) => b.accountPct - a.accountPct)
            .map(({ account, holding, accountPct }) => {
              const isExpanded = expandedAccountId === account.id

            return (
              <div
                key={account.id}
                className="bg-slate-800 border border-slate-700 rounded overflow-hidden"
              >
              {/* Account header */}
              <button
                onClick={() => setExpandedAccountId(isExpanded ? null : account.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition"
              >
                {lang === 'he' ? (
                  <>
                    <div className="flex-1 text-right pr-4">
                      <h2 className="text-lg font-semibold text-white">{account.name}</h2>
                      {holding && (
                        <p className="text-sm text-slate-400">
                          {fmt(holding.totalValueNIS)} • {holding.holdings.length} holdings • {accountPct.toFixed(1)}%
                        </p>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={20} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={20} className="text-slate-400" />
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex-1 text-left">
                      <h2 className="text-lg font-semibold text-white">{account.name}</h2>
                      {holding && (
                        <p className="text-sm text-slate-400">
                          {fmt(holding.totalValueNIS)} • {holding.holdings.length} holdings • {accountPct.toFixed(1)}%
                        </p>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={20} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={20} className="text-slate-400" />
                    )}
                  </>
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-slate-700 p-6 space-y-4 bg-slate-800/50">
                  {/* Upload section */}
                  {(() => {
                    const bankVendor = account.kind === 'bank' ? account.bankVendor : undefined
                    const brokerageVendor = account.kind === 'brokerage' ? account.brokerageVendor : undefined
                    const isDisabled = account.kind === 'bank' ? !bankVendor || bankVendor === 'other' : !brokerageVendor || brokerageVendor === 'other'
                    const tooltipText = isDisabled ? t('holdings.vendorRequired', lang) : ''
                    return (
                      <>
                        <div className="flex gap-3" title={tooltipText}>
                          <button
                            onClick={() => fileInputRef.current[account.id]?.click()}
                            disabled={loadingAccountId === account.id || isDisabled}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded transition"
                          >
                            <Upload size={16} />
                            {loadingAccountId === account.id ? 'Uploading...' : t('holdings.upload', lang)}
                          </button>

                        </div>
                        {isDisabled && (
                          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-sm text-amber-300">
                            {t('holdings.vendorNotSupported', lang)}
                          </div>
                        )}
                      </>
                    )
                  })()}

                  <input
                    ref={(el) => {
                      if (el) fileInputRef.current[account.id] = el
                    }}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0]
                      if (file) {
                        handleFileUpload(account.id, file)
                      }
                    }}
                    className="hidden"
                  />

                  {/* Holdings table */}
                  {holding && holding.holdings.length > 0 ? (
                    <>
                      <div className="space-y-3 md:hidden">
                        {holding.holdings
                          .map((inv) => ({
                            inv,
                            pctOfAccount: holding.totalValueNIS > 0 ? (inv.valueNIS / holding.totalValueNIS) * 100 : 0
                          }))
                          .sort((a, b) => b.pctOfAccount - a.pctOfAccount)
                          .map(({ inv, pctOfAccount }) => (
                            <div key={inv.paperNumber} className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 space-y-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-100">{inv.name}</p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                    <span className="font-mono">{inv.paperNumber}</span>
                                    {inv.category && <span>{inv.category}</span>}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-slate-100">{fmt(inv.valueNIS)}</p>
                                  <p className="text-xs text-slate-400">{pctOfAccount.toFixed(1)}%</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-lg bg-slate-800/70 px-3 py-2.5">
                                  <p className="text-xs text-slate-500">{t('holdings.qty', lang)}</p>
                                  <p className="mt-1 font-mono text-slate-200">{inv.quantity.toLocaleString()}</p>
                                </div>
                                <div className="rounded-lg bg-slate-800/70 px-3 py-2.5">
                                  <p className="text-xs text-slate-500">{t('holdings.price', lang)}</p>
                                  <p className="mt-1 font-mono text-slate-200">₪{inv.lastPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}</p>
                                </div>
                                <div className="rounded-lg bg-slate-800/70 px-3 py-2.5">
                                  <p className="text-xs text-slate-500">{t('holdings.gain', lang)}</p>
                                  <div className="mt-1">
                                    <p className="font-mono font-semibold">
                                      {inv.gainFromCostPct > 0 ? (
                                        <span className="text-emerald-400">+{inv.gainFromCostPct.toFixed(2)}%</span>
                                      ) : inv.gainFromCostPct < 0 ? (
                                        <span className="text-red-400">{inv.gainFromCostPct.toFixed(2)}%</span>
                                      ) : (
                                        <span className="text-slate-400">0%</span>
                                      )}
                                    </p>
                                    <p className="text-xs text-slate-500">{fmt(inv.gainFromCostNIS)}</p>
                                  </div>
                                </div>
                                <div className="rounded-lg bg-slate-800/70 px-3 py-2.5">
                                  <p className="text-xs text-slate-500">{t('holdings.fee', lang)}</p>
                                  <div className="mt-1 flex justify-end">
                                    {renderFeeEditor(account.id, inv)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>

                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-slate-300">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="px-3 py-2 text-left font-semibold text-slate-200">
                              {t('holdings.name', lang)}
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-slate-200">
                              {t('holdings.paper_num', lang)}
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-slate-200">
                              {t('holdings.qty', lang)}
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-slate-200">
                              {t('holdings.price', lang)}
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-slate-200">
                              {t('holdings.value', lang)}
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-slate-200">
                              {t('holdings.gain', lang)}
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-slate-200">
                              {t('holdings.fee', lang)}
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-slate-200">
                              {t('holdings.pct_portfolio', lang)}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const accountTotal = holding.totalValueNIS
                            return holding.holdings
                              .map((inv) => ({
                                inv,
                                pctOfAccount: accountTotal > 0 ? (inv.valueNIS / accountTotal) * 100 : 0
                              }))
                              .sort((a, b) => b.pctOfAccount - a.pctOfAccount)
                              .map(({ inv, pctOfAccount }) => (
                            <tr key={inv.paperNumber} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                              <td className="px-3 py-2 text-left">
                                <div className="font-medium">{inv.name}</div>
                                {inv.category && (
                                  <div className="text-xs text-slate-500">{inv.category}</div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-xs">
                                {inv.paperNumber}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {inv.quantity.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                ₪{inv.lastPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-semibold">
                                {fmt(inv.valueNIS)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="font-mono font-semibold">
                                  {inv.gainFromCostPct > 0 ? (
                                    <span className="text-emerald-400">
                                      +{inv.gainFromCostPct.toFixed(2)}%
                                    </span>
                                  ) : inv.gainFromCostPct < 0 ? (
                                    <span className="text-red-400">
                                      {inv.gainFromCostPct.toFixed(2)}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">0%</span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {fmt(inv.gainFromCostNIS)}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="flex justify-end">
                                  {renderFeeEditor(account.id, inv)}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right text-slate-400 text-xs">
                                {pctOfAccount.toFixed(1)}%
                              </td>
                            </tr>
                              ))
                          })()}
                        </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      {t('holdings.empty_account', lang)}
                    </div>
                  )}

                  {holding && (
                    <div className="text-sm text-slate-500 pt-2">
                      {t('holdings.updated', lang)} {new Date(holding.updatedAt).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US')}
                    </div>
                  )}
                </div>
              )}
            </div>
            )
          })
        })()}

        {/* Accounts without holdings */}
        {investmentAccounts
          .filter((a) => !data.accountHoldings?.some((h) => h.accountId === a.id && h.holdings.length > 0))
          .map((account) => (
            <div
              key={account.id}
              className="bg-slate-800 border border-dashed border-slate-600 rounded overflow-hidden opacity-60"
            >
              <div className="px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-300">{account.name}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{t('holdings.empty_account', lang)}</p>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
