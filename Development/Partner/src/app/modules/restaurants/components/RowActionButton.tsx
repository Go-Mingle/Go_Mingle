import type { CSSProperties } from 'react'
import { Tooltip } from 'antd'

interface RowActionButtonProps {
  tooltip: string
  hoverBg: string
  hoverColor: string
  onClick: () => void
  children: React.ReactNode
}

/** Small hover icon button used for table row actions (edit / delete / hide). */
export function RowActionButton({
  tooltip,
  hoverBg,
  hoverColor,
  onClick,
  children,
}: RowActionButtonProps) {
  return (
    <Tooltip title={tooltip} placement="top">
      <div
        // The tooltip is the only thing naming this control, and it exists in the
        // DOM only while hovered — so the icon had no accessible name at all.
        // Mirroring it here costs nothing visually and gives every caller one.
        aria-label={tooltip}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        style={{ '--hover-bg': hoverBg, '--hover-color': hoverColor } as CSSProperties}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-all duration-150 ease-out hover:bg-[var(--hover-bg)] hover:text-[var(--hover-color)]"
      >
        {children}
      </div>
    </Tooltip>
  )
}
