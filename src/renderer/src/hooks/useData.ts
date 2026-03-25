import { useState, useEffect, useCallback } from 'react'
import { AppData, Account, MonthlySnapshot, RecurringExpense, IncomeSource, FamilyMember } from '../types'

const defaultData: AppData = { accounts: [], snapshots: [], familyMembers: [] }
const LS_KEY = 'networth-tracker-data'

// Fallback API using localStorage (used in browser preview / outside Electron)
const browserApi = {
  getData: async (): Promise<AppData> => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return defaultData
      const parsed = JSON.parse(raw)
      // Migration: convert old string[] familyMembers to FamilyMember[]
      if (parsed.familyMembers && Array.isArray(parsed.familyMembers) && typeof parsed.familyMembers[0] === 'string') {
        parsed.familyMembers = parsed.familyMembers.map((name: string) => ({ name, isChild: false }))
      }
      return parsed
    } catch {
      return defaultData
    }
  },
  saveData: async (data: AppData): Promise<boolean> => {
    localStorage.setItem(LS_KEY, JSON.stringify(data))
    return true
  }
}

function getApi() {
  return typeof window !== 'undefined' && window.api ? window.api : browserApi
}

export function useData() {
  const [data, setData] = useState<AppData>(defaultData)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getApi().getData().then((d) => {
      setData(d || defaultData)
      setLoading(false)
    })
  }, [])

  const saveAll = useCallback(async (newData: AppData): Promise<void> => {
    setData(newData)
    const api = getApi()
    console.log('Saving data with API:', api === browserApi ? 'browser' : 'electron')
    const result = api.saveData(newData)
    await Promise.race([
      result,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Save timeout')), 5000))
    ])
  }, [])

  const saveAccounts = useCallback(
    async (accounts: Account[]): Promise<void> => {
      const newData = { ...data, accounts }
      await saveAll(newData)
    },
    [data, saveAll]
  )

  const saveSnapshots = useCallback(
    async (snapshots: MonthlySnapshot[]): Promise<void> => {
      const newData = { ...data, snapshots }
      await saveAll(newData)
    },
    [data, saveAll]
  )

  const saveFamilyMembers = useCallback(
    async (familyMembers: FamilyMember[]): Promise<void> => {
      const newData = { ...data, familyMembers }
      await saveAll(newData)
    },
    [data, saveAll]
  )

  const saveExpenses = useCallback(
    async (expenses: RecurringExpense[]): Promise<void> => {
      const newData = { ...data, expenses }
      await saveAll(newData)
    },
    [data, saveAll]
  )

  const saveIncome = useCallback(
    async (income: IncomeSource[]): Promise<void> => {
      const newData = { ...data, income }
      await saveAll(newData)
    },
    [data, saveAll]
  )

  return { data, loading, saveAccounts, saveSnapshots, saveFamilyMembers, saveExpenses, saveIncome }
}
