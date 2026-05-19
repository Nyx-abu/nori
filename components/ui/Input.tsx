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
        'h-11 w-full rounded-md border border-border bg-surface px-3 text-base',
        'text-text-primary placeholder:text-text-muted',
        'transition-colors duration-base ease-enter',
        'hover:border-border-hover focus:border-accent focus:outline-none',
        className,
      )}
      {...rest}
    />
  )
})
