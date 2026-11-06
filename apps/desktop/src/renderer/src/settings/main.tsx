import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@repo/ui/globals.css'
import { Settings } from './Settings'

createRoot(document.querySelector('#root')!).render(
  <StrictMode>
    <Settings />
  </StrictMode>
)
