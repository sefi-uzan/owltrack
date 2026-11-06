import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './site.css'
import { mockApi } from './demo/mock-api'

// The desktop components read `window.api` when their modules load, so install the
// simulated API before importing them.
window.api = mockApi
const { App } = await import('./App')

createRoot(document.querySelector('#root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
