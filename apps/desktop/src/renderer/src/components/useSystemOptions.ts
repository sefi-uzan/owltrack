import type { SystemOptions } from '@shared/types'
import { useEffect, useState } from 'react'

/** Start-with-Windows and desktop-shortcut state, read from Windows rather than settings.json. */
export function useSystemOptions(): {
  options: SystemOptions | null
  setOpenAtLogin: (on: boolean) => void
  setDesktopShortcut: (on: boolean) => void
} {
  const [options, setOptions] = useState<SystemOptions | null>(null)
  useEffect(() => {
    void window.api.getSystemOptions().then(setOptions)
  }, [])
  return {
    options,
    setOpenAtLogin: (on) => void window.api.setOpenAtLogin(on).then(setOptions),
    setDesktopShortcut: (on) => void window.api.setDesktopShortcut(on).then(setOptions)
  }
}
