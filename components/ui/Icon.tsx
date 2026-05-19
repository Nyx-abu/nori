// Phase 4 decision: inline SVG icon factory — no icon library. `path` is an SVG d-string (the schema stores category icons this way too).
import * as React from 'react'
import { cn } from './cn'

type Props = {
  path: string
  size?: number
  className?: string
  strokeWidth?: number
}

export function Icon({ path, size = 20, className, strokeWidth = 1.6 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className)}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  )
}
