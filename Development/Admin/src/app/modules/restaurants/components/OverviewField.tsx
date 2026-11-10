import React from 'react'
import type { Icon } from '@phosphor-icons/react'

interface OverviewFieldProps {
  IconComp: Icon
  label: string
  value: React.ReactNode
}

export function OverviewField({ IconComp, label, value }: OverviewFieldProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0' }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 12,
          background: 'var(--color-table-head)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IconComp size={16} color="var(--color-text-muted)" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-text-muted)',
          }}
        >
          {label}
        </span>
        <div style={{ fontSize: 14, color: 'var(--color-text)', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  )
}
