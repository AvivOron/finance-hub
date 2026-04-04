import { useState, useEffect, useCallback } from 'react'
import { AppData, Account, MonthlySnapshot, RecurringExpense, VariableExpense, IncomeSource, FamilyMember, AccountHoldings } from '../types'

const defaultData: AppData = { accounts: [], snapshots: [], familyMembers: [] }

export function useData() {
  const [data, setData] = useState<AppData>(defaultData)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/finance-hub/api/data')
      .then((r) => r.json())
      .then((d) => {
        setData(d && d.accounts ? d : defaultData)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const saveAll = useCallback(async (newData: AppData): Promise<void> => {
    setData(newData)
    const res = await fetch('/finance-hub/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newData)
    })
    if (!res.ok) throw new Error('Failed to save data')
  }, [])

  const saveAccounts = useCallback(
    async (accounts: Account[]): Promise<void> => {
      await saveAll({ ...data, accounts })
    },
    [data, saveAll]
  )

  const saveSnapshots = useCallback(
    async (snapshots: MonthlySnapshot[]): Promise<void> => {
      await saveAll({ ...data, snapshots })
    },
    [data, saveAll]
  )

  const saveFamilyMembers = useCallback(
    async (familyMembers: FamilyMember[]): Promise<void> => {
      await saveAll({ ...data, familyMembers })
    },
    [data, saveAll]
  )

  const saveExpenses = useCallback(
    async (expenses: RecurringExpense[]): Promise<void> => {
      await saveAll({ ...data, expenses })
    },
    [data, saveAll]
  )

  const saveVariableExpenses = useCallback(
    async (variableExpenses: VariableExpense[]): Promise<void> => {
      await saveAll({ ...data, variableExpenses })
    },
    [data, saveAll]
  )

  const saveIncome = useCallback(
    async (income: IncomeSource[]): Promise<void> => {
      await saveAll({ ...data, income })
    },
    [data, saveAll]
  )

  const saveAiInsights = useCallback(
    async (insights: { content: string; language: string; generatedAt: string }): Promise<void> => {
      const res = await fetch('/finance-hub/api/save-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(insights)
      })
      if (!res.ok) throw new Error('Failed to save insights')
    },
    []
  )

  const saveAccountHoldings = useCallback(
    async (accountHoldings: AccountHoldings[]): Promise<void> => {
      // Fetch latest data from server to avoid overwriting other fields
      const res = await fetch('/finance-hub/api/data')
      const latestData = await res.json()
      const mergedData = { ...latestData, accountHoldings }
      await saveAll(mergedData)
    },
    [saveAll]
  )

  const refreshData = useCallback(async (): Promise<void> => {
    const res = await fetch('/finance-hub/api/data')
    const d = await res.json()
    setData(d && d.accounts ? d : defaultData)
  }, [])

  return { data, loading, saveAccounts, saveSnapshots, saveFamilyMembers, saveExpenses, saveVariableExpenses, saveIncome, saveAiInsights, saveAccountHoldings, refreshData }
}
