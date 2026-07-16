import * as React from 'react'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

const variantClass: Record<Variant, string> = {
  primary:
    'bg-accent text-surface border-2 border-border shadow-[4px_4px_0px_#1A1A1A] hover:bg-accent-glow hover:text-text-primary hover:-translate-y-1 hover:shadow-[6px_6px_0px_#1A1A1A] active:translate-y-0 active:shadow-[2px_2px_0px_#1A1A1A] disabled:bg-surface-2 disabled:text-text-muted disabled:shadow-none disabled:border-text-muted disabled:translate-y-0',
  secondary:
    'bg-surface-2 text-text-primary border-2 border-border shadow-[4px_4px_0px_#1A1A1A] hover:bg-surface hover:-translate-y-1 hover:shadow-[6px_6px_0px_#1A1A1A] active:translate-y-0 active:shadow-[2px_2px_0px_#1A1A1A]',
  ghost:
    'bg-transparent text-text-secondary border-2 border-transparent hover:text-text-primary hover:bg-surface-2 hover:border-border hover:shadow-[4px_4px_0px_#1A1A1A] hover:-translate-y-1 active:translate-y-0 active:shadow-[2px_2px_0px_#1A1A1A]',
}

const sizeClass: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-md',
  md: 'h-11 px-4 text-sm rounded-md min-w-[44px]',
  lg: 'h-12 px-5 text-base rounded-lg min-w-[44px]',
}

export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-extrabold',
        'transition-all duration-fast ease-enter',
        'disabled:cursor-not-allowed',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    />
  )
})
