import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { List } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Grid } from 'antd'
import { NotificationPopover } from './NotificationPopover'
import { UserMenuDropdown } from './UserMenuDropdown'
import { TopbarModals } from './TopbarModals'
import { ThemeToggle } from '../atoms/ThemeToggle'
import { useAppDispatch, useAppSelector } from '../../shared/store/hooks'
import { toggleDrawer } from '../../shared/store/uiSlice'

export function Topbar() {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const user = useAppSelector((s) => s.auth.user)
  const displayName = user?.name ?? 'Super Admin'

  const [changeOpen, setChangeOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)

  return (
    <header className="h-16 bg-[var(--color-topbar)] border-b border-[var(--color-border)] px-4 lg:px-6 flex items-center justify-between shrink-0 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {/* Hamburger — visible only below lg (tablet + mobile) */}
        {!screens.lg && (
          <button
            onClick={() => dispatch(toggleDrawer())}
            className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover-neutral)] bg-transparent border-none cursor-pointer shrink-0"
            aria-label="Open navigation"
          >
            <List size={20} />
          </button>
        )}

        {/* Welcome label — hidden on small viewports */}
        <span className="hidden sm:block text-sm font-semibold text-[var(--color-text)]">
          {t('topbar.welcomeBack', { name: displayName })}
        </span>
      </div>

      <div className="flex items-center gap-4 lg:gap-6">
        <ThemeToggle />
        <NotificationPopover
          open={bellOpen}
          onOpenChange={setBellOpen}
          onViewAll={() => {
            setBellOpen(false)
            navigate('/notifications')
          }}
        />
        <UserMenuDropdown onChangePassword={() => setChangeOpen(true)} />
      </div>

      <TopbarModals
        viewOpen={false}
        onViewClose={() => undefined}
        editOpen={false}
        onEditClose={() => undefined}
        changeOpen={changeOpen}
        onChangeClose={() => setChangeOpen(false)}
      />
    </header>
  )
}
