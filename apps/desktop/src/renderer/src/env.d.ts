/// <reference types="vite/client" />
import type { Api } from '@shared/api'

declare global {
  interface Window {
    api: Api
  }

  // Insertable Streams for MediaStreamTrack (Chromium) — not yet in lib.dom.
  class MediaStreamTrackProcessor {
    constructor(init: { track: MediaStreamTrack; maxBufferSize?: number })
    readonly readable: ReadableStream<VideoFrame>
  }
}
