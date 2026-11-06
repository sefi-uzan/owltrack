import { resolve } from 'node:path'
import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import remarkGfm from 'remark-gfm'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset paths + hash routing: the build works from any folder (e.g. /docs/ next to the site).
  base: './',
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  plugins: [
    { enforce: 'pre', ...mdx({ remarkPlugins: [remarkGfm] }) },
    react({ include: /\.(mdx|tsx?)$/u }),
    tailwindcss()
  ],
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true }
})
