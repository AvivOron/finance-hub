import { useState, useEffect, useCallback } from 'react'
import { AppData, Account, MonthlySnapshot, RecurringExpense, IncomeSource, FamilyMember } from '../types'

const defaultData: AppData = { accounts: [], snapshots: [], familyMembers: [] }

export function useData() {
  const [data, setData] = useState<AppData>(defaultData)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/data')
      .then((r) => r.json())
      .then((d) => {
        setData(d && d.accounts ? d : defaultData)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const saveAll = useCallback(async (newData: AppData): Promise<void> => {
    setData(newData)
    const res = await fetch('/api/data', {
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

  const saveIncome = useCallback(
    async (income: IncomeSource[]): Promise<void> => {
      await saveAll({ ...data, income })
    },
    [data, saveAll]
  )

  return { data, loading, saveAccounts, saveSnapshots, saveFamilyMembers, saveExpenses, saveIncome }
}
