import { useState, useEffect, useCallback } from 'react'
import { AppData, Account, MonthlySnapshot } from '../types'
import { DriveSyncService } from '../services/driveSync'

const defaultData: AppData = { accounts: [], snapshots: [], familyMembers: [], driveSync: { enabled: false } }
const LS_KEY = 'networth-tracker-data'

export interface SyncAlert {
  id: string
  type: 'error' | 'warning'
  message: string
}

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
  const [syncAlerts, setSyncAlerts] = useState<SyncAlert[]>([])

  const addSyncAlert = useCallback((alert: Omit<SyncAlert, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    setSyncAlerts((prev) => [...prev, { ...alert, id }])
    setTimeout(() => {
      setSyncAlerts((prev) => prev.filter((a) => a.id !== id))
    }, 5000)
  }, [])

  useEffect(() => {
    (async () => {
      const api = getApi()
      const localData = await api.getData()

      // Try to download from Google Drive if sync is enabled
      if (localData?.driveSync?.enabled && localData.driveSync.accessToken) {
        try {
          const driveData = await DriveSyncService.downloadData(localData.driveSync)
          if (driveData) {
            console.log('Downloaded data from Google Drive')
            setData(driveData)
            setLoading(false)
            return
          }
        } catch (error) {
          console.error('Failed to download from Drive, using local data:', error)
          addSyncAlert({
            type: 'warning',
            message: 'Could not sync with Google Drive, using local data'
          })
        }
      }

      setData(localData || defaultData)
      setLoading(false)
    })()
  }, [addSyncAlert])

  const saveAll = useCallback(
    async (newData: AppData): Promise<void> => {
      setData(newData)
      const api = getApi()
      console.log('Saving data with API:', api === browserApi ? 'browser' : 'electron')

      try {
        const result = api.saveData(newData)
        await Promise.race([
          result,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Save timeout')), 5000))
        ])
      } catch (error) {
        console.error('Failed to save data:', error)
        throw error
      }

      // Attempt to sync with Google Drive (non-blocking)
      if (newData.driveSync?.enabled && newData.driveSync.accessToken) {
        DriveSyncService.uploadData(newData, newData.driveSync)
          .then((updatedDriveSync) => {
            // Update driveSync state with new fileId and lastSyncAt
            const dataWithUpdatedSync = { ...newData, driveSync: updatedDriveSync }
            setData(dataWithUpdatedSync)
            // Save the updated driveSync config (with fileId) back to local file
            const api = getApi()
            api.saveData(dataWithUpdatedSync)
            console.log('Synced with Google Drive successfully')
          })
          .catch((error) => {
            console.error('Failed to sync with Google Drive:', error)
            addSyncAlert({
              type: 'warning',
              message: 'Failed to sync with Google Drive, but data saved locally'
            })
          })
      }
    },
    [addSyncAlert]
  )

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
    async (familyMembers: string[]): Promise<void> => {
      const newData = { ...data, familyMembers }
      await saveAll(newData)
    },
    [data, saveAll]
  )

  const updateDriveSync = useCallback(
    async (driveSync: AppData['driveSync']): Promise<void> => {
      const newData = { ...data, driveSync }
      setData(newData)
      const api = getApi()
      await api.saveData(newData)
    },
    [data]
  )

  const reloadFromDrive = useCallback(async (driveSync?: AppData['driveSync']): Promise<void> => {
    const syncConfig = driveSync || data.driveSync
    if (!syncConfig?.accessToken) {
      throw new Error('Google Drive sync is not configured')
    }

    try {
      const driveData = await DriveSyncService.downloadData(syncConfig)
      if (driveData) {
        setData(driveData)
        // Save the downloaded data locally as well
        const api = getApi()
        await api.saveData(driveData)
        console.log('Reloaded data from Google Drive')
      } else {
        throw new Error('No data found on Google Drive')
      }
    } catch (error) {
      console.error('Failed to reload from Drive:', error)
      throw error
    }
  }, [data])

  return {
    data,
    loading,
    syncAlerts,
    saveAccounts,
    saveSnapshots,
    saveFamilyMembers,
    updateDriveSync,
    reloadFromDrive,
    addSyncAlert
  }
}
