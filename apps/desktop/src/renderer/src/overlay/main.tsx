import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@repo/ui/globals.css'
import { Overlay } from './Overlay'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Overlay />
  </StrictMode>
)
