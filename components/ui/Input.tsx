import * as React from 'react'
import { cn } from './cn'

type Props = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, Props>(function Input(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-md border-2 border-border bg-surface px-3 text-base font-bold shadow-[2px_2px_0px_#1A1A1A]',
        'text-text-primary placeholder:text-text-muted',
        'transition-all duration-fast ease-enter',
        'hover:shadow-[4px_4px_0px_#1A1A1A] focus:shadow-[4px_4px_0px_#1A1A1A] focus:border-accent focus:outline-none focus:-translate-y-0.5',
        className,
      )}
      {...rest}
    />
  )
})
