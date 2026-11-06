import { useEffect, useState } from 'react'
import { BarChart3, Crosshair, Eye, Gamepad2, MonitorUp, RotateCcw, ScanText, SlidersHorizontal } from 'lucide-react'
import { compact, duration, grouped, signedCompact } from '@shared/format'
import type { Settings as SettingsT, TrackerSnapshot, WindowSourceInfo } from '@shared/types'
import { Button } from '@repo/ui/components/button'
import { Input } from '@repo/ui/components/input'
import { Label } from '@repo/ui/components/label'
import { Slider } from '@repo/ui/components/slider'
import { Switch } from '@repo/ui/components/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/tabs'
import { cn } from '@repo/ui/lib/utils'
import { Calibrator, REQUIRED_REGIONS } from './Calibrator'
import { Inset, Panel } from './Panel'

const api = window.api

function Row({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <Label className="text-[13px]">{label}</Label>
        {hint && <p className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  )
}

function Value({ children }: { children: React.ReactNode }) {
  return <span className="font-bold text-maple-gold tabular-nums">{children}</span>
}

/** Game window status + picker, always visible in the title bar. */
function GameWindow({ settings, snap }: { settings: SettingsT; snap: TrackerSnapshot | null }) {
  const [title, setTitle] = useState(settings.windowTitle)
  const [windows, setWindows] = useState<WindowSourceInfo[] | null>(null)
  useEffect(() => setTitle(settings.windowTitle), [settings.windowTitle])

  const state = snap?.capture.state ?? 'idle'
  const streaming = state === 'streaming'
  const label = streaming ? 'Capturing' : state === 'error' ? 'Error' : state === 'starting' ? 'Connecting' : 'Searching'
  const detail = streaming
    ? `${snap?.capture.windowName} · ${snap?.capture.frameWidth}×${snap?.capture.frameHeight}`
    : (snap?.capture.message ?? 'Run the game windowed or borderless.')

  return (
    <div className="relative ml-auto flex min-w-0 items-center gap-2">
      <div className="flex min-w-0 items-center gap-2 pr-1 text-xs" title={detail}>
        <span
          className={cn(
            'size-2 shrink-0 rounded-full ring-2 ring-black/30',
            streaming ? 'bg-[#a6ee45]' : state === 'error' ? 'bg-red-400' : 'animate-pulse bg-amber-300'
          )}
        />
        <span className="shrink-0 font-semibold">{label}</span>
        <span className="truncate text-maple-muted">{detail}</span>
      </div>
      <Input
        className="h-8 w-48"
        value={title}
        placeholder="Window title contains…"
        title="The game window is found by this part of its title"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title !== settings.windowTitle && void api.updateSettings({ windowTitle: title })}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <Button size="sm" variant="outline" onClick={() => void api.listWindows().then(setWindows)}>
        <MonitorUp /> Pick
      </Button>
      {windows && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setWindows(null)} />
          <Inset className="absolute top-10 right-0 z-20 max-h-64 w-80 overflow-auto bg-card p-1 shadow-xl ring-maple-edge">
            {windows.length === 0 && <p className="p-3 text-sm text-muted-foreground">No windows found.</p>}
            {windows.map((w) => (
              <button
                key={w.id}
                className="block w-full truncate rounded px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-maple-gold"
                onClick={() => {
                  void api.updateSettings({ windowTitle: w.name })
                  setWindows(null)
                }}
              >
                {w.name}
              </button>
            ))}
          </Inset>
        </>
      )}
    </div>
  )
}

/**
 * OCR can't always tell look-alike letters apart in the game font (f/t, l/I). Fixing the spelling
 * stores an alias for the detected name, so it sticks for that character only.
 */
function NameRow({ settings, detected }: { settings: SettingsT; detected?: string }) {
  const shown = detected ? (settings.nameAliases[detected] ?? detected) : ''
  const [value, setValue] = useState(shown)
  useEffect(() => setValue(shown), [shown])

  const save = (): void => {
    if (!detected) return
    const aliases = { ...settings.nameAliases }
    const v = value.trim()
    if (!v || v === detected) delete aliases[detected]
    else aliases[detected] = v
    void api.updateSettings({ nameAliases: aliases })
  }

  return (
    <Row
      label="Character name"
      hint={detected ? `Read as “${detected}”. Fix a wrong letter here; it's remembered per character.` : 'Shown once the name box is calibrated.'}
    >
      <Input
        className="w-40"
        value={value}
        disabled={!detected}
        placeholder="Not detected yet"
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </Row>
  )
}

