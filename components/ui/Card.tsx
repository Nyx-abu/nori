import * as React from 'react'
import { cn } from './cn'

export function Card({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border-2 border-border bg-surface shadow-[4px_4px_0px_#1A1A1A] font-bold',
        'transition-all duration-fast ease-enter hover:-translate-y-1 hover:shadow-[6px_6px_0px_#1A1A1A]',
        className,
      )}
      {...rest}
    />
  )
}
