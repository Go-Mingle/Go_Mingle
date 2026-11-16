import { useState } from 'react'
import { Button, Popconfirm, Table, Tag, message as antMessage } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PaperPlaneTilt, Plus, Trash } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import { formatWhen } from '../../email-templates/formatWhen'
import { AddRestaurantModal } from './AddRestaurantModal'
import {
  useCancelInviteMutation,
  useInvitedRestaurantsQuery,
  useResendInviteMutation,
} from './hooks'
import type { InvitedRestaurant } from './types'

/** The "Add restaurant" button with its form. */
export function AddRestaurantButton() {
  const { t } = useTranslation('restaurants')
  const [message, contextHolder] = antMessage.useMessage()
  const [adding, setAdding] = useState(false)
  return (
    <>
      {contextHolder}
      <Button
        type="primary"
        icon={<Plus size={16} weight="bold" />}
        onClick={() => setAdding(true)}
      >
        {t('access.add.button')}
      </Button>
      <AddRestaurantModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(created) => {
          setAdding(false)
          if (created.emailed) {
            void message.success(
              t('access.add.created', { name: created.name, email: created.ownerEmail }),
            )
          } else {
            void message.warning(t('access.add.createdNoEmail', { name: created.name }))
          }
        }}
      />
    </>
  )
}

/**
 * Profiles GoMingle created that are still with their owners. A profile leaves
 * this list when the owner sends it for approval. Renders nothing when there
 * are none.
 */
export function InvitedRestaurants() {
  const { t } = useTranslation('restaurants')
  const [message, contextHolder] = antMessage.useMessage()
  const { data: invited = [], isError } = useInvitedRestaurantsQuery()
  const resend = useResendInviteMutation()
  const cancel = useCancelInviteMutation()

  const columns: ColumnsType<InvitedRestaurant> = [
    { title: t('access.invited.restaurant'), dataIndex: 'name', key: 'name' },
    {
      title: t('access.invited.owner'),
      key: 'owner',
      render: (_, r) => (
        <span>
          {r.ownerName}
          <br />
          <span className="text-[12px] text-[var(--color-text-muted)]">{r.ownerEmail}</span>
        </span>
      ),
    },
    {
      title: t('access.invited.created'),
      key: 'invitedAt',
      render: (_, r) => (
        <span>
          {formatWhen(r.invitedAt)}
          <br />
          <span className="text-[12px] text-[var(--color-text-muted)]">{r.invitedBy}</span>
        </span>
      ),
    },
    {
      title: t('access.invited.progress'),
      key: 'progress',
      render: (_, r) =>
        r.ownerSignedIn ? (
          <Tag color="processing">{t('access.invited.completing')}</Tag>
        ) : (
          <Tag>{t('access.invited.notSignedIn')}</Tag>
        ),
    },
    {
      key: 'actions',
      align: 'right',
      render: (_, r) => (
        <span className="inline-flex gap-2">
          <Button
            size="small"
            icon={<PaperPlaneTilt size={14} />}
            loading={resend.isPending && resend.variables === r.id}
            onClick={() =>
              resend.mutate(r.id, {
                onSuccess: (res) =>
                  void (res.emailed
                    ? message.success(t('access.invited.resent', { email: r.ownerEmail }))
                    : message.warning(t('access.notEmailed'))),
                onError: (e) => void message.error(getApiErrorMessage(e, t('access.failed'))),
              })
            }
          >
            {t('access.invited.resend')}
          </Button>
          <Popconfirm
            title={t('access.invited.cancelTitle', { name: r.name })}
            description={t('access.invited.cancelBody')}
            okText={t('access.invited.cancelConfirm')}
            cancelText={t('access.keep')}
            okButtonProps={{ danger: true }}
            onConfirm={() =>
              cancel.mutate(r.id, {
                onSuccess: () =>
                  void message.success(t('access.invited.cancelled', { name: r.name })),
                onError: (e) => void message.error(getApiErrorMessage(e, t('access.failed'))),
              })
            }
          >
            <Button
              size="small"
              danger
              icon={<Trash size={14} />}
              aria-label={t('access.invited.cancel', { name: r.name })}
            />
          </Popconfirm>
        </span>
      ),
    },
  ]

  if (isError) {
    return (
      <p className="text-[13px] text-[var(--color-text-muted)] mb-4">
        {t('access.invited.loadFailed')}
      </p>
    )
  }
  // The toast holder keeps its place so "cancelled" still shows after the last row goes.
  return (
    <>
      {contextHolder}
      {invited.length > 0 && (
        <section
          aria-label={t('access.invited.title')}
          className="bg-[var(--color-card)] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-sm)] mb-6"
        >
          <h2 className="text-sm font-semibold text-[var(--color-text)] mt-0 mb-1">
            {t('access.invited.title')}
          </h2>
          <p className="text-[13px] text-[var(--color-text-muted)] mt-0 mb-3">
            {t('access.invited.hint')}
          </p>
          <Table<InvitedRestaurant>
            dataSource={invited}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
          />
        </section>
      )}
    </>
  )
}
