import { useEffect, useState } from 'react'
import { Gamepad2, Keyboard, MonitorUp, RefreshCw, RotateCcw } from 'lucide-react'
import { compact, duration, grouped, signedCompact } from '@shared/format'
import type { Settings as SettingsT, TrackerSnapshot, WindowSourceInfo } from '@shared/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calibrator } from './Calibrator'

const api = window.api

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-2">
      <div className="min-w-0">
        <Label>{label}</Label>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  )
}

function CaptureCard({ settings, snap }: { settings: SettingsT; snap: TrackerSnapshot | null }) {
  const [title, setTitle] = useState(settings.windowTitle)
  const [windows, setWindows] = useState<WindowSourceInfo[] | null>(null)
  useEffect(() => setTitle(settings.windowTitle), [settings.windowTitle])

  const state = snap?.capture.state ?? 'idle'
  const badge =
    state === 'streaming' ? (
      <Badge variant="success">Capturing</Badge>
    ) : state === 'error' ? (
      <Badge variant="destructive">Error</Badge>
    ) : (
      <Badge variant="warning">{state === 'starting' ? 'Connecting' : 'Searching'}</Badge>
    )

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2">
          <Gamepad2 className="size-4" /> Game window {badge}
        </CardTitle>
        <CardDescription>
          {state === 'streaming'
            ? `${snap?.capture.windowName} · ${snap?.capture.frameWidth}×${snap?.capture.frameHeight}`
            : (snap?.capture.message ?? 'Run the game in windowed or borderless mode.')}
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Input
            className="w-56"
            value={title}
            placeholder="Window title contains…"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== settings.windowTitle && void api.updateSettings({ windowTitle: title })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          <Button size="sm" variant="outline" onClick={() => void api.listWindows().then(setWindows)}>
            <MonitorUp /> Pick window
          </Button>
        </CardAction>
      </CardHeader>
      {windows && (
        <CardContent className="px-4">
          <div className="max-h-40 overflow-auto rounded-md border">
            {windows.length === 0 && <p className="p-3 text-sm text-muted-foreground">No windows found.</p>}
            {windows.map((w) => (
              <button
                key={w.id}
                className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => {
                  void api.updateSettings({ windowTitle: w.name })
                  setWindows(null)
                }}
              >
                {w.name}
              </button>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
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
      hint={
        detected
          ? `Read from the game as “${detected}”. If a letter is wrong, fix it here; it's remembered for this character.`
          : 'Shown once the name box is calibrated and read.'
      }
    >
      <Input
        className="w-56"
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
    <Card className="py-4">
      <CardContent className="divide-y px-5">
        <Row label="Show overlay" hint="Ctrl+Shift+H">
          <Switch checked={o.visible} onCheckedChange={(v) => void api.updateSettings({ overlay: { visible: v } })} />
        </Row>
        <Row
          label="Lock overlay"
          hint="Locked = clicks pass through to the game. Unlock (Ctrl+Shift+L) to drag it somewhere else."
        >
          <Switch checked={o.locked} onCheckedChange={(v) => void api.updateSettings({ overlay: { locked: v } })} />
        </Row>
        <Row label={`Size · ${Math.round(o.scale * 100)}%`}>
          <Slider
            className="w-56"
            min={0.7}
            max={1.8}
            step={0.05}
            value={[o.scale]}
            onValueChange={([v]) => void api.updateSettings({ overlay: { scale: v } })}
          />
        </Row>
        <Row label={`Opacity · ${Math.round(o.opacity * 100)}%`}>
          <Slider
            className="w-56"
            min={0.3}
            max={1}
            step={0.05}
            value={[o.opacity]}
            onValueChange={([v]) => void api.updateSettings({ overlay: { opacity: v } })}
          />
        </Row>
        <NameRow settings={settings} detected={snap?.detectedName} />
        <Row
          label={`Capture rate · ${settings.captureFps} fps`}
          hint="Frames sampled from the game. Regions are only OCR'd when their pixels change, so this mostly sets reaction time."
        >
          <Slider
            className="w-56"
            min={1}
            max={10}
            step={1}
            value={[settings.captureFps]}
            onValueChange={([v]) => void api.updateSettings({ captureFps: v })}
          />
        </Row>
      </CardContent>
    </Card>
  )
}

function SessionTab({ snap }: { snap: TrackerSnapshot | null }) {
  const items: [string, string][] = [
    ['Character', `${snap?.name ?? '—'}${snap?.job ? ` · ${snap.job}` : ''}`],
    ['Level', snap?.level !== undefined ? String(snap.level) : '—'],
    ['EXP', snap?.exp !== undefined ? `${grouped(snap.exp)} / ${grouped(snap.required)}` : '—'],
    ['Session length', duration(snap?.sessionSeconds)],
    ['Gained this session', signedCompact(snap?.session)],
    ['Levels gained', String(snap?.levelsGained ?? 0)],
    ['EXP / hour (30m)', compact(snap?.ratePerHour)],
    ['Time to level', duration(snap?.etaSeconds)],
    ['Mesos this session', snap?.noticesEnabled ? compact(snap.mesos.session) : 'notices off']
  ]
  return (
    <Card className="py-4">
      <CardHeader className="px-5">
        <CardTitle>Current session</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" onClick={() => void api.resetSession()}>
            <RotateCcw /> Reset session
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-5">
        <dl className="grid grid-cols-3 gap-x-6 gap-y-4">
          {items.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="text-lg font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
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

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-5">
      <header className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-lg bg-[#b8743c] text-sm font-black text-white">ET</div>
        <div>
          <h1 className="text-lg leading-tight font-semibold">EXP Tracker</h1>
          <p className="text-xs text-muted-foreground">Reads level, name and EXP straight from the game window.</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Keyboard className="size-3.5" /> Ctrl+Shift+L lock · Ctrl+Shift+H hide
        </div>
      </header>

      <CaptureCard settings={settings} snap={snap} />

      <Tabs defaultValue={settings.regions.exp ? 'overlay' : 'calibrate'}>
        <TabsList>
          <TabsTrigger value="calibrate">
            <RefreshCw /> Calibrate
          </TabsTrigger>
          <TabsTrigger value="overlay">Overlay</TabsTrigger>
          <TabsTrigger value="session">Session</TabsTrigger>
        </TabsList>
        <TabsContent value="calibrate">
          <Calibrator settings={settings} streaming={snap?.capture.state === 'streaming'} />
        </TabsContent>
        <TabsContent value="overlay">
          <OverlayTab settings={settings} snap={snap} />
        </TabsContent>
        <TabsContent value="session">
          <SessionTab snap={snap} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
