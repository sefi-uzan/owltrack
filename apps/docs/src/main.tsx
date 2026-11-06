import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@repo/ui/globals.css'
import { App } from './App'

createRoot(document.querySelector('#root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
