import * as React from 'react'
import { cn } from '../../lib/cn'

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[12px] border border-[var(--border)] bg-[var(--surface)]/90 shadow-[var(--shadow)] backdrop-blur',
        className,
      )}
      {...props}
    />
  )
}
