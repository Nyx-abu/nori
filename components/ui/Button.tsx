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
    'bg-accent text-white hover:bg-[#7679ff] active:bg-[#5558e0] disabled:bg-[#2a2c66] disabled:text-[#9ea0d8]',
  secondary:
    'bg-surface-2 text-text-primary border border-border hover:border-border-hover',
  ghost:
    'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-2',
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
        'inline-flex items-center justify-center gap-2 font-medium',
        'transition-colors duration-base ease-enter',
        'disabled:cursor-not-allowed',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    />
  )
})
