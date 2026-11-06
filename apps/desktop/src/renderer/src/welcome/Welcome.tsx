import { Button } from '@repo/ui/components/button'
import { Label } from '@repo/ui/components/label'
import { Switch } from '@repo/ui/components/switch'
import { ArrowRight, CircleCheck, Crosshair, Gamepad2, Gauge, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import iconUrl from '../../../../assets/icon.svg'
import { useSystemOptions } from '../components/useSystemOptions'
import { Inset, Panel } from '../settings/Panel'

const STEPS = [
  {
    icon: <Gamepad2 />,
    title: 'Run MapleStory windowed',
    text: 'Windowed or borderless, so the overlay can sit on top.'
  },
  { icon: <Crosshair />, title: 'Draw three boxes', text: 'Around your EXP numbers, level and name. Takes a minute.' },
  { icon: <Gauge />, title: 'Grind', text: 'EXP per hour, last 5 minutes and time to level, live.' }
]

function Option({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange
}: {
  id: string
  label: string
  hint: string
  checked: boolean
  disabled: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-[13px]">
          {label}
        </Label>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  )
}

export function Welcome() {
  const { options, setOpenAtLogin, setDesktopShortcut } = useSystemOptions()
  // Reinstall/upgrade: settings.json survives uninstall, so the boxes may already be drawn.
  const [calibrated, setCalibrated] = useState<boolean | null>(null)
  useEffect(() => {
    void window.api.getSettings().then((s) => setCalibrated(Boolean(s.regions.exp)))
  }, [])
  const devHint = options && !options.packaged ? ' (only in the installed app)' : ''

  return (
    <div className="flex h-full flex-col bg-[radial-gradient(ellipse_at_top,#1d2333,#121621_70%)] select-none">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-maple-edge bg-gradient-to-b from-[#3a4360] to-[#262d40] pl-4 shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)] [-webkit-app-region:drag]">
        <h1 className="maple-title text-[13px] font-black tracking-wide">OwlTrack setup</h1>
        <span className="text-[11px] text-maple-muted">{options && `v${options.version}`}</span>
        <button
          type="button"
          title="Close"
          className="ml-auto grid h-full w-11 place-items-center text-maple-muted transition-colors hover:bg-red-500/80 hover:text-white [-webkit-app-region:no-drag] [&>svg]:size-4"
          onClick={() => window.api.finishSetup(false)}
        >
          <X />
        </button>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-4 px-1">
          <img src={iconUrl} alt="" className="size-14 rounded-xl shadow-lg ring-1 ring-black/40" draggable={false} />
          <div>
            <h2 className="maple-title text-xl font-black tracking-wide">OwlTrack is installed</h2>
            <p className="mt-0.5 text-sm text-maple-muted">
              {calibrated
                ? 'Welcome back. Your settings and calibration were kept.'
                : 'An EXP tracker that reads your game window.'}
            </p>
          </div>
        </div>

        {calibrated ? (
          <Inset className="flex items-start gap-3 p-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-emerald-500/15 text-emerald-400 [&>svg]:size-4">
              <CircleCheck />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white">You're ready to go</p>
              <p className="text-xs text-maple-muted">
                The overlay picks up where you left off once MapleStory is running. If the UI moved or you changed
                resolution, redraw the boxes in Settings → Calibrate.
              </p>
            </div>
          </Inset>
        ) : (
          <Inset className="flex flex-col gap-2.5 p-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-md border border-[#a8580c] bg-gradient-to-b from-[#ffd463] to-[#e57f12] text-white [&>svg]:size-4 [&>svg]:drop-shadow-[0_1px_1px_rgba(90,40,0,0.8)]">
                  {s.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white">
                    {i + 1}. {s.title}
                  </p>
                  <p className="text-xs text-maple-muted">{s.text}</p>
                </div>
              </div>
            ))}
          </Inset>
        )}

        <Panel title="Preferences" bodyClassName="divide-y divide-white/[0.06] py-0">
          <Option
            id="login"
            label="Start with Windows"
            hint={`Opens quietly in the tray when you sign in.${devHint}`}
            checked={options?.openAtLogin ?? false}
            disabled={!options?.packaged}
            onChange={setOpenAtLogin}
          />
          <Option
            id="shortcut"
            label="Desktop shortcut"
            hint={`OwlTrack is always in the Start menu.${devHint}`}
            checked={options?.desktopShortcut ?? false}
            disabled={!options?.packaged}
            onChange={setDesktopShortcut}
          />
        </Panel>
      </main>

      <footer className="flex shrink-0 items-center gap-3 border-t border-maple-edge bg-black/20 px-4 py-3">
        <p className="flex items-center gap-1.5 text-[11px] text-maple-muted [&>svg]:size-3.5 [&>svg]:text-emerald-400">
          <ShieldCheck /> Works offline. Nothing leaves your PC.
        </p>
        {calibrated ? (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => window.api.finishSetup(true)}>
              Open settings
            </Button>
            <Button onClick={() => window.api.finishSetup(false)}>
              Done <ArrowRight />
            </Button>
          </div>
        ) : (
          <Button className="ml-auto" disabled={calibrated === null} onClick={() => window.api.finishSetup(true)}>
            Start calibrating <ArrowRight />
          </Button>
        )}
      </footer>
    </div>
  )
}
