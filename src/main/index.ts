import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import * as fs from 'fs'
import 'dotenv/config'

const DATA_FILE = join(app.getPath('userData'), 'networth-data.json')

function readData(): object {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      // Migration: convert old string[] familyMembers to FamilyMember[]
      if (parsed.familyMembers && Array.isArray(parsed.familyMembers) && typeof parsed.familyMembers[0] === 'string') {
        parsed.familyMembers = parsed.familyMembers.map((name: string) => ({ name, isChild: false }))
      }
      return parsed
    }
  } catch (e) {
    console.error('Failed to read data file:', e)
  }
  return { accounts: [], snapshots: [] }
}

function writeData(data: unknown): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
  } catch (e) {
    console.error('Failed to write data file:', e)
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#09090f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.networth-tracker')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('getData', () => {
    return readData()
  })

  ipcMain.handle('saveData', (_event, data: unknown) => {
    writeData(data)
    return true
  })

  ipcMain.handle('shell:openExternal', (_event, externalUrl: string) => {
    shell.openExternal(externalUrl)
    return true
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
