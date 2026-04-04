import { useState, useEffect, useCallback } from 'react'
import { AppData, Account, MonthlySnapshot, RecurringExpense, VariableExpense, IncomeSource, FamilyMember, AccountHoldings } from '../types'

const defaultData: AppData = { accounts: [], snapshots: [], familyMembers: [] }

const BASE = '/finance-hub/api'

async function put(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Failed to save ${path}`)
}

export function useData() {
  const [data, setData] = useState<AppData>(defaultData)
  const [loading, setLoading] = useState(true)
  const [txSummary, setTxSummary] = useState<{ byExpense: Record<string, Record<string, number>>; byCategory: Record<string, Record<string, number>> } | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/data`).then(r => r.json()),
      fetch(`${BASE}/transactions/summary`).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([d, summary]) => {
      setData(d && d.accounts ? d : defaultData)
      if (summary) setTxSummary(summary)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const saveAccounts = useCallback(async (accounts: Account[]): Promise<void> => {
    setData(prev => ({ ...prev, accounts }))
    await put('/accounts', accounts)
  }, [])

  const saveSnapshots = useCallback(async (snapshots: MonthlySnapshot[]): Promise<void> => {
    setData(prev => ({ ...prev, snapshots }))
    await put('/snapshots', snapshots)
  }, [])

  const saveFamilyMembers = useCallback(async (familyMembers: FamilyMember[]): Promise<void> => {
    setData(prev => ({ ...prev, familyMembers }))
    await put('/family-members', familyMembers)
  }, [])

  const saveExpenses = useCallback(async (expenses: RecurringExpense[]): Promise<void> => {
    setData(prev => ({ ...prev, expenses }))
    await put('/expenses', expenses)
  }, [])

  const saveVariableExpenses = useCallback(async (variableExpenses: VariableExpense[]): Promise<void> => {
    setData(prev => ({ ...prev, variableExpenses }))
    await put('/variable-expenses', variableExpenses)
  }, [])

  const saveIncome = useCallback(async (income: IncomeSource[]): Promise<void> => {
    setData(prev => ({ ...prev, income }))
    await put('/income', income)
  }, [])

  const saveAiInsights = useCallback(async (insights: { content: string; language: string; generatedAt: string }): Promise<void> => {
    const res = await fetch(`${BASE}/save-insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(insights),
    })
    if (!res.ok) throw new Error('Failed to save insights')
  }, [])

  const saveAccountHoldings = useCallback(async (accountHoldings: AccountHoldings[]): Promise<void> => {
    setData(prev => ({ ...prev, accountHoldings }))
    await put('/account-holdings', accountHoldings)
  }, [])

  const refreshData = useCallback(async (): Promise<void> => {
    const res = await fetch(`${BASE}/data`)
    const d = await res.json()
    setData(d && d.accounts ? d : defaultData)
  }, [])

  return { data, loading, txSummary, saveAccounts, saveSnapshots, saveFamilyMembers, saveExpenses, saveVariableExpenses, saveIncome, saveAiInsights, saveAccountHoldings, refreshData }
}
