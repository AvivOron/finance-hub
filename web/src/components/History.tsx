'use client'

import { useState } from 'react'
import { Pencil, Trash2, X, Check, CalendarDays } from 'lucide-react'
import { AppData, MonthlySnapshot } from '../types'
import { formatMonthFull, formatCurrency, formatCurrencyShort } from '../utils'
import { useCurrency } from '../context/CurrencyContext'

interface HistoryProps {
  data: AppData
  onSave: (snapshots: MonthlySnapshot[]) => Promise<void>
  onEditSnapshot: (id: string) => void
}

export function History({ data, onSave, onEditSnapshot }: HistoryProps) {
  const { currency } = useCurrency()
  const fmt = (v: number) => formatCurrency(v, currency)
  const fmtShort = (v: number) => formatCurrencyShort(v, currency)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const sorted = [...data.snapshots].sort((a, b) => b.date.localeCompare(a.date))

  function getStats(snapshot: MonthlySnapshot) {
    let assets = 0
    let liabilities = 0
    for (const entry of snapshot.entries) {
      const account = data.accounts.find((a) => a.id === entry.accountId)
      if (!account) continue
      if (account.type === 'asset') assets += entry.balance
      else liabilities += entry.balance
    }
    return { assets, liabilities, netWorth: assets - liabilities }
  }

  async function handleDelete(id: string) {
    await onSave(data.snapshots.filter((s) => s.id !== id))
    setDeleteConfirm(null)
  }

  if (sorted.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 py-8">
        <div className="text-center space-y-3">
          <CalendarDays size={36} className="mx-auto text-gray-600" />
          <h3 className="text-base font-semibold text-white">No snapshots yet</h3>
          <p className="text-sm text-gray-500">Record your first monthly snapshot to see history.</p>
        </div>
      </div>
    )
  }

  const statsWithChange = sorted.map((snapshot, i) => {
    const stats = getStats(snapshot)
    const prev = sorted[i + 1] ? getStats(sorted[i + 1]) : null
    const momChange = prev !== null ? stats.netWorth - prev.netWorth : null
    return { snapshot, stats, momChange }
  })

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">History</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {sorted.length} snapshot{sorted.length !== 1 ? 's' : ''} recorded
        </p>
      </div>

      <div className="bg-[#14141f] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Month
              </th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Assets
              </th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Liabilities
              </th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Net Worth
              </th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                MoM Change
              </th>
              <th className="px-5 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {statsWithChange.map(({ snapshot, stats, momChange }) => (
              <tr key={snapshot.id} className="group hover:bg-white/[0.02] transition-colors">
                <td className="px-5 py-4">
                  <span className="font-medium text-gray-200">{formatMonthFull(snapshot.date)}</span>
                </td>
                <td className="px-5 py-4 text-right text-emerald-400 font-medium">
                  {fmt(stats.assets)}
                </td>
                <td className="px-5 py-4 text-right text-red-400 font-medium">
                  {fmt(stats.liabilities)}
                </td>
                <td className="px-5 py-4 text-right">
                  <span
                    className={stats.netWorth >= 0 ? 'text-white font-bold' : 'text-red-400 font-bold'}
                  >
                    {fmt(stats.netWorth)}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  {momChange !== null ? (
                    <span className={momChange >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {momChange >= 0 ? '+' : ''}
                      {fmtShort(momChange)}
                    </span>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {deleteConfirm === snapshot.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500 mr-1">Delete?</span>
                        <button
                          onClick={() => handleDelete(snapshot.id)}
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
                          onClick={() => onEditSnapshot(snapshot.id)}
                          className="p-1.5 rounded-md hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(snapshot.id)}
                          className="p-1.5 rounded-md hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
