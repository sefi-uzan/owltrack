import { cn } from '@repo/ui/lib/utils'
import { Switch as SwitchPrimitive } from 'radix-ui'
import type * as React from 'react'

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer data-[state=checked]:bg-gradient-to-b data-[state=checked]:from-[#ffc54d] data-[state=checked]:to-[#e8841a] data-[state=unchecked]:bg-maple-inset data-[state=unchecked]:ring-1 data-[state=unchecked]:ring-white/10 focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="bg-background dark:data-[state=unchecked]:bg-[#8892a8] dark:data-[state=checked]:bg-white pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
