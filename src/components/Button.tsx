import type { ButtonHTMLAttributes } from 'react'
import { clsx } from '@/lib/clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  fullWidth?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-blood hover:bg-blood-dark text-paper disabled:bg-steel',
  secondary: 'bg-steel hover:bg-steel/80 text-paper disabled:opacity-50',
  ghost: 'bg-transparent hover:bg-white/10 text-paper disabled:opacity-50',
  danger: 'bg-red-900 hover:bg-red-800 text-paper disabled:opacity-50',
}

export function Button({ variant = 'primary', fullWidth, className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'min-h-11 rounded-lg px-4 py-2.5 font-medium tracking-wide transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
        variantClasses[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  )
}
