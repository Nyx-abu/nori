import * as React from 'react'
import { cn } from './cn'

type Tone = 'neutral' | 'accent' | 'success' | 'warning'

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone
}

const toneClass: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-text-primary border-border border-2 shadow-[2px_2px_0px_#1A1A1A]',
  accent: 'bg-accent-glow text-text-primary border-border border-2 shadow-[2px_2px_0px_#1A1A1A] font-bold',
  success: 'bg-[#86efac] text-text-primary border-border border-2 shadow-[2px_2px_0px_#1A1A1A]',
  warning: 'bg-accent-pink text-text-primary border-border border-2 shadow-[2px_2px_0px_#1A1A1A]',
}

export function Badge({ className, tone = 'neutral', children, ...rest }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-bold',
        toneClass[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  )
}
