import { Overlay } from '@desktop/overlay/Overlay'
import { Settings } from '@desktop/settings/Settings'
import { Welcome } from '@desktop/welcome/Welcome'
import { useEffect } from 'react'
import { demoEvents } from './demo/mock-api'

/** Window sizes from apps/desktop/src/main/windows.ts. */
const WINDOWS = {
  settings: { width: 1000, height: 680 },
  welcome: { width: 560, height: 520 }
}

/**
 * `?shot=<name>` renders one desktop window on its own, at its real size, inside `#shot`.
 * apps/docs/scripts/screenshots.mjs captures these for the docs. With `embed`, the window fills the page
 * instead, for the landing page to show in an iframe (so it gets its own, uncalibrated, demo).
 */
export function Shot({ name, embed }: { name: string; embed: boolean }) {
  useEffect(() => {
    if (name === 'overlay-unlocked') void window.api.updateSettings({ overlay: { locked: false } })
  }, [name])

  // Let the landing page react to the welcome screen's buttons.
  useEffect(() => demoEvents.finishSetup.on(() => window.parent.postMessage('owltrack:finishSetup', '*')), [])

  if (name === 'overlay' || name === 'overlay-unlocked') {
    return (
      <div id="shot" className="inline-block p-4">
        <Overlay />
      </div>
    )
  }
  const kind = name.startsWith('welcome') ? 'welcome' : 'settings'
  if (embed) return kind === 'welcome' ? <Welcome /> : <Settings />
  return (
    <div className="p-6">
      <div
        id="shot"
        className="overflow-hidden rounded-lg border border-maple-edge shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
        style={WINDOWS[kind]}
      >
        {kind === 'welcome' ? <Welcome /> : <Settings />}
      </div>
    </div>
  )
}
