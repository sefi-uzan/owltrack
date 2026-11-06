import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The demo renders the desktop app's real Overlay and Settings components against a simulated `window.api`.
const desktop = resolve(import.meta.dirname, '../desktop/src')

export default defineConfig({
  // Relative asset paths, so the build works from any folder (a domain root or e.g. GitHub Pages' /owltrack/).
  base: './',
  resolve: {
    alias: {
      '@desktop': resolve(desktop, 'renderer/src'),
      '@shared': resolve(desktop, 'shared'),
      '@': resolve(import.meta.dirname, 'src')
    }
  },
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true }
})
