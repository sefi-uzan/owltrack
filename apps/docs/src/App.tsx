import { GitHubIcon, OwlTrackMark } from '@repo/ui/components/brand'
import { Button } from '@repo/ui/components/button'
import { cn } from '@repo/ui/lib/utils'
import { ChevronLeft, ChevronRight, Download, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { GITHUB_URL, RELEASES_URL, WEB_URL } from './links'
import { mdxComponents } from './mdx-components'
import { PAGES, SECTIONS } from './pages'

/** `#/quick-start` -> "quick-start". Hash routing keeps the build hostable from any folder. */
const slugFromHash = (): string => window.location.hash.replace(/^#\/?/u, '')

function useSlug(): string {
  const [slug, setSlug] = useState(slugFromHash)
  useEffect(() => {
    const onChange = (): void => setSlug(slugFromHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return slug
}

function Sidebar({ current, onNavigate }: { current: string; onNavigate: () => void }) {
  return (
    <nav className="flex flex-col gap-6">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <h3 className="mb-2 px-3 text-[11px] font-semibold tracking-[0.08em] text-maple-muted uppercase">
            {section.title}
          </h3>
          <ul className="flex flex-col gap-0.5">
            {section.pages.map((p) => (
              <li key={p.slug}>
                <a
                  href={`#/${p.slug}`}
                  onClick={onNavigate}
                  className={cn(
                    'block rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-white/[0.04] hover:text-white',
                    p.slug === current
                      ? 'bg-white/[0.06] font-semibold text-maple-gold shadow-[inset_2px_0_0_var(--color-maple-gold)]'
                      : 'text-foreground/80'
                  )}
                >
                  {p.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function App() {
  const slug = useSlug()
  const [menuOpen, setMenuOpen] = useState(false)
  const index = Math.max(
    0,
    PAGES.findIndex((p) => p.slug === slug)
  )
  const page = PAGES[index]
  const prev = PAGES[index - 1]
  const next = PAGES[index + 1]

  useEffect(() => {
    document.title = `${page.title} · OwlTrack Docs`
    window.scrollTo(0, 0)
  }, [page])

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,#1d2333,#121621_60%)]">
      <header className="sticky top-0 z-30 border-b border-maple-edge bg-gradient-to-b from-[#3a4360]/95 to-[#262d40]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-5">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
          <a href={WEB_URL} className="flex items-center gap-3">
            <OwlTrackMark />
            <span className="maple-title text-[17px] font-black tracking-wide">OwlTrack</span>
          </a>
          <span className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[11px] font-semibold text-maple-muted">
            Docs
          </span>
          <nav className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="max-sm:hidden">
              <a href={WEB_URL}>Home</a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label="GitHub">
                <GitHubIcon className="size-4" /> <span className="max-sm:hidden">GitHub</span>
              </a>
            </Button>
            <Button asChild size="sm">
              <a href={RELEASES_URL}>
                <Download /> Download
              </a>
            </Button>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-10 px-5">
        <aside
          className={cn(
            'shrink-0 py-8 md:sticky md:top-14 md:block md:h-[calc(100vh-3.5rem)] md:w-56 md:overflow-y-auto',
            menuOpen ? 'fixed inset-x-0 top-14 bottom-0 z-20 block overflow-y-auto bg-background px-5' : 'hidden'
          )}
        >
          <Sidebar current={page.slug} onNavigate={() => setMenuOpen(false)} />
        </aside>

        <main className="min-w-0 max-w-3xl flex-1 py-10">
          <article>
            <page.Content components={mdxComponents} />
          </article>

          <div className="mt-14 grid grid-cols-2 gap-3 border-t border-border pt-6">
            {prev ? (
              <a
                href={`#/${prev.slug}`}
                className="group rounded-lg border border-maple-edge bg-card px-4 py-3 transition-colors hover:border-maple-gold/50"
              >
                <span className="flex items-center gap-1 text-xs text-maple-muted">
                  <ChevronLeft className="size-3.5" /> Previous
                </span>
                <span className="font-semibold text-white group-hover:text-maple-gold">{prev.title}</span>
              </a>
            ) : (
              <span />
            )}
            {next && (
              <a
                href={`#/${next.slug}`}
                className="group rounded-lg border border-maple-edge bg-card px-4 py-3 text-right transition-colors hover:border-maple-gold/50"
              >
                <span className="flex items-center justify-end gap-1 text-xs text-maple-muted">
                  Next <ChevronRight className="size-3.5" />
                </span>
                <span className="font-semibold text-white group-hover:text-maple-gold">{next.title}</span>
              </a>
            )}
          </div>

          <footer className="mt-10 text-xs text-maple-muted">
            Something wrong or missing?{' '}
            <a
              className="text-maple-gold underline-offset-4 hover:underline"
              href={`${GITHUB_URL}/edit/master/apps/docs/src/content/${page.slug}.mdx`}
              target="_blank"
              rel="noreferrer"
            >
              Edit this page on GitHub
            </a>
            .
          </footer>
        </main>
      </div>
    </div>
  )
}
