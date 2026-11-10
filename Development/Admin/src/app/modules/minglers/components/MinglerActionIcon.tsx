import React from 'react'

interface ActionIconProps {
  children: React.ReactNode
  hoverBg: string
  hoverColor: string
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  disabled?: boolean
}

export function ActionIcon({ children, hoverBg, hoverColor, onClick, disabled }: ActionIconProps) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 150ms ease-out',
        color: 'var(--color-text-muted)',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.background = hoverBg
        e.currentTarget.style.color = hoverColor
      }}
      onMouseLeave={(e) => {
        if (disabled) return
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--color-text-muted)'
      }}
    >
      {children}
    </div>
  )
}
