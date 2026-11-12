import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import {
  ForkKnife,
  ClipboardText,
  PicnicTable,
  Users,
  Wallet,
  Tag,
  Sparkle,
  Star,
  EnvelopeSimple,
  // Scroll, // used by the commented-out Change Log nav item
  ShieldCheck,
  UserGear,
  Question,
  ChatCircleText,
  Heart,
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
  X,
} from '@phosphor-icons/react'
import { GoMingleLogo } from '../atoms/GoMingleLogo'
import { useAppSelector, useAppDispatch } from '../../shared/store/hooks'
import { toggleSidebar, closeDrawer } from '../../shared/store/uiSlice'
import { getRoleFromUser, hasAccess } from '../../shared/services/permissions'
import { moduleForKey } from './navAccess'
import { usePendingApprovalsCountQuery } from '../modules/approval-queue/hooks/useApprovalQueueQuery'
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
  const user = useAppSelector((s) => s.auth.user)
  const role = getRoleFromUser(user)

  // In drawer mode always show expanded layout; on desktop respect collapsed state
  const isIconOnly = !forDrawer && collapsed

  // Live pending-approvals count for the Approval Queue badge. Only fetch when
  // the user can actually see that nav item (mirrors the RBAC filter below).
  const approvalsModule = moduleForKey('approval-queue')
  const canSeeApprovals = approvalsModule ? hasAccess(role, approvalsModule) : true
  const { count: pendingApprovals } = usePendingApprovalsCountQuery(canSeeApprovals)

  // RBAC: keep only items whose required module the user can access.
  // An item with no mapped module is always shown.
  const filterByAccess = (group: NavGroup): NavGroup => ({
    ...group,
    items: group.items.filter((item) => {
      const module = moduleForKey(item.key)
      return module ? hasAccess(role, module) : true
    }),
  })

  const manageGroup: NavGroup = {
    label: 'MANAGE',
    items: [
      {
        key: 'restaurants',
        label: t('nav.restaurants'),
        Icon: ForkKnife,
        path: '/restaurants',
      },
      {
        key: 'approval-queue',
        label: t('nav.approvalQueue'),
        Icon: ClipboardText,
        path: '/approval-queue',
        badge: pendingApprovals || undefined,
      },
      {
        key: 'interest-tables',
        label: t('nav.interestTables'),
        Icon: PicnicTable,
        path: '/interest-tables',
      },
      {
        key: 'minglers',
        label: t('nav.minglers'),
        Icon: Users,
        path: '/minglers',
      },
      {
        key: 'finances',
        label: t('nav.finances'),
        Icon: Wallet,
        path: '/finances',
      },
      // Change Log nav item temporarily hidden.
      // {
      //   key: 'change-log',
      //   label: t('nav.changeLog'),
      //   Icon: Scroll,
      //   path: '/change-log',
      // },
    ],
  }

  const configureGroup: NavGroup = {
    label: 'CONFIGURE',
    // Items intentionally ordered alphabetically by label.
    items: [
      {
        key: 'amenities',
        label: t('nav.amenities'),
        Icon: Sparkle,
        path: '/amenities',
      },
      {
        key: 'categories',
        label: t('nav.categories'),
        Icon: Tag,
        path: '/categories',
      },
      {
        key: 'email-templates',
        label: t('nav.emailTemplates'),
        Icon: EnvelopeSimple,
        path: '/email-templates',
      },
      {
        key: 'loyalty',
        label: t('nav.loyalty'),
        Icon: Star,
        path: '/loyalty',
      },
      {
        key: 'preference-questions',
        label: t('nav.preferenceQuestions'),
        Icon: Question,
        path: '/preference-questions',
      },
      {
        key: 'roles-access',
        label: t('nav.rolesAccess'),
        Icon: ShieldCheck,
        path: '/roles-access',
      },
      {
        key: 'interests',
        label: t('nav.interests'),
        Icon: Heart,
        path: '/interests',
      },
      {
        key: 'interest-topics',
        label: t('nav.interestTopics'),
        Icon: ChatCircleText,
        path: '/interest-topics',
      },
      {
        key: 'users',
        label: t('nav.users'),
        Icon: UserGear,
        path: '/users',
      },
    ],
  }

  const visibleManageGroup = filterByAccess(manageGroup)
  const visibleConfigureGroup = filterByAccess(configureGroup)

  const sectionLabel = (label: string) =>
    !isIconOnly ? (
      <div
        style={{
          padding: '8px 16px 4px',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'var(--color-text-subtle)',
          userSelect: 'none',
        }}
      >
        {label}
      </div>
    ) : null

  const divider = (
    <hr
      style={{
        margin: '8px 12px',
        border: 'none',
        borderTop: '1px solid var(--color-divider)',
      }}
    />
  )

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
        {visibleManageGroup.items.length > 0 && (
          <>
            {sectionLabel(visibleManageGroup.label ?? '')}
            <SidebarNavGroup
              group={visibleManageGroup}
              collapsed={isIconOnly}
              onNavItemClick={forDrawer ? () => dispatch(closeDrawer()) : undefined}
            />
          </>
        )}
        {visibleManageGroup.items.length > 0 && visibleConfigureGroup.items.length > 0 && divider}
        {visibleConfigureGroup.items.length > 0 && (
          <>
            {sectionLabel(visibleConfigureGroup.label ?? '')}
            <SidebarNavGroup
              group={visibleConfigureGroup}
              collapsed={isIconOnly}
              onNavItemClick={forDrawer ? () => dispatch(closeDrawer()) : undefined}
            />
          </>
        )}
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
