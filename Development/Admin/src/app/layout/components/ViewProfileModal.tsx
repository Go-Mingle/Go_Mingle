import { Modal, Avatar, Divider } from 'antd'
import { useTranslation } from 'react-i18next'
import { SecondaryActionButton } from '../../atoms/ModalActions'

interface ViewProfileModalProps {
  open: boolean
  onClose: () => void
  initials: string
  userName: string | undefined
  userRole: string | undefined
  userEmail: string | undefined
}

export function ViewProfileModal({
  open,
  onClose,
  initials,
  userName,
  userRole,
  userEmail,
}: ViewProfileModalProps) {
  const { t } = useTranslation(['profile', 'common'])
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('myProfile')}
      width={480}
      destroyOnClose
      footer={null}
    >
      <div className="text-center py-2 pb-4">
        <Avatar
          size={64}
          style={{
            backgroundColor: 'var(--color-accent)',
            color: '#fff',
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          {initials}
        </Avatar>
        <p className="text-[18px] font-bold text-[var(--color-text)] mt-3 mb-0">
          {userName ?? '—'}
        </p>
        <p className="text-[13px] text-[var(--color-text-muted)] mt-1 mb-0">{userRole ?? '—'}</p>
      </div>
      <Divider style={{ margin: '20px 0' }} />
      {[
        { label: t('email'), value: userEmail ?? '—' },
        { label: t('fullName'), value: userName ?? '—' },
      ].map(({ label, value }, idx, arr) => (
        <div
          key={label}
          className="flex justify-between py-[10px]"
          style={{
            borderBottom: idx < arr.length - 1 ? '1px solid var(--color-divider)' : 'none',
          }}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
            {label}
          </span>
          <span className="text-[13px] text-[var(--color-text-secondary)]">{value}</span>
        </div>
      ))}
      <div className="app-modal-footer">
        <SecondaryActionButton onClick={onClose}>{t('common:buttons.close')}</SecondaryActionButton>
      </div>
    </Modal>
  )
}
