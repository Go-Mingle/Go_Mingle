import React from 'react'

interface ActionIconProps {
  children: React.ReactNode
  hoverBg: string
  hoverColor: string
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}

export function ActionIcon({ children, hoverBg, hoverColor, onClick }: ActionIconProps) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'all 150ms ease-out',
        color: 'var(--color-text-muted)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBg
        e.currentTarget.style.color = hoverColor
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--color-text-muted)'
      }}
    >
      {children}
    </div>
  )
}
