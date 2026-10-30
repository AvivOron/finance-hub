import type { VariableExpense } from '@/types'

export type TxSummary = {
  byExpense: Record<string, Record<string, number>>
  byCategory: Record<string, Record<string, number>>
}

export const VARIABLE_AVG_MONTHS = 3

/**
 * Average monthly variable spending over the last 3 months that have transactions.
 * Counts transactions linked to a variable expense plus unlinked ones (grouped by their
 * category). Transactions linked to a recurring expense are left out — the fixed amount
 * already covers them. Shared by Dashboard, Expenses and FIRE so they always agree.
 */
export function variableSpendingAverage(
  txSummary: TxSummary | null,
  variableExpenses: VariableExpense[],
  { includeUnlinked = true }: { includeUnlinked?: boolean } = {}
): { total: number; byCategory: Record<string, number> } | null {
  if (!txSummary) return null

  const allMonths = new Set<string>()
  for (const series of [...Object.values(txSummary.byExpense), ...Object.values(txSummary.byCategory)]) {
    for (const month of Object.keys(series)) allMonths.add(month)
  }
  const months = [...allMonths].sort().slice(-VARIABLE_AVG_MONTHS)
  if (months.length === 0) return null

  const byCategory: Record<string, number> = {}
  const add = (category: string, series: Record<string, number>) => {
    const sum = months.reduce((s, m) => s + (series[m] ?? 0), 0)
    if (sum !== 0) byCategory[category] = (byCategory[category] ?? 0) + sum / months.length
  }

  for (const ve of variableExpenses) {
    const series = txSummary.byExpense[ve.id]
    if (series) add(ve.category, series)
  }
  if (includeUnlinked) {
    for (const [category, series] of Object.entries(txSummary.byCategory)) {
      add(category === 'unlinked' ? 'other' : category, series)
    }
  }

  const total = Object.values(byCategory).reduce((s, v) => s + v, 0)
  return { total, byCategory }
}
