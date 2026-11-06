import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { Api, Unsubscribe } from '@shared/api'

function on<T>(channel: string, cb: (value: T) => void): Unsubscribe {
  const listener = (_e: IpcRendererEvent, value: T): void => cb(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: Api = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  onSettings: (cb) => on('settings:changed', cb),

  getSnapshot: () => ipcRenderer.invoke('tracker:get'),
  onTracker: (cb) => on('tracker:update', cb),
  resetSession: () => ipcRenderer.invoke('tracker:reset'),

  listWindows: () => ipcRenderer.invoke('capture:listWindows'),
  takeSnapshot: () => ipcRenderer.invoke('capture:snapshot'),
  onRegionDebug: (cb) => on('debug:region', cb),

  openSettings: () => ipcRenderer.send('app:openSettings'),
  resizeOverlay: (w, h) => ipcRenderer.send('overlay:resize', w, h),
  setOverlayInteractive: (on) => ipcRenderer.send('overlay:interactive', on),
  setOverlayEditing: (on) => ipcRenderer.send('overlay:editing', on),

  captureReady: () => ipcRenderer.send('capture:ready'),
  captureStatus: (s) => ipcRenderer.send('capture:status', s),
  onCaptureSource: (cb) => on('capture:source', cb),
  onSnapshotRequest: (cb) => on('capture:snapshotRequest', () => cb()),
  sendSnapshot: (jpeg) => ipcRenderer.send('capture:snapshotResult', jpeg ? new Uint8Array(jpeg) : null),
  ocrRegion: (key, png) => ipcRenderer.invoke('ocr:region', key, new Uint8Array(png))
}

contextBridge.exposeInMainWorld('api', api)
