import { existsSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { SystemOptions } from '@shared/types'
import { app, shell } from 'electron'

export const APP_ID = 'com.sefiuzan.owltrack'

/**
 * Same path the NSIS installer uses, so its uninstaller removes a shortcut made here, and its
 * updates leave it alone if the user turned it off.
 */
const desktopLink = (): string => join(app.getPath('desktop'), 'OwlTrack.lnk')

export function getSystemOptions(): SystemOptions {
  const packaged = app.isPackaged
  return {
    packaged,
    version: app.getVersion(),
    // The Run key value is named after the AppUserModelId; the uninstaller deletes it (build/installer.nsh).
    openAtLogin: packaged && app.getLoginItemSettings().openAtLogin,
    desktopShortcut: packaged && existsSync(desktopLink())
  }
}

export function setOpenAtLogin(on: boolean): void {
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: on })
}

export function setDesktopShortcut(on: boolean): void {
  if (!app.isPackaged) return
  const link = desktopLink()
  try {
    if (on) {
      shell.writeShortcutLink(link, 'create', {
        target: process.execPath,
        cwd: dirname(process.execPath),
        icon: process.execPath,
        iconIndex: 0,
        appUserModelId: APP_ID
      })
    } else if (existsSync(link)) {
      unlinkSync(link)
    }
  } catch (err) {
    console.error('Failed to update the desktop shortcut', err)
  }
}
