import { useState } from 'react'
import { Dropdown, Modal } from 'antd'
import type { MenuProps } from 'antd'
import { User, Lock, SignOut, CaretDown } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useAppSelector, useAppDispatch } from '../../shared/store/hooks'
import { logoutAction } from '../../shared/store/authSlice'
import { getAuthProvider } from '../../shared/auth/authProvider'
import { clearSentryUser } from '../../shared/observability/sentry'
import { setSessionRestaurantId } from '../modules/session/restaurantIdCache'
import { ChangeNameModal } from './components/ChangeNameModal'
import { AppButton } from '../atoms/AppButton'

interface Props {
  onChangePassword: () => void
}

export function UserMenuDropdown({ onChangePassword }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const user = useAppSelector((s) => s.auth.user)
  const [viewProfileOpen, setViewProfileOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)

  const displayName = user?.name ?? 'Super Admin'
  const email = user?.email ?? ''

  const handleConfirmSignOut = () => {
    setSignOutOpen(false)
    // Revokes the Cognito session and clears the stored tokens. Failures are
    // swallowed by the provider, so the user always reaches the login screen.
    getAuthProvider()
      .signOut()
      .catch(() => undefined)
    setSessionRestaurantId(null)
    // Same reason the query cache is cleared below: the context belongs to the
    // account that just left.
    clearSentryUser()
    dispatch(logoutAction())
    /**
     * MET-1305 — the cache belongs to the account that just left, so it dies
     * with the session, exactly as in SessionWatcher's teardown.
     *
     * Without this, the next sign-in remounts SessionBoundary onto a still-fresh
     * `['partner','session']` entry (5-minute staleTime) and no request is made
     * at all: restaurant A stays on screen under restaurant B's token until the
     * tab is reloaded. No query key in this app is restaurant-scoped — they rely
     * on the bearer token to scope the response server-side — so every other
     * cached list (Users, Finances, Reviews, Interest Tables) would likewise be
     * readable by the incoming account.
     *
     * Safe to run here: both providers clear the token store synchronously
     * before their first `await`, so a refetch this triggers has no token.
     */
    queryClient.clear()
    navigate('/login')
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'view-profile',
      icon: <User size={16} weight="regular" color="var(--color-text-muted)" />,
      label: t('topbar.viewProfile'),
    },
    {
      key: 'change',
      icon: <Lock size={16} color="var(--color-text-muted)" />,
      label: t('topbar.changePassword'),
    },
    {
      key: 'signout',
      icon: <SignOut size={16} color="var(--color-error)" />,
      label: <span className="text-[var(--color-error)]">{t('topbar.signOut')}</span>,
    },
  ]

  const handleMenu: MenuProps['onClick'] = ({ key }) => {
    if (key === 'view-profile') setViewProfileOpen(true)
    if (key === 'change') onChangePassword()
    if (key === 'signout') setSignOutOpen(true)
  }

  return (
    <>
      <Dropdown
        menu={{ items: menuItems, onClick: handleMenu, className: 'app-profile-menu' }}
        trigger={['click']}
      >
        <div className="flex items-center gap-2 cursor-pointer">
          <div className="hidden sm:flex flex-col items-end leading-[1.1] gap-0.5">
            <span className="text-[13px] font-semibold text-[var(--color-text)]">
              {displayName}
            </span>
            <span className="text-[11px] font-normal text-[var(--color-text-muted)]">{email}</span>
          </div>
          <CaretDown size={14} color="var(--color-text-subtle)" />
        </div>
      </Dropdown>

      <ChangeNameModal open={viewProfileOpen} onClose={() => setViewProfileOpen(false)} />

      {/* Sign-out confirmation — canonical 420 / 36 / 12 modal pattern */}
      <Modal
        open={signOutOpen}
        onCancel={() => setSignOutOpen(false)}
        title={t('topbar.signOutTitle')}
        width={420}
        footer={null}
        closable
        destroyOnHidden
      >
        <p className="m-0 mt-1 text-[14px] text-[var(--color-text-muted)] font-[Poppins,sans-serif]">
          {t('topbar.signOutContent')}
        </p>
        <div className="app-modal-footer">
          <AppButton variant="neutral" onClick={() => setSignOutOpen(false)}>
            {t('buttons.cancel')}
          </AppButton>
          <AppButton variant="danger" onClick={handleConfirmSignOut}>
            <SignOut size={14} weight="regular" />
            {t('topbar.signOut')}
          </AppButton>
        </div>
      </Modal>
    </>
  )
}
