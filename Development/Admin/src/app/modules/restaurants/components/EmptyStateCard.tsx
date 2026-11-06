import React from 'react'

interface EmptyStateCardProps {
  title: string
  IconComp: React.ElementType
  message: string
}

export function EmptyStateCard({ title, IconComp, message }: EmptyStateCardProps) {
  return (
    <div className="pt-5">
      <div
        style={{
          background: 'var(--color-card)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-sm)',
          padding: 24,
        }}
      >
        <h3
          style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}
        >
          {title}
        </h3>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '40px 0',
            gap: 8,
          }}
        >
          <IconComp size={32} color="var(--color-text-subtle)" />
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{message}</span>
        </div>
      </div>
    </div>
  )
}
