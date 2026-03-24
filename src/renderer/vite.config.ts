import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Minimal Vite config for browser-only preview (used by launch.json "Renderer (Vite only)")
export default defineConfig({
  plugins: [react()]
})
