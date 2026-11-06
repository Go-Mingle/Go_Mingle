import React from 'react'
import { Tooltip } from 'antd'

interface ActionBtnProps {
  tooltip: string
  onClick?: () => void
  hoverBg: string
  hoverColor: string
  disabled?: boolean
  children: React.ReactNode
}

export function ActionBtn({
  tooltip,
  onClick,
  hoverBg,
  hoverColor,
  disabled,
  children,
}: ActionBtnProps) {
  return (
    <Tooltip title={tooltip} placement="top">
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
          color: disabled ? 'var(--color-text-subtle)' : 'var(--color-text-muted)',
          flexShrink: 0,
        }}
        onMouseEnter={
          disabled
            ? undefined
            : (e) => {
                e.currentTarget.style.background = hoverBg
                e.currentTarget.style.color = hoverColor
              }
        }
        onMouseLeave={
          disabled
            ? undefined
            : (e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--color-text-muted)'
              }
        }
      >
        {children}
      </div>
    </Tooltip>
  )
}
