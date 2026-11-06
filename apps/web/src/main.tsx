import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './site.css'
import { mockApi, startUncalibrated } from './demo/mock-api'

/** Screenshot mode, see Shot.tsx. `welcome` and `calibrate-empty` show the app before setup. */
const params = new URLSearchParams(window.location.search)
const shot = params.get('shot')
if (shot === 'welcome' || shot === 'calibrate-empty') startUncalibrated()

// The desktop components read `window.api` when their modules load, so install the
// simulated API before importing them.
window.api = mockApi

const root = createRoot(document.querySelector('#root')!)
if (shot) {
  const { Shot } = await import('./Shot')
  root.render(
    <StrictMode>
      <Shot name={shot} embed={params.has('embed')} />
    </StrictMode>
  )
} else {
  const { App } = await import('./App')
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}
