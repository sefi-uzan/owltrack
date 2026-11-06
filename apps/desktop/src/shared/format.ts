/** 398_700 -> "398.7K", 1_234_567 -> "1.23M" */
export function compact(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`
  return `${sign}${Math.round(abs)}`
}

export function signedCompact(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—'
  return n > 0 ? `+${compact(n)}` : compact(n)
}

export function grouped(n: number | undefined): string {
  return n === undefined ? '—' : Math.round(n).toLocaleString('en-US')
}

/** 37320 -> "10h 22m", 95 -> "1m 35s" */
export function duration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '—'
  const s = Math.round(seconds)
  const d = Math.floor(s / 86_400)
  const h = Math.floor((s % 86_400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}
