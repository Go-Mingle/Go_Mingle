import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import {
  Storefront,
  Wallet,
  UserGear,
  PlugsConnected,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  X,
} from '@phosphor-icons/react'
import { GoMingleLogo } from '../atoms/GoMingleLogo'
import { useAppSelector, useAppDispatch } from '../../shared/store/hooks'
import { toggleSidebar, closeDrawer } from '../../shared/store/uiSlice'
import { SidebarNavGroup } from './SidebarNavGroup'
import type { NavGroup } from './SidebarNavGroup'

interface SidebarProps {
  /** When true the sidebar renders as a full-width mobile overlay drawer (always expanded, shows a close button) */
  forDrawer?: boolean
}

export function Sidebar({ forDrawer = false }: SidebarProps) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed)

  // In drawer mode always show expanded layout; on desktop respect collapsed state
  const isIconOnly = !forDrawer && collapsed

  const mainGroup: NavGroup = {
    items: [
      {
        key: 'overview',
        label: t('nav.restaurantProfile'),
        Icon: Storefront,
        path: '/overview',
      },
      { key: 'finances', label: t('nav.finances'), Icon: Wallet, path: '/finances' },
      { key: 'users', label: t('nav.users'), Icon: UserGear, path: '/users' },
      {
        key: 'integrations',
        label: t('nav.integrations'),
        Icon: PlugsConnected,
        path: '/integrations',
      },
    ],
  }

  return (
    <aside
      className="flex flex-col h-full bg-[var(--color-sidebar)] border-r border-[var(--color-border)]"
      style={{
        width: forDrawer ? 280 : isIconOnly ? 64 : 240,
        transition: forDrawer ? 'none' : 'width 200ms ease-in-out',
      }}
    >
      {/* ── Logo / header row ── */}
      <div
        className={clsx(
          'h-16 flex items-center border-b border-[var(--color-border)] overflow-hidden shrink-0',
          isIconOnly ? 'justify-center px-0' : 'justify-between px-5',
        )}
      >
        <GoMingleLogo collapsed={isIconOnly} height={34} />

        {/* Close button — drawer mode only */}
        {forDrawer && (
          <button
            onClick={() => dispatch(closeDrawer())}
            className="w-8 h-8 rounded-[var(--radius-sm)] border-none bg-transparent flex items-center justify-center cursor-pointer text-[var(--color-text-subtle)] hover:bg-[var(--color-hover-neutral)]"
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto py-3">
        <SidebarNavGroup
          group={mainGroup}
          collapsed={isIconOnly}
          onNavItemClick={forDrawer ? () => dispatch(closeDrawer()) : undefined}
        />
      </nav>

      {/* ── Desktop collapse toggle — not shown in drawer mode ── */}
      {!forDrawer && (
        <div
          className={clsx(
            'h-14 border-t border-[var(--color-border)] flex items-center shrink-0',
            isIconOnly ? 'justify-center' : 'justify-end px-4',
          )}
        >
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="w-8 h-8 rounded-[var(--radius-sm)] border-none bg-transparent flex items-center justify-center cursor-pointer text-[var(--color-text-subtle)] hover:bg-[var(--color-hover-neutral)]"
            title={isIconOnly ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isIconOnly ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      )}
    </aside>
  )
}