function OverlayTab({ settings, snap }: { settings: SettingsT; snap: TrackerSnapshot | null }) {
  const o = settings.overlay
  return (
    <div className="grid grid-cols-2 items-start gap-3">
      <Panel title="Display" icon={<Eye />} bodyClassName="divide-y divide-white/[0.06] py-1">
        <Row label="Show overlay" hint="Ctrl+Shift+H">
          <Switch checked={o.visible} onCheckedChange={(v) => void api.updateSettings({ overlay: { visible: v } })} />
        </Row>
        <Row label="Lock in place" hint="Clicks pass through to the game. Ctrl+Shift+L to unlock and drag.">
          <Switch checked={o.locked} onCheckedChange={(v) => void api.updateSettings({ overlay: { locked: v } })} />
        </Row>
        <Row label={<>Size <Value>{Math.round(o.scale * 100)}%</Value></>}>
          <Slider
            className="w-40"
            min={0.7}
            max={1.8}
            step={0.05}
            value={[o.scale]}
            onValueChange={([v]) => void api.updateSettings({ overlay: { scale: v } })}
          />
        </Row>
        <Row label={<>Opacity <Value>{Math.round(o.opacity * 100)}%</Value></>}>
          <Slider
            className="w-40"
            min={0.3}
            max={1}
            step={0.05}
            value={[o.opacity]}
            onValueChange={([v]) => void api.updateSettings({ overlay: { opacity: v } })}
          />
        </Row>
      </Panel>

      <Panel title="Reading" icon={<ScanText />} bodyClassName="divide-y divide-white/[0.06] py-1">
        <NameRow settings={settings} detected={snap?.detectedName} />
        <Row
          label={<>Capture rate <Value>{settings.captureFps} fps</Value></>}
          hint="Regions are only read when they change, so this mostly sets reaction time."
        >
          <Slider
            className="w-40"
            min={1}
            max={10}
            step={1}
            value={[settings.captureFps]}
            onValueChange={([v]) => void api.updateSettings({ captureFps: v })}
          />
        </Row>
        <Row label="Count mesos" hint="Experimental. Reads meso notices; draw the Meso notices box in Calibrate.">
          <Switch
            checked={settings.noticesEnabled}
            onCheckedChange={(v) => void api.updateSettings({ noticesEnabled: v })}
          />
        </Row>
      </Panel>
    </div>
  )
}

function SessionTab({ snap }: { snap: TrackerSnapshot | null }) {
  const items: [string, string, boolean?][] = [
    ['Character', `${snap?.name ?? '—'}${snap?.job ? ` · ${snap.job}` : ''}`],
    ['Level', snap?.level !== undefined ? String(snap.level) : '—'],
    ['EXP', snap?.exp !== undefined ? `${grouped(snap.exp)} / ${grouped(snap.required)}` : '—'],
    ['Session length', duration(snap?.sessionSeconds)],
    ['Gained this session', signedCompact(snap?.session), true],
    ['Levels gained', String(snap?.levelsGained ?? 0)],
    ['EXP / hour (30m)', compact(snap?.ratePerHour), true],
    ['Time to level', duration(snap?.etaSeconds)],
    ['Mesos this session', snap?.noticesEnabled ? compact(snap.mesos.session) : 'off']
  ]
  return (
    <Panel
      title="Current session"
      icon={<BarChart3 />}
      action={
        <Button size="sm" variant="outline" onClick={() => void api.resetSession()}>
          <RotateCcw /> Reset session
        </Button>
      }
    >
      <dl className="grid grid-cols-3 gap-2">
        {items.map(([k, v, accent]) => (
          <Inset key={k} className="px-3 py-2">
            <dt className="text-[11px] font-semibold tracking-wide text-maple-muted uppercase">{k}</dt>
            <dd className={cn('truncate text-lg font-bold tabular-nums', accent && 'text-maple-gold')}>{v}</dd>
          </Inset>
        ))}
      </dl>
    </Panel>
  )
}

