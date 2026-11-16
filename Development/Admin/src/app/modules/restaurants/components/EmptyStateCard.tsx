import React from 'react'
import { TablePlate } from '../../../visual/SeatMap'

interface EmptyStateCardProps {
  title: string
  IconComp: React.ElementType
  message: string
}

/** A titled card saying a section has nothing yet: the section's icon on an empty table. */
export function EmptyStateCard({ title, IconComp, message }: EmptyStateCardProps) {
  return (
    <div className="pt-5">
      <div className="bg-[var(--color-card)] rounded-[var(--radius-lg)] shadow-[var(--shadow-sm)] p-6">
        <h3 className="m-0 mb-4 text-[15px] font-semibold text-[var(--color-text)]">{title}</h3>
        <div className="flex flex-col items-center gap-3 py-8">
          <TablePlate size={92}>
            <IconComp size={24} />
          </TablePlate>
          <span className="text-[13px] text-[var(--color-text-muted)]">{message}</span>
        </div>
      </div>
    </div>
  )
}
