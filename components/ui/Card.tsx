import * as React from 'react'
import { cn } from './cn'

export function Card({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface',
        'transition-colors duration-base ease-enter',
        className,
      )}
      {...rest}
    />
  )
}
