import { cn } from '@repo/ui/lib/utils'
import { Info, TriangleAlert } from 'lucide-react'
import type { MDXComponents } from 'mdx/types'
import type * as React from 'react'

/** Page-internal links look like `#/slug`; everything else opens in a new tab. */
function Link({ href = '', className, ...props }: React.ComponentProps<'a'>) {
  const external = /^https?:/u.test(href)
  return (
    <a
      href={href}
      className={cn('font-medium text-maple-gold underline-offset-4 hover:underline', className)}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      {...props}
    />
  )
}

/** STE (ASD-STE100) notices: NOTE gives information, CAUTION prevents loss of data or settings. */
const NOTICES = {
  note: { icon: Info, label: 'Note', box: 'border-maple-gold/30 bg-maple-gold/[0.06]', text: 'text-maple-gold' },
  caution: { icon: TriangleAlert, label: 'Caution', box: 'border-red-400/40 bg-red-500/[0.08]', text: 'text-red-300' }
}

function Notice({ type, children }: { type: keyof typeof NOTICES; children: React.ReactNode }) {
  const n = NOTICES[type]
  return (
    <div className={cn('my-6 flex gap-3 rounded-lg border px-4 py-3 text-[15px] leading-relaxed [&_p]:my-0', n.box)}>
      <n.icon className={cn('mt-1 size-4 shrink-0', n.text)} />
      <div>
        <span className={cn('mr-1.5 font-bold tracking-wide uppercase', n.text)}>{n.label}:</span>
        {children}
      </div>
    </div>
  )
}

/** A screenshot at its real window size (the PNGs are 2x), shrunk to fit narrow screens. */
function Figure({
  src,
  alt,
  width,
  children
}: {
  src: string
  alt: string
  width: number
  children?: React.ReactNode
}) {
  return (
    <figure className="my-8">
      <img
        src={src}
        alt={alt}
        width={width}
        loading="lazy"
        className="mx-auto block h-auto max-w-full rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
      />
      {children && <figcaption className="mt-3 text-center text-sm text-maple-muted">{children}</figcaption>}
    </figure>
  )
}

/** Maps markdown elements to the app's styling. */
export const mdxComponents: MDXComponents = {
  h1: (props) => <h1 className="maple-title mb-6 text-3xl font-black tracking-wide" {...props} />,
  h2: (props) => (
    <h2 className="mt-10 mb-3 border-b border-border pb-2 text-xl font-bold tracking-tight text-white" {...props} />
  ),
  h3: (props) => <h3 className="mt-8 mb-2 text-lg font-semibold text-white" {...props} />,
  p: (props) => <p className="my-4 leading-7 text-foreground/90" {...props} />,
  a: Link,
  strong: (props) => <strong className="font-semibold text-white" {...props} />,
  ul: (props) => <ul className="my-4 ml-6 list-disc space-y-1.5 leading-7 marker:text-maple-gold" {...props} />,
  ol: (props) => <ol className="my-4 ml-6 list-decimal space-y-2 leading-7 marker:text-maple-gold" {...props} />,
  li: (props) => <li className="pl-1" {...props} />,
  blockquote: (props) => (
    <blockquote className="my-6 border-l-2 border-maple-gold pl-4 text-maple-muted italic [&_p]:my-0" {...props} />
  ),
  code: (props) => (
    <code
      className="rounded bg-maple-inset px-1.5 py-0.5 font-mono text-[0.85em] text-white ring-1 ring-white/[0.06]"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="my-6 overflow-x-auto rounded-lg bg-maple-inset p-4 text-sm ring-1 ring-white/[0.06] [&_code]:bg-transparent [&_code]:p-0 [&_code]:ring-0"
      {...props}
    />
  ),
  table: (props) => (
    <div className="my-6 overflow-x-auto rounded-lg border border-maple-edge bg-card">
      <table className="w-full text-left text-sm" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-gradient-to-b from-[#3d4661] to-maple-head" {...props} />,
  th: (props) => <th className="px-4 py-2.5 font-semibold text-maple-gold" {...props} />,
  td: (props) => <td className="border-t border-white/[0.06] px-4 py-2.5 align-top leading-6" {...props} />,
  Kbd: (props: React.ComponentProps<'kbd'>) => (
    <kbd
      className="rounded border border-[#4a5470] bg-gradient-to-b from-[#3e475f] to-[#2b3245] px-1.5 py-0.5 font-mono text-[0.8em] whitespace-nowrap text-white shadow-[0_1px_0_rgba(0,0,0,0.4)]"
      {...props}
    />
  ),
  Note: ({ children }: { children: React.ReactNode }) => <Notice type="note">{children}</Notice>,
  Caution: ({ children }: { children: React.ReactNode }) => <Notice type="caution">{children}</Notice>,
  Figure
}
