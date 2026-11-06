import { cn } from '@repo/ui/lib/utils'
import { compact, duration, grouped, signedCompact } from '@shared/format'
import type { Settings, TrackerSnapshot } from '@shared/types'
import { Coins, Move, Pencil, Settings2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const api = window.api

function useTracker(): TrackerSnapshot | null {
  const [snap, setSnap] = useState<TrackerSnapshot | null>(null)
  useEffect(() => {
    void api.getSnapshot().then(setSnap)
    return api.onTracker(setSnap)
  }, [])
  return snap
}

function useSettings(): Settings | null {
  const [s, set] = useState<Settings | null>(null)
  useEffect(() => {
    void api.getSettings().then(set)
    return api.onSettings(set)
  }, [])
  return s
}

function LevelBadge({ level }: { level?: number }) {
  const digits = level === undefined ? ['?', '?'] : String(level).split('')
  return (
    <div className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-maple-inset px-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_3px_rgba(0,0,0,0.5)]">
      <span className="pr-0.5 text-[13px] font-black italic tracking-tight text-white">LV.</span>
      {digits.map((d, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: digits are positional.
          key={i}
          className="grid h-5.5 w-4 place-items-center rounded-[4px] bg-tile text-[13px] font-black text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.18)]"
        >
          {d}
        </span>
      ))}
    </div>
  )
}

function ExpBar({ exp, percent }: { exp?: number; percent?: number }) {
  const width = percent === undefined ? 0 : Math.max(0, Math.min(100, percent))
  return (
    <div className="relative h-8 min-w-0 flex-1 overflow-hidden rounded-lg bg-maple-inset shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.08]">
      <div
        className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-b from-[#c8f25a] via-[#98d42a] to-[#6fae16] transition-[width] duration-700 ease-out"
        style={{ width: `${width}%` }}
      />
      <div className="relative flex h-full items-center justify-center gap-1.5 px-2 text-[12.5px] font-bold whitespace-nowrap text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">
        <span className="font-black text-[#ffe36b] italic">EXP</span>
        <span className="tabular-nums">
          {exp === undefined ? '—' : grouped(exp)}
          {percent !== undefined && <span className="text-white/85"> [{percent.toFixed(2)}%]</span>}
        </span>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0 rounded-md bg-maple-inset px-2.5 py-1.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.06]">
      <div className="truncate text-[10px] font-semibold tracking-[0.08em] text-maple-muted uppercase">{label}</div>
      <div
        className={cn(
          'truncate text-[19px] leading-tight font-extrabold tabular-nums text-white',
          accent && 'text-maple-gold'
        )}
      >
        {value}
      </div>
    </div>
  )
}

const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

/**
 * Character name with a hover pencil to fix OCR misreads ("Ynsht" -> "Ynshf"). The fix is saved
 * as an alias for the detected spelling, so it sticks for that character only.
 *
 * The overlay is normally click-through, so hovering asks main to accept the mouse, and editing
 * briefly takes keyboard focus; both are released when done.
 */
function CharacterName({ snap, settings }: { snap: TrackerSnapshot | null; settings: Settings | null }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const detected = snap?.detectedName
  const editable = Boolean(detected && settings)

  const finish = (save: boolean): void => {
    setEditing(false)
    api.setOverlayEditing(false)
    api.setOverlayInteractive(false)
    if (!(save && detected && settings)) return
    const aliases = { ...settings.nameAliases }
    const v = value.trim()
    if (!v || v === detected) delete aliases[detected]
    else aliases[detected] = v
    void api.updateSettings({ nameAliases: aliases })
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        maxLength={16}
        spellCheck={false}
        style={noDrag}
        className="ml-auto w-28 rounded bg-black/25 px-1.5 py-0.5 text-right text-[13px] font-extrabold text-white outline-none ring-1 ring-white/40 focus:ring-white/80"
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish(true)
          if (e.key === 'Escape') finish(false)
        }}
      />
    )
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only toggles click-through so the edit button can be reached.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: same as above.
    <span
      className="group ml-auto flex min-w-0 items-center gap-1"
      style={noDrag}
      onMouseEnter={() => editable && api.setOverlayInteractive(true)}
      onMouseLeave={() => api.setOverlayInteractive(false)}
    >
      {editable && (
        <button
          type="button"
          className="grid size-4.5 shrink-0 place-items-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/20"
          title={`Read as “${detected}”. Click to fix the spelling.`}
          onClick={() => {
            setValue(snap?.name ?? detected ?? '')
            setEditing(true)
            api.setOverlayEditing(true)
          }}
        >
          <Pencil className="size-3" />
        </button>
      )}
      <span className="truncate text-[13px] font-extrabold text-white">{snap?.name ?? snap?.job ?? ''}</span>
    </span>
  )
}

