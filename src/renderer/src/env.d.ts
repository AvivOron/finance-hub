/// <reference types="vite/client" />

import type { AppData } from './types'

declare global {
  interface Window {
    api: {
      getData: () => Promise<AppData>
      saveData: (data: AppData) => Promise<boolean>
    }
  }
}
