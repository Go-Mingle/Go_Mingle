import React from 'react'
import type { Icon } from '@phosphor-icons/react'

interface OverviewFieldProps {
  IconComp: Icon
  label: string
  value: React.ReactNode
}

export function OverviewField({ IconComp, label, value }: OverviewFieldProps) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-divider)]">
        <IconComp size={16} color="var(--color-text-muted)" />
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
          {label}
        </span>
        <div className="mt-0.5 text-sm text-[var(--color-text)]">{value}</div>
      </div>
    </div>
  )
}
