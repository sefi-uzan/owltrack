import { cn } from '@/lib/utils'

/** A MapleStory-style window: raised slate title strip with a gold title over a dark panel body. */
export function Panel({
  title,
  icon,
  action,
  children,
  className,
  bodyClassName
}: {
  title: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-lg border border-maple-edge bg-card shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07),0_2px_8px_rgba(0,0,0,0.35)]',
        className
      )}
    >
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-black/50 bg-gradient-to-b from-[#3d4661] to-maple-head px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] [&>svg]:size-4 [&>svg]:text-maple-gold">
        {icon}
        <h2 className="maple-title truncate text-[13px] font-bold tracking-wide">{title}</h2>
        {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
      </header>
      <div className={cn('min-h-0 flex-1 p-3', bodyClassName)}>{children}</div>
    </section>
  )
}

/** Dark recessed well, like the item/stat slots inside MapleStory windows. */
export function Inset({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-md bg-maple-inset shadow-[inset_0_1px_3px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.06]', className)}
      {...props}
    />
  )
}
