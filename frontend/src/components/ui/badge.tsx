import * as React from 'react'
import { cn } from '../../lib/cn'

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-[var(--border)] bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]',
        className,
      )}
      {...props}
    />
  )
}
