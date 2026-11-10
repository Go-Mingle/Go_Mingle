import { Tooltip } from 'antd'

interface RoleActionButtonProps {
  tooltip: string
  hoverBg: string
  hoverColor: string
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void
  children: React.ReactNode
}

export function RoleActionButton({
  tooltip,
  hoverBg,
  hoverColor,
  onClick,
  children,
}: RoleActionButtonProps) {
  return (
    <Tooltip title={tooltip} placement="top">
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
    </Tooltip>
  )
}
