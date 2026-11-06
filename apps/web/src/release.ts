import { useEffect, useState } from 'react'
import { RELEASES_URL, REPO } from './links'

export interface Release {
  /** Direct link to the installer, or the latest-release page until (or if) the lookup fails. */
  url: string
  version?: string
  sizeMb?: number
}

interface GitHubRelease {
  tag_name: string
  assets: { name: string; size: number; browser_download_url: string }[]
}

/**
 * Looks up the latest GitHub release so the button downloads the installer directly. Installer
 * names include the version (OwlTrack-Setup-x.y.z.exe), so there's no stable "latest" file URL.
 * If the API is unreachable or rate-limited, the button falls back to the releases page.
 */
export function useLatestRelease(): Release {
  const [release, setRelease] = useState<Release>({ url: RELEASES_URL })
  useEffect(() => {
    const ctrl = new AbortController()
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: ctrl.signal
    })
      .then((res) => (res.ok ? (res.json() as Promise<GitHubRelease>) : Promise.reject(new Error(res.statusText))))
      .then((r) => {
        const setup = r.assets.find((a) => /^OwlTrack-Setup-.*\.exe$/u.test(a.name))
        setRelease({
          url: setup?.browser_download_url ?? RELEASES_URL,
          version: r.tag_name.replace(/^v/u, ''),
          sizeMb: setup ? Math.round(setup.size / 1024 / 1024) : undefined
        })
      })
      .catch(() => {
        // Keep the releases-page fallback.
      })
    return () => ctrl.abort()
  }, [])
  return release
}
