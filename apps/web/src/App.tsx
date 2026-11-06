import { Overlay } from '@desktop/overlay/Overlay'
import { Settings as SettingsWindow } from '@desktop/settings/Settings'
import { GitHubIcon, OwlTrackMark } from '@repo/ui/components/brand'
import { Button } from '@repo/ui/components/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/card'
import type { Settings, TrackerSnapshot } from '@shared/types'
import { BookOpen, Download, Gauge, Layers, MousePointerClick, ScanText, ShieldCheck, WifiOff } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gameFrame } from './demo/game-frame'
import { demoEvents } from './demo/mock-api'
import { DOCS_URL, GITHUB_URL, RELEASES_URL } from './links'
import { type Release, useLatestRelease } from './release'

const api = window.api

function useDemo(): { settings: Settings | null; snap: TrackerSnapshot | null } {
  const [settings, setSettings] = useState<Settings | null>(null)
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
  return { settings, snap }
}

function DownloadButton({ release }: { release: Release }) {
  return (
    <Button asChild size="lg">
      <a href={release.url}>
        <Download />
        Download for Windows
        {release.version && <span className="font-normal opacity-85">v{release.version}</span>}
      </a>
    </Button>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-maple-edge bg-gradient-to-b from-[#3a4360]/95 to-[#262d40]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-5">
        <OwlTrackMark />
        <span className="maple-title text-[17px] font-black tracking-wide">OwlTrack</span>
        <nav className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <a href={DOCS_URL}>
              <BookOpen /> Docs
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              <GitHubIcon className="size-4" /> GitHub
            </a>
          </Button>
        </nav>
      </div>
    </header>
  )
}

/** The real overlay component, scaled and faded the way the Settings window says. */
function LiveOverlay({ settings }: { settings: Settings | null }) {
  const scale = settings?.overlay.scale ?? 1
  return (
    <div
      className="origin-top-right transition-[transform,opacity] duration-200"
      style={{
        transform: `scale(${scale})`,
        opacity: settings?.overlay.visible === false ? 0 : (settings?.overlay.opacity ?? 1)
      }}
    >
      <Overlay />
    </div>
  )
}

/** A fake game window with the overlay floating in its corner, like it does in-game. */
function GameScene({ settings, snap }: { settings: Settings | null; snap: TrackerSnapshot | null }) {
  const frame =
    snap?.exp === undefined
      ? undefined
      : gameFrame({
          level: snap.level ?? 0,
          job: snap.job ?? '',
          name: snap.detectedName ?? '',
          exp: snap.exp,
          percent: snap.percent ?? 0
        })
  return (
    <div className="relative overflow-hidden rounded-xl border border-maple-edge bg-maple-inset shadow-[0_20px_60px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,255,255,0.06)]">
      <div className="flex h-8 items-center gap-2 border-b border-black/50 bg-gradient-to-b from-[#3d4661] to-maple-head px-3 text-[12px] text-maple-muted">
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="size-2.5 rounded-full bg-white/15" />
        <span className="ml-2 truncate">Your game, windowed or borderless</span>
      </div>
      <div className="relative aspect-[16/9]">
        {frame && <img src={frame} alt="A made-up game scene with an EXP bar" className="absolute inset-0 size-full" />}
        <div className="absolute top-3 right-3 origin-top-right scale-[0.62] sm:scale-75 lg:scale-90">
          <LiveOverlay settings={settings} />
        </div>
      </div>
    </div>
  )
}

/** Renders a fixed-size desktop window and shrinks it to fit narrower screens. */
function ScaledWindow({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = outer.current
    if (!el) return
    const update = (): void => setScale(Math.min(1, el.clientWidth / width))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])
  return (
    <div ref={outer} className="w-full" style={{ height: height * scale }}>
      <div
        className="mx-auto origin-top-left overflow-hidden rounded-xl border border-maple-edge shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
        style={{ width, height, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  )
}

const SETUP_STEPS = [
  'Download and run OwlTrack-Setup.exe.',
  'Choose Start with Windows and a desktop shortcut.',
  'Draw three boxes around your EXP, level and name. That is all.'
]

const FEATURES = [
  {
    icon: ScanText,
    title: 'Reads the game window',
    text: 'Level, character name and EXP are read straight off the screen. No memory reading, no packet sniffing, no game files touched.'
  },
  {
    icon: Gauge,
    title: 'The numbers you grind for',
    text: 'EXP in the last 5 minutes, EXP/hour, session total and time to next level, updated as soon as the bar moves.'
  },
  {
    icon: MousePointerClick,
    title: 'Stays out of your way',
    text: 'Always on top and click-through. Ctrl+Shift+L unlocks it to drag, Ctrl+Shift+H hides it.'
  },
  {
    icon: ShieldCheck,
    title: 'Sanity-checked readings',
    text: 'EXP and % have to agree before anything counts, and level-ups and deaths are told apart.'
  },
  {
    icon: Layers,
    title: 'Light on your PC',
    text: 'Only the regions you draw are processed, OCR runs only when they change, and a self-learned digit matcher reads EXP in about a millisecond.'
  },
  {
    icon: WifiOff,
    title: 'Offline and open source',
    text: 'Nothing is sent anywhere. MIT licensed, built in the open on GitHub, releases code-signed via SignPath.'
  }
]

export function App() {
  const { settings, snap } = useDemo()
  const release = useLatestRelease()
  const settingsRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const toSettings = (): void => settingsRef.current?.scrollIntoView({ behavior: 'smooth' })
    const a = demoEvents.openSettings.on(toSettings)
    const onMessage = (e: MessageEvent): void => {
      if (e.origin === window.location.origin && e.data === 'owltrack:finishSetup') toSettings()
    }
    window.addEventListener('message', onMessage)
    const b = (): void => window.removeEventListener('message', onMessage)
    return () => {
      a()
      b()
    }
  }, [])

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,#232b40,#121621_60%)]">
      <Header />

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pt-14 pb-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:pt-20">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-maple-edge bg-maple-inset px-3 py-1 text-xs font-semibold text-maple-muted">
              <span className="size-1.5 rounded-full bg-[#a6ee45]" /> Free · Open source · Windows 10/11
            </p>
            <h1 className="text-4xl leading-[1.1] font-black tracking-tight text-white sm:text-5xl">
              Your <span className="maple-title">EXP/hour</span>, always on screen.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-maple-muted">
              OwlTrack is an always-on-top overlay for MapleStory. It reads your level and EXP straight from the game
              window and tells you how fast you're levelling and when you'll hit the next one.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <DownloadButton release={release} />
              <Button asChild size="lg" variant="outline">
                <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                  <GitHubIcon className="size-4" /> GitHub
                </a>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <a href={DOCS_URL}>
                  <BookOpen /> Docs
                </a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-maple-muted">
              One-click installer for Windows x64. No admin rights needed.{' '}
              <a className="text-maple-gold underline-offset-4 hover:underline" href={RELEASES_URL}>
                All releases
              </a>
            </p>
          </div>

          <GameScene settings={settings} snap={snap} />
        </section>

        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 lg:grid-cols-[minmax(0,1fr)_560px]">
          <div>
            <h2 className="maple-title text-2xl font-black tracking-wide">Installed in one click</h2>
            <p className="mt-2 max-w-xl text-maple-muted">
              No wizard and no admin prompt. The installer puts OwlTrack in your user folder and starts it. Then this
              welcome screen lets you pick your options and takes you to calibration.
            </p>
            <ol className="mt-6 flex flex-col gap-3">
              {SETUP_STEPS.map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md border border-[#a8580c] bg-gradient-to-b from-[#ffd463] to-[#e57f12] text-xs font-black text-white [text-shadow:0_1px_1px_rgba(90,40,0,0.8)]">
                    {i + 1}
                  </span>
                  <span className="text-foreground/90">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <ScaledWindow width={560} height={520}>
            <iframe
              src="?shot=welcome&embed"
              sandbox="allow-scripts allow-same-origin"
              title="OwlTrack welcome screen"
              className="block size-full border-0"
            />
          </ScaledWindow>
        </section>

        <section ref={settingsRef} className="scroll-mt-20 border-y border-maple-edge bg-black/20 py-16">
          <div className="mx-auto max-w-6xl px-5">
            <h2 className="maple-title text-2xl font-black tracking-wide">Try the real thing</h2>
            <p className="mt-2 mb-8 max-w-2xl text-maple-muted">
              This is OwlTrack's actual settings window, running in your browser on a simulated session. Drag new boxes
              in <b className="text-white">Calibrate</b>, or change the size and opacity in{' '}
              <b className="text-white">Overlay</b> and watch the overlay above follow along.
            </p>
            <ScaledWindow width={1000} height={680}>
              <SettingsWindow />
            </ScaledWindow>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <CardHeader>
                  <f.icon className="mb-2 size-5 text-maple-gold" />
                  <CardTitle className="text-white">{f.title}</CardTitle>
                  <CardDescription className="leading-relaxed">{f.text}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div className="mt-16 flex flex-col items-center gap-4 text-center">
            <h2 className="text-2xl font-black text-white">Ready to see your real numbers?</h2>
            <DownloadButton release={release} />
          </div>
        </section>
      </main>

      <footer className="border-t border-maple-edge py-8 text-sm text-maple-muted">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5">
          <span>© Sefi Uzan · MIT License</span>
          <a className="hover:text-white" href={DOCS_URL}>
            Docs
          </a>
          <a className="hover:text-white" href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <span className="w-full text-xs sm:ml-auto sm:w-auto">
            Fan-made, not affiliated with or endorsed by NEXON. MapleStory is a trademark of NEXON Korea Corporation.
          </span>
        </div>
      </footer>
    </div>
  )
}