function statusLine(snap: TrackerSnapshot): string | null {
  if (!snap.calibrated) return 'Not calibrated — right-click the tray icon › Settings'
  switch (snap.capture.state) {
    case 'searching':
      return snap.capture.message ?? 'Looking for the game window…'
    case 'starting':
      return 'Connecting to the game window…'
    case 'error':
      return snap.capture.message ?? 'Capture error'
    case 'idle':
      return snap.capture.message ?? 'Waiting for the game…'
    default:
      return snap.exp === undefined ? 'Reading the EXP bar…' : null
  }
}

export function Overlay() {
  const snap = useTracker()
  const settings = useSettings()
  const ref = useRef<HTMLDivElement>(null)
  const unlocked = settings ? !settings.overlay.locked : false

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const report = (): void => api.resizeOverlay(el.offsetWidth, el.offsetHeight)
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const capturing = snap?.capture.state === 'streaming'
  const message = snap ? statusLine(snap) : 'Starting…'

  return (
    <div
      ref={ref}
      className="w-[340px] p-1.5"
      style={unlocked ? ({ WebkitAppRegion: 'drag' } as React.CSSProperties) : undefined}
    >
      <div
        className={cn(
          'overflow-hidden rounded-[10px] border border-maple-edge bg-maple-panel/95 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09),0_6px_18px_rgba(0,0,0,0.45)]',
          unlocked && 'outline-2 outline-offset-2 outline-dashed outline-maple-gold'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-black/50 bg-gradient-to-b from-[#46506c] to-maple-head px-3 py-1.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
          <span
            className={cn(
              'size-2 shrink-0 rounded-full ring-2 ring-black/15',
              capturing ? 'bg-[#a6ee45]' : snap?.capture.state === 'error' ? 'bg-red-400' : 'bg-amber-300 animate-pulse'
            )}
            title={snap?.capture.windowName ?? 'Not capturing'}
          />
          <span className="maple-title text-[11px] font-black tracking-[0.14em]">EXP TRACKER</span>
          <CharacterName snap={snap} settings={settings} />
          {unlocked && (
            <>
              <Move className="size-3.5 shrink-0 opacity-80" />
              <button
                type="button"
                className="grid size-5 shrink-0 place-items-center rounded hover:bg-white/15"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                onClick={() => api.openSettings()}
                title="Settings"
              >
                <Settings2 className="size-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Story 1: level + EXP bar */}
        <div className="flex items-center gap-2 px-2.5 pt-2.5 pb-2">
          <LevelBadge level={snap?.level} />
          <ExpBar exp={snap?.exp} percent={snap?.percent} />
        </div>

        {message && (
          <div className="mx-2.5 mb-2 truncate rounded-md bg-black/30 px-2 py-1 text-[11px] font-medium text-maple-muted ring-1 ring-white/5">
            {message}
          </div>
        )}

        {/* Story 2: 2x2 stats */}
        <div className="grid grid-cols-2 gap-1.5 px-2.5 pb-2.5">
          <Stat label="Last 5 min" value={signedCompact(snap?.last5m)} />
          <Stat label="EXP/h · 30m" value={compact(snap?.ratePerHour)} accent />
          <Stat
            label={`This session${snap && snap.sessionSeconds > 0 ? ` · ${duration(snap.sessionSeconds)}` : ''}`}
            value={signedCompact(snap?.session)}
          />
          <Stat
            label={snap?.level === undefined ? 'To next level' : `To Lv. ${snap.level + 1}`}
            value={duration(snap?.etaSeconds)}
          />
        </div>

        {snap?.noticesEnabled && (
          <div className="flex items-center gap-2 border-t border-black/40 bg-black/20 px-3 py-1.5 text-[11px] text-maple-muted">
            <Coins className="size-3.5 shrink-0 text-maple-gold" />
            <span className="font-semibold tracking-[0.08em] uppercase">Mesos</span>
            <span
              className="ml-auto font-bold text-maple-gold tabular-nums"
              title="Approximate: notice lines the OCR can't read cleanly are skipped, so this undercounts"
            >
              ≈ +{compact(snap.mesos.session)}
            </span>
            <span className="tabular-nums">· {compact(snap.mesos.ratePerHour)}/h</span>
          </div>
        )}
      </div>
    </div>
  )
}
