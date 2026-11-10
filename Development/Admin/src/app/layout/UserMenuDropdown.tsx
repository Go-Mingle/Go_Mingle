import { useState, type FC } from 'react'
import { Dropdown, Modal, Button } from 'antd'
import type { MenuProps } from 'antd'
import { User, Lock, SignOut, CaretDown } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAppSelector, useAppDispatch } from '../../shared/store/hooks'
import { logoutAction } from '../../shared/store/authSlice'
import { cognitoSignOut } from '../modules/auth/cognitoService'
import { ChangeNameModal } from './components/ChangeNameModal'
import { ChangePasswordModal } from './components/ChangePasswordModal'

interface Props {
  onChangePassword?: () => void
}

export const UserMenuDropdown: FC<Props> = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)
  const [viewProfileOpen, setViewProfileOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  const displayName = user?.name ?? 'Super Admin'
  const email = user?.email ?? ''

  // Handles user sign-out: revokes Cognito session then clears local auth state.
  // Must call cognitoSignOut first to invalidate token at Cognito side, then clear Redux state.
  // Errors during Cognito sign-out are suppressed (.catch) to ensure local logout always completes.
  const handleConfirmSignOut = async () => {
    setSignOutOpen(false)
    const token = localStorage.getItem('auth-token')
    if (token) {
      // Cognito GlobalSignOut invalidates session on all devices; network errors don't block local cleanup
      await cognitoSignOut(token).catch(() => {})
    }
    dispatch(logoutAction())
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
      label: <span style={{ color: 'var(--color-error)' }}>{t('topbar.signOut')}</span>,
    },
  ]

  const handleMenu: MenuProps['onClick'] = ({ key }) => {
    if (key === 'view-profile') setViewProfileOpen(true)
    if (key === 'change') setShowChangePassword(true)
    if (key === 'signout') setSignOutOpen(true)
  }

  return (
    <>
      <Dropdown
        menu={{ items: menuItems, onClick: handleMenu, className: 'app-profile-menu' }}
        trigger={['click']}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          <div
            className="hidden sm:flex"
            style={{
              flexDirection: 'column',
              alignItems: 'flex-end',
              lineHeight: 1.1,
              gap: 2,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text)',
              }}
            >
              {displayName}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: 'var(--color-text-muted)',
              }}
            >
              {email}
            </span>
          </div>
          <CaretDown size={14} color="var(--color-text-subtle)" />
        </div>
      </Dropdown>

      <ChangeNameModal open={viewProfileOpen} onClose={() => setViewProfileOpen(false)} />

      <ChangePasswordModal open={showChangePassword} onClose={() => setShowChangePassword(false)} />

      {/* Sign-out confirmation — canonical 420 / 36 / 12 modal pattern */}
      <Modal
        open={signOutOpen}
        onCancel={() => setSignOutOpen(false)}
        title={t('topbar.signOutTitle')}
        width={420}
        footer={null}
        closable
        destroyOnClose
      >
        <p
          style={{
            fontSize: 14,
            color: 'var(--color-text-muted)',
            fontFamily: 'Poppins, sans-serif',
            margin: '4px 0 0',
          }}
        >
          {t('topbar.signOutContent')}
        </p>
        <div className="app-modal-footer">
          <Button
            onClick={() => setSignOutOpen(false)}
            style={{
              height: 36,
              borderRadius: 12,
              fontFamily: 'Poppins, sans-serif',
              fontSize: 13,
            }}
          >
            {t('buttons.cancel')}
          </Button>
          <button
            onClick={handleConfirmSignOut}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 36,
              padding: '0 20px',
              background: 'var(--color-error)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontFamily: 'Poppins, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 150ms ease-out',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-error-dark)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-error)')}
          >
            <SignOut size={14} weight="regular" color="white" />
            {t('topbar.signOut')}
          </button>
        </div>
      </Modal>
    </>
  )
}
