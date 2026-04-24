import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '../../lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[10px] border text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'border-[var(--accent-strong)] bg-[var(--accent)] px-4 py-2 text-white shadow-[0_12px_22px_rgba(18,87,82,0.18)] hover:bg-[var(--accent-strong)]',
        secondary:
          'border-[var(--border)] bg-white/80 px-4 py-2 text-[var(--ink)] hover:bg-[var(--surface)]',
        ghost:
          'border-transparent bg-transparent px-3 py-2 text-[var(--muted)] hover:bg-white/60 hover:text-[var(--ink)]',
      },
      size: {
        default: 'h-11',
        sm: 'h-9 px-3 text-xs',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
}
