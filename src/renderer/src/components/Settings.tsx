import { useState } from 'react'
import { HardDrive, LogOut, Loader, RefreshCw } from 'lucide-react'
import { AppData, DriveSync } from '../types'
import { cn } from '../utils'
import { DriveSyncService } from '../services/driveSync'

interface SettingsProps {
  data: AppData
  onUpdateDriveSync: (driveSync: DriveSync) => Promise<void>
  onReloadFromDrive?: (driveSync?: DriveSync) => Promise<void>
}

export function Settings({ data, onUpdateDriveSync, onReloadFromDrive }: SettingsProps) {
  const driveSync = data.driveSync || { enabled: false }
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isReloading, setIsReloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleConnectDrive() {
    setIsAuthenticating(true)
    setError(null)
    setSuccess(null)

    try {
      if (!window.api?.authenticateWithGoogle) {
        throw new Error('Google authentication not available in this environment')
      }

      const accessToken = await window.api.authenticateWithGoogle()

      // Try to find existing file by name
      let fileId = driveSync.fileId
      try {
        const foundFileId = await DriveSyncService.findFileId(accessToken)
        if (foundFileId) {
          fileId = foundFileId
        }
      } catch (err) {
        console.error('Could not auto-find file:', err)
      }

      await onUpdateDriveSync({
        enabled: true,
        accessToken,
        fileId,
        lastSyncAt: driveSync.lastSyncAt
      })

      // Auto-reload data from Drive after successful connection
      console.log('Auto-reload check:', { hasReloadFunc: !!onReloadFromDrive, fileId })
      if (onReloadFromDrive && fileId) {
        try {
          console.log('Starting auto-reload...')
          // Pass the new driveSync config so we don't wait for state update
          const newDriveSync = { enabled: true, accessToken, fileId, lastSyncAt: driveSync.lastSyncAt }
          await onReloadFromDrive(newDriveSync)
          console.log('Auto-reload successful!')
          setSuccess('Successfully connected to Google Drive and loaded your data!')
        } catch (err) {
          console.error('Auto-reload failed:', err)
          setSuccess('Successfully connected to Google Drive. Click refresh to load your data.')
        }
      } else {
        console.log('Skipping auto-reload - missing condition')
        setSuccess('Successfully connected to Google Drive')
      }
    } catch (err) {
      setError(`Failed to connect to Google Drive: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsAuthenticating(false)
    }
  }

  async function handleDisconnectDrive() {
    setError(null)
    setSuccess(null)

    try {
      if (driveSync.accessToken) {
        await DriveSyncService.revokeAccess(driveSync.accessToken)
      }
      await onUpdateDriveSync({ enabled: false })
      setSuccess('Disconnected from Google Drive')
    } catch (err) {
      setError(`Failed to disconnect: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleToggleSync(enabled: boolean) {
    setError(null)
    setSuccess(null)

    try {
      await onUpdateDriveSync({
        ...driveSync,
        enabled
      })
      setSuccess(enabled ? 'Google Drive sync enabled' : 'Google Drive sync disabled')
    } catch (err) {
      setError(`Failed to update sync settings: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function handleReloadFromDrive() {
    setError(null)
    setSuccess(null)
    setIsReloading(true)

    try {
      if (!onReloadFromDrive) {
        throw new Error('Reload function not available')
      }
      await onReloadFromDrive()
      setSuccess('Data reloaded from Google Drive')
    } catch (err) {
      setError(`Failed to reload from Drive: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsReloading(false)
    }
  }


  return (
    <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure app preferences and integrations</p>
      </div>

      {/* Google Drive Section */}
      <div className="space-y-6">
        <div className="bg-[#14141f] border border-white/5 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <HardDrive size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Google Drive Sync</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Backup your data to Google Drive for access across devices
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="bg-white/5 rounded-lg p-4 space-y-3">
            {driveSync.enabled && driveSync.accessToken ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Status</span>
                  <span className="text-sm font-medium text-emerald-400">Connected</span>
                </div>
                {driveSync.fileId && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">File ID</span>
                    <code className="text-xs text-gray-400 font-mono bg-black/30 px-2 py-1 rounded">
                      {driveSync.fileId}
                    </code>
                  </div>
                )}
                {driveSync.lastSyncAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Last synced</span>
                    <span className="text-sm text-gray-400">
                      {new Date(driveSync.lastSyncAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Status</span>
                <span className="text-sm font-medium text-gray-500">Not connected</span>
              </div>
            )}
          </div>

          {/* Sync Toggle */}
          {driveSync.accessToken && (
            <div className="flex items-center justify-between bg-white/5 rounded-lg p-4">
              <span className="text-sm text-gray-300">Enable automatic sync</span>
              <button
                onClick={() => handleToggleSync(!driveSync.enabled)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  driveSync.enabled ? 'bg-indigo-500' : 'bg-gray-700'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    driveSync.enabled ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 text-sm text-emerald-400">
              {success}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {!driveSync.accessToken ? (
              <button
                onClick={handleConnectDrive}
                disabled={isAuthenticating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {isAuthenticating ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Connecting…
                  </>
                ) : (
                  <>
                    <HardDrive size={16} />
                    Connect Google Drive
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  onClick={handleDisconnectDrive}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium transition-colors"
                >
                  <LogOut size={16} />
                  Disconnect
                </button>
                {onReloadFromDrive && (
                  <button
                    onClick={handleReloadFromDrive}
                    disabled={isReloading}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-indigo-400 text-sm font-medium transition-colors"
                  >
                    {isReloading ? (
                      <>
                        <Loader size={16} className="animate-spin" />
                      </>
                    ) : (
                      <RefreshCw size={16} />
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-300">How it works</h3>
        <ul className="text-xs text-gray-500 space-y-2">
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>Data is always saved locally first</span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>When enabled, your data is automatically synced to Google Drive</span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>If Drive sync fails, your data is still saved locally</span>
          </li>
          <li className="flex gap-2">
            <span className="text-indigo-400">•</span>
            <span>On startup, the latest data from Drive is loaded if available</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
