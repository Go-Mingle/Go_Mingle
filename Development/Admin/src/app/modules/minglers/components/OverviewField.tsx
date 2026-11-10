import React from 'react'

interface OverviewFieldProps {
  IconComp: React.ElementType
  label: string
  children: React.ReactNode
}

export function OverviewField({ IconComp, label, children }: OverviewFieldProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0' }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 12,
          background: 'var(--color-page)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IconComp size={16} color="var(--color-text-muted)" weight="regular" />
      </div>
      <div>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.06em',
            color: 'var(--color-text-muted)',
          }}
        >
          {label}
        </p>
        <div style={{ marginTop: 2 }}>{children}</div>
      </div>
    </div>
  )
}