/** Compact live readout in the sidebar, so you can see calibration working from any tab. */
function LiveReadout({ snap }: { snap: TrackerSnapshot | null }) {
  const pct = snap?.percent !== undefined ? Math.max(0, Math.min(100, snap.percent)) : 0
  return (
    <Inset className="flex flex-col gap-1.5 p-2.5 text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-bold text-white">{snap?.name ?? 'No character'}</span>
        <span className="shrink-0 font-black text-maple-gold italic">LV. {snap?.level ?? '?'}</span>
      </div>
      <div className="relative h-3.5 overflow-hidden rounded-sm bg-black/50 ring-1 ring-white/10">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-b from-[#c8f25a] via-[#98d42a] to-[#6fae16] transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
        <span className="relative block text-center text-[10px] leading-3.5 font-bold text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.8)]">
          {snap?.percent !== undefined ? `${snap.percent.toFixed(2)}%` : '—'}
        </span>
      </div>
      <div className="flex justify-between text-maple-muted">
        <span>EXP/h</span>
        <span className="font-semibold text-white tabular-nums">{compact(snap?.ratePerHour)}</span>
      </div>
    </Inset>
  )
}

export function Settings() {
  const [settings, setSettings] = useState<SettingsT | null>(null)
  const [snap, setSnap] = useState<TrackerSnapshot | null>(null)

  useEffect(() => {
    void api.getSettings().then(setSettings)
    void api.getSnapshot().then(setSnap)
    const a = api.onSettings(setSettings)
    const b = api.onTracker(setSnap)
    return () => {
      a()
      b()
    }
  }, [])

  if (!settings) return null

  const setCount = REQUIRED_REGIONS.filter((k) => settings.regions[k]).length

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(ellipse_at_top,#1d2333,#121621_70%)]">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-maple-edge bg-gradient-to-b from-[#3a4360] to-[#262d40] px-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]">
        <div className="grid size-7 place-items-center rounded-md border border-[#a8580c] bg-gradient-to-b from-[#ffd463] to-[#e57f12] text-[11px] font-black text-white [text-shadow:0_1px_1px_rgba(90,40,0,0.8)]">
          EXP
        </div>
        <h1 className="maple-title text-[15px] font-black tracking-wide">EXP Tracker</h1>
        <GameWindow settings={settings} snap={snap} />
      </header>

      <Tabs
        orientation="vertical"
        defaultValue={settings.regions.exp ? 'overlay' : 'calibrate'}
        className="min-h-0 flex-1 flex-row gap-0"
      >
        <aside className="flex w-48 shrink-0 flex-col gap-3 border-r border-maple-edge bg-black/15 p-3">
          <TabsList className="bg-transparent p-0">
            <TabsTrigger value="calibrate">
              <Crosshair /> Calibrate
              <span
                className={cn(
                  'ml-auto rounded px-1.5 text-[10px] font-bold',
                  setCount === REQUIRED_REGIONS.length ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                )}
              >
                {setCount}/{REQUIRED_REGIONS.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="overlay">
              <SlidersHorizontal /> Overlay
            </TabsTrigger>
            <TabsTrigger value="session">
              <Gamepad2 /> Session
            </TabsTrigger>
          </TabsList>

          <div className="mt-auto flex flex-col gap-3">
            <LiveReadout snap={snap} />
            <div className="flex flex-col gap-1 text-[11px] text-maple-muted">
              <div className="flex justify-between">
                <span>Lock / unlock</span>
                <kbd className="font-mono text-white/80">Ctrl+Shift+L</kbd>
              </div>
              <div className="flex justify-between">
                <span>Show / hide</span>
                <kbd className="font-mono text-white/80">Ctrl+Shift+H</kbd>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 p-3">
          <TabsContent value="calibrate" className="h-full">
            <Calibrator settings={settings} streaming={snap?.capture.state === 'streaming'} />
          </TabsContent>
          <TabsContent value="overlay" className="h-full overflow-auto">
            <OverlayTab settings={settings} snap={snap} />
          </TabsContent>
          <TabsContent value="session" className="h-full overflow-auto">
            <SessionTab snap={snap} />
          </TabsContent>
        </main>
      </Tabs>
    </div>
  )
}
