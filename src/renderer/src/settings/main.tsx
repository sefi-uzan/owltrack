import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/globals.css'
import { Settings } from './Settings'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Settings />
  </StrictMode>
)
