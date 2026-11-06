import { Button } from '@repo/ui/components/button'
import { Slider } from '@repo/ui/components/slider'
import { cn } from '@repo/ui/lib/utils'
import type { Rect, RegionDebug, RegionKey, Settings } from '@shared/types'
import { Camera, Crosshair, ListChecks, Trash2, ZoomIn } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Inset, Panel } from './Panel'

const api = window.api

export const REGION_INFO: Record<RegionKey, { label: string; color: string; hint: string }> = {
  level: { label: 'Level', color: '#f59e0b', hint: 'Only the orange digit tiles (not the “LV.” text).' },
  name: { label: 'Job + name', color: '#38bdf8', hint: 'Both lines next to the level: job on top, name below.' },
  exp: {
    label: 'EXP numbers',
    color: '#84cc16',
    hint: 'Just the numbers, e.g. “66.380[15.50%]” — leave out the “EXP” label.'
  }
}

/** Calibration order. The tracker needs all three. */
export const REQUIRED_REGIONS: RegionKey[] = ['exp', 'level', 'name']
const ORDER = REQUIRED_REGIONS

function useRegionDebug(): Partial<Record<RegionKey, RegionDebug>> {
  const [debug, setDebug] = useState<Partial<Record<RegionKey, RegionDebug>>>({})
  useEffect(() => api.onRegionDebug((d) => setDebug((prev) => ({ ...prev, [d.key]: d }))), [])
  return debug
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

export function Calibrator({ settings, streaming }: { settings: Settings; streaming: boolean }) {
  const [frame, setFrame] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<RegionKey>('exp')
  const [draft, setDraft] = useState<Rect | null>(null)
  const [zoom, setZoom] = useState(1)
  const start = useRef<{ x: number; y: number } | null>(null)
  const surface = useRef<HTMLDivElement>(null)
  const debug = useRegionDebug()

  const grab = async (): Promise<void> => {
    setError(null)
    const img = await api.takeSnapshot()
    if (img) setFrame(img)
    else setError('No frame received. Make sure the game is running and not minimized.')
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: grab one frame when streaming starts, not on every re-render.
  useEffect(() => {
    if (streaming && !frame) void grab()
  }, [streaming])

  const point = (e: React.PointerEvent): { x: number; y: number } => {
    const r = surface.current!.getBoundingClientRect()
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) }
  }

  const onDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = point(e)
    setDraft({ ...start.current, w: 0, h: 0 })
  }
  const onMove = (e: React.PointerEvent): void => {
    if (!start.current) return
    const p = point(e)
    const s = start.current
    setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) })
  }
  const onUp = (): void => {
    const d = draft
    start.current = null
    setDraft(null)
    if (d && d.w > 0.002 && d.h > 0.002) {
      void api.updateSettings({ regions: { ...settings.regions, [active]: d } })
      const next = ORDER[ORDER.indexOf(active) + 1]
      if (next && !settings.regions[next]) setActive(next)
    }
  }

  const clear = (key: RegionKey): void => {
    const regions = { ...settings.regions }
    delete regions[key]
    void api.updateSettings({ regions })
  }

  const info = REGION_INFO[active]

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_300px] gap-3">
      <Panel
        title="Game frame"
        icon={<Camera />}
        bodyClassName="flex flex-col gap-2"
        action={
          <>
            <ZoomIn className="size-4 text-maple-muted" />
            <Slider className="w-24" min={1} max={4} step={0.5} value={[zoom]} onValueChange={([v]) => setZoom(v)} />
            <Button size="sm" variant="outline" onClick={() => void grab()} disabled={!streaming}>
              <Camera /> Grab frame
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Crosshair className="size-3.5 shrink-0" style={{ color: info.color }} />
          <span>
            Drag a box around <b style={{ color: info.color }}>{info.label}</b>. {info.hint}
          </span>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Inset className="min-h-0 flex-1 overflow-auto bg-black/50">
          {frame ? (
            <div
              ref={surface}
              className="relative cursor-crosshair touch-none select-none"
              style={{ width: `${zoom * 100}%` }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
            >
              <img
                src={frame}
                alt="Game window snapshot"
                className="pointer-events-none block w-full"
                draggable={false}
              />
              {ORDER.map((key) => {
                const r = settings.regions[key]
                if (!r) return null
                return (
                  <RectBox
                    key={key}
                    rect={r}
                    color={REGION_INFO[key].color}
                    label={REGION_INFO[key].label}
                    dim={key !== active}
                  />
                )
              })}
              {draft && <RectBox rect={draft} color={info.color} label={info.label} />}
            </div>
          ) : (
            <div className="grid h-full min-h-40 place-items-center text-sm text-muted-foreground">
              {streaming ? 'Grabbing a frame…' : 'Waiting for the game window…'}
            </div>
          )}
        </Inset>
      </Panel>

      <Panel title="Regions" icon={<ListChecks />} bodyClassName="flex flex-col gap-1.5 overflow-auto p-2">
        {ORDER.map((key) => {
          const ri = REGION_INFO[key]
          const rect = settings.regions[key]
          const d = debug[key]
          const selected = active === key
          return (
            <div
              key={key}
              className={cn(
                'rounded-md border transition-colors',
                selected ? 'border-maple-gold/60 bg-white/[0.04]' : 'border-transparent hover:bg-white/[0.03]'
              )}
            >
              <div className="flex items-center gap-2 px-2 py-1.5">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => setActive(key)}
                  title={`Draw ${ri.label}`}
                >
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: ri.color }} />
                  <span className={cn('truncate text-sm font-semibold', selected && 'text-maple-gold')}>
                    {ri.label}
                  </span>
                  <span
                    className={cn(
                      'ml-auto shrink-0 rounded px-1.5 text-[10px] font-bold',
                      rect ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                    )}
                  >
                    {rect ? 'set' : 'not set'}
                  </span>
                </button>
              </div>

              {selected && (
                <div className="flex flex-col gap-2 px-2 pb-2">
                  {d && rect ? (
                    <Inset className="flex flex-col gap-1 p-1.5">
                      <img
                        src={d.image}
                        alt="What the OCR saw"
                        className="max-h-16 w-full rounded-sm bg-white object-contain object-left"
                      />
                      <div className="flex items-baseline justify-between gap-2 text-[11px]">
                        <code className="truncate text-muted-foreground" title={d.text}>
                          {d.text.replace(/\n/gu, ' ⏎ ') || '(nothing read)'}
                        </code>
                        <span className="shrink-0 font-semibold text-maple-gold">
                          {d.parsed} <span className="font-normal text-muted-foreground">· {d.ms}ms</span>
                        </span>
                      </div>
                    </Inset>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {rect ? 'Waiting for the next read…' : 'Drag a box on the frame to start reading it.'}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className="w-24 shrink-0"
                      title="Brightness cut-off for the black-on-white mask the OCR reads"
                    >
                      Threshold <b className="text-white tabular-nums">{settings.thresholds[key]}</b>
                    </span>
                    <Slider
                      min={60}
                      max={240}
                      step={5}
                      value={[settings.thresholds[key]]}
                      onValueChange={([v]) =>
                        void api.updateSettings({ thresholds: { ...settings.thresholds, [key]: v } })
                      }
                    />
                    {rect && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 shrink-0"
                        onClick={() => clear(key)}
                        title="Clear"
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <p className="mt-auto px-1 pt-2 text-[11px] leading-snug text-muted-foreground">
          The preview is exactly what the OCR sees: aim for crisp black text on white. Keep boxes tight around the text.
        </p>
      </Panel>
    </div>
  )
}

function RectBox({ rect, color, label, dim }: { rect: Rect; color: string; label: string; dim?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute border-2"
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.w * 100}%`,
        height: `${rect.h * 100}%`,
        borderColor: color,
        background: `${color}22`,
        opacity: dim ? 0.65 : 1
      }}
    >
      <span
        className={cn(
          'absolute -top-5 rounded px-1',
          rect.x + rect.w > 0.85 ? 'right-0' : 'left-0',
          'text-[10px] font-semibold whitespace-nowrap text-black'
        )}
        style={{ background: color }}
      >
        {label}
      </span>
    </div>
  )
}
