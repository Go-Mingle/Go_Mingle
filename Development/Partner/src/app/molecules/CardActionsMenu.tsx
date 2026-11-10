import { Dropdown, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import { clsx } from 'clsx'
import { DotsThreeVertical } from '@phosphor-icons/react'

export interface CardAction {
  key: string
  label: string
  icon?: React.ReactNode
  danger?: boolean
  onClick: () => void
}

interface CardActionsMenuProps {
  actions: CardAction[]
  /** Accessible label for the "more" trigger when 2+ actions collapse into a menu. */
  moreLabel?: string
  /** Solid pill trigger for placing over imagery (e.g. photo tiles). */
  overlay?: boolean
}

// Solid pill trigger for placing over imagery (no hover restyle).
const OVERLAY_BTN =
  'w-[30px] h-[30px] inline-flex items-center justify-center rounded-full shrink-0 cursor-pointer border-none ' +
  'text-[#1a2332] bg-[rgba(255,255,255,0.92)] shadow-[0_1px_4px_rgba(0,0,0,0.2)]'

// Plain icon trigger. Hover restyle applies at md+ only (touch has no hover).
const ICON_BTN =
  'w-8 h-8 inline-flex items-center justify-center rounded-lg shrink-0 cursor-pointer border-none bg-transparent ' +
  'text-[var(--color-text-muted)] transition-all duration-150 ease-out'
const ICON_HOVER_NEUTRAL =
  'md:hover:bg-[var(--color-hover-neutral)] md:hover:text-[var(--color-text)]'
const ICON_HOVER_DANGER = 'md:hover:bg-[var(--color-error-bg)] md:hover:text-[var(--color-error)]'

/**
 * Card action affordance used across the responsive (table→card) views.
 *
 * - A single action renders as one icon button, pinned to the far right.
 * - Two or more actions collapse into a "more" (⋮) menu whose dropdown lists
 *   every action as an item.
 *
 * Phosphor icons only.
 */
export function CardActionsMenu({
  actions,
  moreLabel = 'More actions',
  overlay = false,
}: CardActionsMenuProps) {
  const triggerClass = (danger = false) =>
    overlay ? OVERLAY_BTN : clsx(ICON_BTN, danger ? ICON_HOVER_DANGER : ICON_HOVER_NEUTRAL)

  if (actions.length === 0) return null

  if (actions.length === 1) {
    const a = actions[0]
    return (
      <Tooltip title={a.label} placement="top">
        <button
          type="button"
          aria-label={a.label}
          className={triggerClass(a.danger)}
          onClick={(e) => {
            e.stopPropagation()
            a.onClick()
          }}
        >
          {a.icon}
        </button>
      </Tooltip>
    )
  }

  const items: MenuProps['items'] = actions.map((a) => ({
    key: a.key,
    label: a.label,
    icon: a.icon,
    danger: a.danger,
    onClick: ({ domEvent }) => {
      domEvent.stopPropagation()
      a.onClick()
    },
  }))

  return (
    <Dropdown
      menu={{ items, className: 'card-actions-menu' }}
      trigger={['click']}
      placement="bottomRight"
    >
      <button
        type="button"
        aria-label={moreLabel}
        className={triggerClass()}
        onClick={(e) => e.stopPropagation()}
      >
        <DotsThreeVertical size={overlay ? 18 : 20} weight="bold" />
      </button>
    </Dropdown>
  )
}
