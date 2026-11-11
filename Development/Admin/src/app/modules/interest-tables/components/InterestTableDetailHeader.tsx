import { useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Grid, Modal, message } from 'antd'
import {
  ArrowLeft,
  UploadSimple,
  PencilSimple,
  Broadcast,
  Crown,
  LinkSimple,
  XCircle,
  Trash,
} from '@phosphor-icons/react'
import { formatLongDate } from '../../../../shared/utils/dateHelpers'
import type { InterestTable } from '../types'
import { InterestTableStatusBadge } from './InterestTableStatusBadge'
import { AppButton } from '../../../atoms/AppButton'
import { MODAL_WIDTH } from '../../../atoms/modalWidth'
import { TableAvatar } from '../../../molecules/TableAvatar'

interface Props {
  table: InterestTable
  onPublish?: () => void
  onEdit?: () => void
  onMakeAvailable?: () => void
  onChangePromingler?: () => void
  onCancel?: () => void
  onDelete?: () => void
}

type ConfirmKind = 'cancel' | 'delete' | 'makeAvailable' | null

export function InterestTableDetailHeader({
  table,
  onPublish,
  onEdit,
  onMakeAvailable,
  onChangePromingler,
  onCancel,
  onDelete,
}: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  // Present only on the restaurant-scoped route /restaurants/:rid/interest-tables/:id.
  const { rid } = useParams<{ rid?: string }>()
  const { t } = useTranslation(['interest-tables', 'common'])
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [confirm, setConfirm] = useState<ConfirmKind>(null)

  const backLabel = (location.state as { backLabel?: string } | null)?.backLabel ?? t('detail.back')

  const handleCopyLink = () => {
    const url = `${window.location.origin}/m/interest-tables/${table.id}`
    void navigator.clipboard?.writeText(url)
    void message.success(t('detail.linkCopied'))
  }

  const isDraft = table.status === 'DRAFT'
  const isComingSoon = table.status === 'COMING_SOON'
  const isCancellable = ['PENDING', 'CONFIRMED', 'COMING_SOON'].includes(table.status)
  // Any table that has not happened yet can be edited.
  const isEditable = isCancellable || isDraft

  const thumb = (
    <TableAvatar
      name={table.name}
      imageUrl={table.coverImage ?? table.eventImageUrl}
      size={64}
      radius={12}
    />
  )

  const name = (
    <span
      style={{
        fontSize: 24,
        fontWeight: 700,
        color: 'var(--color-text)',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      {table.name}
    </span>
  )

  // `created` arrives as ISO from some endpoints and as 'DD-MM-YYYY HH:mm' from
  // others — parse both, and drop the line entirely rather than render
  // "Created Invalid Date" when the value is missing/unparseable (MET-1309).
  const createdOn = formatLongDate(table.created, '')

  const meta = createdOn ? (
    <p
      style={{
        fontSize: 13,
        color: 'var(--color-text-muted)',
        margin: 0,
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      {t('detail.createdOn', { date: createdOn })}
    </p>
  ) : null

  const actions = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {isDraft && onPublish && (
        <AppButton variant="primary" onClick={onPublish}>
          <UploadSimple size={14} weight="bold" /> {t('detail.publish')}
        </AppButton>
      )}
      {isEditable && onEdit && (
        <AppButton variant="neutral" onClick={onEdit}>
          <PencilSimple size={14} weight="regular" /> {t('actions.edit')}
        </AppButton>
      )}
      {isComingSoon && onMakeAvailable && (
        <AppButton variant="primary" onClick={() => setConfirm('makeAvailable')}>
          <Broadcast size={14} weight="regular" /> {t('actions.makeAvailable')}
        </AppButton>
      )}
      {table.promingler && onChangePromingler && (
        <AppButton variant="neutral" onClick={onChangePromingler}>
          <Crown size={14} weight="fill" color="#B06000" /> {t('promingler.changeAction')}
        </AppButton>
      )}
      <AppButton variant="neutral" onClick={handleCopyLink}>
        <LinkSimple size={14} weight="regular" /> {t('detail.copyLink')}
      </AppButton>
      {isCancellable && onCancel && (
        <AppButton variant="danger" onClick={() => setConfirm('cancel')}>
          <XCircle size={14} weight="regular" /> {t('detail.cancelTable.action')}
        </AppButton>
      )}
      {/* The API refuses to delete a table that has bookings; cancel it instead. */}
      {onDelete && (
        <AppButton variant="danger" onClick={() => setConfirm('delete')}>
          <Trash size={14} weight="regular" /> {t('detail.deleteTable.action')}
        </AppButton>
      )}
    </div>
  )

  const confirmConfig: Record<
    Exclude<ConfirmKind, null>,
    { title: string; desc: string; ok: string; danger: boolean; run?: () => void }
  > = {
    cancel: {
      title: t('detail.cancelTable.title'),
      desc: t('detail.cancelTable.desc'),
      ok: t('detail.cancelTable.ok'),
      danger: true,
      run: onCancel,
    },
    delete: {
      title: t('detail.deleteTable.title'),
      desc: t('detail.deleteTable.desc'),
      ok: t('detail.deleteTable.ok'),
      danger: true,
      run: onDelete,
    },
    makeAvailable: {
      title: t('detail.makeAvailable.title'),
      desc: t('detail.makeAvailable.desc'),
      ok: t('detail.makeAvailable.ok'),
      danger: false,
      run: onMakeAvailable,
    },
  }

  const active = confirm ? confirmConfig[confirm] : null

  return (
    <>
      <button
        onClick={() => {
          if (location.state && (location.state as { backLabel?: string }).backLabel) {
            navigate(-1)
            return
          }
          // `:rid` is only in the URL when the user arrived from a restaurant's
          // Interest Tables tab — send them back there. Reached from the global
          // master list (/interest-tables/:id) there is no `:rid`, so go back to
          // that list instead of dropping the user into a restaurant they never
          // visited. Route-derived rather than history-based, so it survives a
          // refresh or a shared link.
          navigate(rid ? `/restaurants/${rid}?tab=interest-tables` : '/interest-tables')
        }}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-accent)] bg-transparent border-none cursor-pointer mb-6 p-0"
      >
        <ArrowLeft size={15} /> {backLabel}
      </button>

      {isMobile ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 24,
            paddingBottom: 24,
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {thumb}
            {name}
          </div>
          <InterestTableStatusBadge status={table.status} />
          {meta}
          {actions}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-5 mb-6 pb-6 border-b border-[var(--color-border)]">
          <div className="flex items-start gap-5">
            {thumb}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginBottom: 6,
                }}
              >
                {name}
                <InterestTableStatusBadge status={table.status} />
              </div>
              {meta}
            </div>
          </div>
          {actions}
        </div>
      )}

      <Modal
        open={!!active}
        onCancel={() => setConfirm(null)}
        closable={false}
        footer={null}
        width={MODAL_WIDTH.confirm}
        title={null}
        destroyOnClose
      >
        {active && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 8,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: active.danger ? 'var(--color-error-bg)' : 'var(--color-accent-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              {active.danger ? (
                <XCircle size={24} color="var(--color-error)" weight="fill" />
              ) : (
                <Broadcast size={24} color="var(--color-accent)" weight="fill" />
              )}
            </div>
            <p
              style={{
                margin: '0 0 8px',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--color-text)',
                textAlign: 'center',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {active.title}
            </p>
            <p
              style={{
                margin: '0 0 24px',
                fontSize: 13,
                color: 'var(--color-text-muted)',
                textAlign: 'center',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {active.desc}
            </p>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <AppButton variant="neutral" fillContainer onClick={() => setConfirm(null)}>
                {t('detail.cancelTable.keep')}
              </AppButton>
              <AppButton
                variant={active.danger ? 'danger' : 'primary'}
                fillContainer
                onClick={() => {
                  active.run?.()
                  setConfirm(null)
                }}
              >
                {active.ok}
              </AppButton>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
