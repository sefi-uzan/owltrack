import { useEffect, useRef, useState } from 'react'
import { Camera, Crosshair, Trash2, ZoomIn } from 'lucide-react'
import type { Rect, RegionDebug, RegionKey, Settings } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const api = window.api

export const REGION_INFO: Record<RegionKey, { label: string; color: string; hint: string }> = {
  level: { label: 'Level', color: '#f59e0b', hint: 'Only the orange digit tiles (not the “LV.” text).' },
  name: { label: 'Job + name', color: '#38bdf8', hint: 'Both lines next to the level: job on top, name below.' },
  exp: {
    label: 'EXP numbers',
    color: '#84cc16',
    hint: 'Just the numbers, e.g. “66.380[15.50%]” — leave out the “EXP” label.'
  },
  notices: {
    label: 'Meso notices',
    color: '#e879f9',
    hint: 'Experimental. The “You have gained mesos (+52)” lines on the right — only mesos are counted.'
  }
}

const ORDER: RegionKey[] = ['exp', 'level', 'name', 'notices']

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

  useEffect(() => {
    if (streaming && !frame) void grab()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (next && !settings.regions[next] && (next !== 'notices' || settings.noticesEnabled)) setActive(next)
    }
  }

  const clear = (key: RegionKey): void => {
    const regions = { ...settings.regions }
    delete regions[key]
    void api.updateSettings({ regions })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle>Game frame</CardTitle>
          <CardDescription>
            Pick a region on the right, then drag a box around it on the frame. Boxes are stored relative to the
            window size.
          </CardDescription>
          <CardAction className="flex items-center gap-2">
            <ZoomIn className="size-4 text-muted-foreground" />
            <Slider className="w-28" min={1} max={4} step={0.5} value={[zoom]} onValueChange={([v]) => setZoom(v)} />
            <Button size="sm" variant="outline" onClick={() => void grab()} disabled={!streaming}>
              <Camera /> Grab frame
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-4">
          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
          <div className="max-h-[420px] overflow-auto rounded-lg border bg-black/40">
            {frame ? (
              <div
                ref={surface}
                className="relative cursor-crosshair touch-none select-none"
                style={{ width: `${zoom * 100}%` }}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
              >
                <img src={frame} className="pointer-events-none block w-full" draggable={false} />
                {ORDER.map((key) => {
                  const r = settings.regions[key]
                  if (!r) return null
                  return (
                    <RectBox key={key} rect={r} color={REGION_INFO[key].color} label={REGION_INFO[key].label} dim={key !== active} />
                  )
                })}
                {draft && <RectBox rect={draft} color={REGION_INFO[active].color} label={REGION_INFO[active].label} />}
              </div>
            ) : (
              <div className="grid h-56 place-items-center text-sm text-muted-foreground">
                {streaming ? 'Grabbing a frame…' : 'Waiting for the game window…'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {ORDER.map((key) => {
          const info = REGION_INFO[key]
          const rect = settings.regions[key]
          const d = debug[key]
          const disabled = key === 'notices' && !settings.noticesEnabled
          return (
            <Card
              key={key}
              className={cn('gap-3 py-3 transition-colors', active === key && 'border-primary/70 bg-primary/5')}
            >
              <CardHeader className="px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <span className="size-2.5 rounded-sm" style={{ background: info.color }} />
                  {info.label}
                  {rect ? <Badge variant="success">set</Badge> : <Badge variant="warning">not set</Badge>}
                </CardTitle>
                <CardDescription className="text-xs">{info.hint}</CardDescription>
                <CardAction className="flex items-center gap-1">
                  {key === 'notices' && (
                    <Switch
                      checked={settings.noticesEnabled}
                      onCheckedChange={(v) => void api.updateSettings({ noticesEnabled: v })}
                      title="Enable notice capture"
                    />
                  )}
                  <Button
                    size="sm"
                    variant={active === key ? 'default' : 'outline'}
                    onClick={() => setActive(key)}
                    disabled={disabled}
                  >
                    <Crosshair /> Draw
                  </Button>
                  {rect && (
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => clear(key)} title="Clear">
                      <Trash2 />
                    </Button>
                  )}
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 px-4">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="w-20 shrink-0">Threshold {settings.thresholds[key]}</span>
                  <Slider
                    min={60}
                    max={240}
                    step={5}
                    value={[settings.thresholds[key]]}
                    onValueChange={([v]) => void api.updateSettings({ thresholds: { ...settings.thresholds, [key]: v } })}
                  />
                </div>
                {d && rect && !disabled ? (
                  <div className="flex flex-col gap-1.5">
                    <img src={d.image} className="max-h-24 w-full rounded border bg-white object-contain object-left" />
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <code className="truncate text-muted-foreground" title={d.text}>
                        {d.text.replace(/\n/g, ' ⏎ ') || '(nothing read)'}
                      </code>
                      <span className="shrink-0 font-medium text-foreground">
                        {d.parsed} <span className="text-muted-foreground">· {d.ms}ms</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {rect ? 'Waiting for the next read…' : 'Draw this region to start reading it.'}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Tip: the preview shows exactly what the OCR sees — text should be crisp black on white. Nudge the threshold
        until it is, and keep boxes tight around the text.
      </p>
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
        className="absolute -top-5 left-0 rounded px-1 text-[10px] font-semibold whitespace-nowrap text-black"
        style={{ background: color }}
      >
        {label}
      </span>
    </div>
  )
}
