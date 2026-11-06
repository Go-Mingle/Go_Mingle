import type { Icon } from '@phosphor-icons/react'
import { NavLink } from 'react-router-dom'
import { Tooltip } from 'antd'
import { clsx } from 'clsx'

export interface NavItem {
  key: string
  label: string
  /** Phosphor icon component — rendered with weight="fill" when active, "regular" otherwise */
  Icon: Icon
  iconSize?: number
  path: string
  badge?: number
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

interface Props {
  group: NavGroup
  collapsed: boolean
  /** Called when a nav item is clicked — used in drawer mode to close the drawer */
  onNavItemClick?: () => void
}

export function SidebarNavGroup({ group, collapsed, onNavItemClick }: Props) {
  return (
    <div className="mb-1">
      {group.items.map((item) => (
        <Tooltip
          key={item.key}
          title={collapsed ? item.label : undefined}
          placement="right"
          mouseEnterDelay={0.1}
        >
          <NavLink
            to={item.path}
            onClick={onNavItemClick}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-2.5 h-10 mx-2 my-px rounded-[var(--radius-sm)] no-underline transition-[var(--transition-fast)] text-[14px] relative',
                collapsed ? 'justify-center px-0' : 'justify-start px-3',
                isActive
                  ? 'bg-[var(--color-accent-light)] text-[var(--color-accent-dark)] font-semibold'
                  : 'text-[var(--color-text-secondary)] font-medium hover:bg-[var(--color-hover-neutral)] hover:text-[var(--color-text)]',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={clsx(
                    'shrink-0 flex items-center',
                    isActive
                      ? 'text-[var(--color-accent)]'
                      : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]',
                  )}
                >
                  <item.Icon size={item.iconSize ?? 17} weight={isActive ? 'fill' : 'regular'} />
                </span>
                {!collapsed && (
                  <span
                    className={clsx(
                      'flex-1 overflow-hidden text-ellipsis whitespace-nowrap',
                      isActive
                        ? 'text-[var(--color-accent-dark)]'
                        : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text)]',
                    )}
                  >
                    {item.label}
                  </span>
                )}
                {!collapsed && item.badge != null && item.badge > 0 && (
                  <span className="h-[18px] min-w-[22px] bg-[var(--color-coral)] text-white rounded-[100px] text-[11px] font-semibold inline-flex items-center justify-center px-[5px]">
                    {item.badge}
                  </span>
                )}
                {collapsed && item.badge != null && item.badge > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full bg-[var(--color-coral)]" />
                )}
              </>
            )}
          </NavLink>
        </Tooltip>
      ))}
    </div>
  )
}
