import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input bg-maple-inset shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] h-9 w-full min-w-0 rounded-md border px-3 py-1 text-sm transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        className
      )}
      {...props}
    />
  )
}

export { Input }
