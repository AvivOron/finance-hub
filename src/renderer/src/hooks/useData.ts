import { useState, useEffect, useCallback } from 'react'
import { AppData, Account, MonthlySnapshot } from '../types'

const defaultData: AppData = { accounts: [], snapshots: [] }
const LS_KEY = 'networth-tracker-data'

// Fallback API using localStorage (used in browser preview / outside Electron)
const browserApi = {
  getData: async (): Promise<AppData> => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      return raw ? JSON.parse(raw) : defaultData
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
    await getApi().saveData(newData)
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

  return { data, loading, saveAccounts, saveSnapshots }
}
