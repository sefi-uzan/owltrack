import { dirname, join, sep } from 'node:path'
import { createWorker, OEM, PSM, type Worker, type WorkerParams } from 'tesseract.js'
import type { RegionKey } from '@shared/types'

/**
 * Packaged builds keep tesseract (which spawns a worker_thread from its own folder) unpacked
 * next to the asar archive. Point at those real files instead of the virtual asar path.
 */
const unpacked = (p: string): string => p.replace(`app.asar${sep}`, `app.asar.unpacked${sep}`)
const pkgDir = (name: string): string => unpacked(dirname(require.resolve(`${name}/package.json`)))

type Kind = 'line' | 'block'

const KIND: Record<RegionKey, Kind> = {
  level: 'line',
  exp: 'line',
  name: 'block',
  notices: 'block'
}

const PARAMS: Record<Kind, Partial<WorkerParams>> = {
  // A single line of digits: level tiles, "66.380[15.50%]".
  line: {
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    tessedit_char_whitelist: '0123456789.,[]()%',
    user_defined_dpi: '300'
  },
  // Free text: job/name box, drop notices.
  block: {
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    tessedit_char_whitelist: '',
    user_defined_dpi: '300'
  }
}

/**
 * One long-lived Tesseract worker (runs in a worker thread, off the main loop). Jobs are
 * serialised and parameters are only switched when the kind of region changes — one worker
 * keeps memory down; reads take ~5-30ms so a queue is plenty.
 */
export class OcrEngine {
  private worker?: Promise<Worker>
  private kind?: Kind
  private queue: Promise<unknown> = Promise.resolve()
  private pending = 0
  private lastUsed = Date.now()
  private idleTimer = setInterval(() => this.reapIfIdle(), 15_000)

  /** Shut the worker down after this long unused (frees ~300 MB); it restarts on the next read. */
  static IDLE_MS = 60_000

  private reapIfIdle(): void {
    if (!this.worker || this.pending > 0 || Date.now() - this.lastUsed < OcrEngine.IDLE_MS) return
    const w = this.worker
    this.worker = undefined
    this.kind = undefined
    void w.then((x) => x.terminate()).catch(() => undefined)
    if (process.env.EXP_TRACKER_DEBUG) console.log('[ocr] engine idle: shut down')
  }

  private get(): Promise<Worker> {
    if (!this.worker) {
      this.worker = createWorker('eng', OEM.LSTM_ONLY, {
        langPath: join(pkgDir('@tesseract.js-data/eng'), '4.0.0_best_int'),
        workerPath: join(pkgDir('tesseract.js'), 'src', 'worker-script', 'node', 'index.js'),
        gzip: true,
        cacheMethod: 'none'
      })
      this.worker.catch(() => (this.worker = undefined))
      this.kind = undefined
    }
    return this.worker
  }

  /** Warm up so the first real read isn't slow. */
  preload(): void {
    void this.get().catch((e) => console.error('OCR init failed', e))
  }

  recognize(key: RegionKey, png: Buffer): Promise<string> {
    this.pending++
    this.lastUsed = Date.now()
    const job = this.queue.then(async () => {
      const worker = await this.get()
      const kind = KIND[key]
      if (this.kind !== kind) {
        await worker.setParameters(PARAMS[kind])
        this.kind = kind
      }
      const { data } = await worker.recognize(png)
      return data.text ?? ''
    })
    this.queue = job.catch(() => undefined)
    return job.finally(() => {
      this.pending--
      this.lastUsed = Date.now()
    })
  }

  async dispose(): Promise<void> {
    clearInterval(this.idleTimer)
    const w = this.worker
    this.worker = undefined
    if (w) await (await w).terminate().catch(() => undefined)
  }
}
