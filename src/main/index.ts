import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import * as fs from 'fs'
import * as http from 'http'
import * as url from 'url'
import 'dotenv/config'

const DATA_FILE = join(app.getPath('userData'), 'networth-data.json')
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = 'http://localhost:3000/oauth/callback'

function readData(): object {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8')
      return JSON.parse(raw)
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

  ipcMain.handle('authenticateWithGoogle', async () => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env')
    }

    return new Promise<string>((resolve, reject) => {
      // Start local server to handle OAuth callback
      const server = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url || '', true)
        const pathname = parsedUrl.pathname
        const query = parsedUrl.query

        if (pathname === '/oauth/callback') {
          try {
            if (!query.code) {
              throw new Error('No authorization code received')
            }

            // Exchange auth code for access token
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                code: query.code as string,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code'
              }).toString()
            })

            if (!tokenResponse.ok) {
              throw new Error(`Token exchange failed: ${tokenResponse.statusText}`)
            }

            const tokenData = await tokenResponse.json()
            const accessToken = tokenData.access_token

            // Send success response
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(`
              <html>
                <head><title>Authorization Successful</title></head>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1>✓ Authorization Successful</h1>
                  <p>Your Google Drive is now connected. You can close this window.</p>
                </body>
              </html>
            `)

            server.close()
            resolve(accessToken)
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' })
            res.end(`
              <html>
                <head><title>Authorization Failed</title></head>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1>✗ Authorization Failed</h1>
                  <p>${error instanceof Error ? error.message : String(error)}</p>
                </body>
              </html>
            `)

            server.close()
            reject(error)
          }
        } else {
          res.writeHead(404)
          res.end('Not found')
        }
      })

      // Start server on port 3000
      server.listen(3000, () => {
        // Open browser with Google OAuth consent screen
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
        authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
        authUrl.searchParams.set('response_type', 'code')
        authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.file')
        authUrl.searchParams.set('access_type', 'offline')

        shell.openExternal(authUrl.toString())
      })

      // Timeout after 10 minutes
      setTimeout(() => {
        server.close()
        reject(new Error('OAuth authentication timeout'))
      }, 600000)
    })
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
