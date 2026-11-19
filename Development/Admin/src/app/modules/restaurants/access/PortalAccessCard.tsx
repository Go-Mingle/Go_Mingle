import { useState } from 'react'
import { Alert, Button, Checkbox, Form, Input, Modal, Tag, message as antMessage } from 'antd'
import { PencilSimple, Trash, UserPlus } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import { EditLoginModal } from './EditLoginModal'
import {
  useGrantAccessMutation,
  usePortalLoginsQuery,
  useRemoveLoginMutation,
  useUpdateLoginMutation,
} from './hooks'
import type { GrantAccessPayload, PortalLogin, UpdateLoginPayload } from './types'

interface Props {
  restaurantId: string
  restaurantName: string
}

function SignInMethod({ login }: Readonly<{ login: PortalLogin }>) {
  const { t } = useTranslation('restaurants')
  if (login.pending) return <Tag>{t('access.logins.pending')}</Tag>
  return (
    <span className="inline-flex gap-1">
      {login.hasPassword && <Tag>{t('access.logins.password')}</Tag>}
      {login.hasGoogle && <Tag color="blue">Google</Tag>}
    </span>
  )
}

/**
 * Who can sign in to this restaurant on the Partner Portal. GoMingle gives an
 * email access, edits a login, makes someone an owner (a restaurant can have
 * several) or takes access away. This is how support hands a restaurant to a
 * new owner when the old one is locked out. The API refuses any change that
 * would leave no active owner.
 */
export function PortalAccessCard({ restaurantId, restaurantName }: Readonly<Props>) {
  const { t } = useTranslation('restaurants')
  const [message, contextHolder] = antMessage.useMessage()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<GrantAccessPayload>()
  const { data: logins = [], isLoading, isError } = usePortalLoginsQuery(restaurantId)
  const grant = useGrantAccessMutation(restaurantId)
  const update = useUpdateLoginMutation(restaurantId)
  const remove = useRemoveLoginMutation(restaurantId)
  const [editing, setEditing] = useState<PortalLogin | null>(null)
  const [removing, setRemoving] = useState<PortalLogin | null>(null)

  const closeEdit = () => {
    update.reset()
    setEditing(null)
  }
  const save = (changes: UpdateLoginPayload) => {
    if (!editing) return
    update.mutate(
      { loginId: editing.id, data: changes },
      {
        onSuccess: (res) => {
          closeEdit()
          void message.success(
            res.emailed
              ? t('access.edit.savedEmailed', { email: res.login.email })
              : t('access.edit.saved', { name: res.login.fullName }),
          )
        },
      },
    )
  }
  const closeRemove = () => {
    remove.reset()
    setRemoving(null)
  }
  const confirmRemove = () => {
    if (!removing) return
    remove.mutate(removing.id, {
      onSuccess: () => {
        void message.success(t('access.remove.done', { email: removing.email }))
        closeRemove()
      },
    })
  }

  const close = () => {
    form.resetFields()
    grant.reset()
    setOpen(false)
  }

  const submit = async () => {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    grant.mutate(
      {
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        ...(values.isOwner ? { isOwner: true } : {}),
      },
      {
        onSuccess: (res) => {
          close()
          if (!res.emailed) void message.warning(t('access.notEmailed'))
          else if (res.moved) {
            void message.success(
              t('access.grant.moved', { email: res.login.email, name: restaurantName }),
            )
          } else void message.success(t('access.grant.granted', { email: res.login.email }))
        },
      },
    )
  }

  const error = grant.error ? getApiErrorMessage(grant.error, t('access.failed')) : ''

  return (
    <div className="bg-[var(--color-card)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)] mb-4">
      {contextHolder}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)] m-0">
            {t('access.logins.title')}
          </h3>
          <p className="text-[13px] text-[var(--color-text-muted)] mt-1 mb-0">
            {t('access.logins.hint')}
          </p>
        </div>
        <Button icon={<UserPlus size={16} />} onClick={() => setOpen(true)}>
          {t('access.grant.button')}
        </Button>
      </div>

      {isLoading && (
        <p className="text-[13px] text-[var(--color-text-muted)] m-0">
          {t('access.logins.loading')}
        </p>
      )}
      {isError && (
        <p className="text-[13px] text-[var(--color-text-muted)] m-0">
          {t('access.logins.loadFailed')}
        </p>
      )}
      {!isLoading && !isError && logins.length === 0 && (
        <Alert type="warning" showIcon title={t('access.logins.none')} />
      )}

      {logins.length > 0 && (
        <ul className="list-none m-0 p-0 divide-y divide-[var(--color-border)]">
          {logins.map((login) => (
            <li key={login.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="min-w-0">
                <span className="text-[13px] font-medium text-[var(--color-text)]">
                  {login.fullName}
                </span>
                {login.designation && (
                  <span className="text-[12px] text-[var(--color-text-muted)]">
                    {' '}
                    · {login.designation}
                  </span>
                )}
                <br />
                <span className="text-[13px] text-[var(--color-text-muted)] break-all">
                  {login.email}
                </span>
              </span>
              <span className="inline-flex flex-wrap items-center gap-1">
                <Tag color={login.isOwner ? 'gold' : undefined}>
                  {login.isOwner ? t('access.logins.owner') : t('access.logins.team')}
                </Tag>
                {login.status === 'SUSPENDED' && (
                  <Tag color="error">{t('access.logins.suspended')}</Tag>
                )}
                <SignInMethod login={login} />
                <Button
                  type="text"
                  size="small"
                  icon={<PencilSimple size={15} />}
                  aria-label={t('access.edit.button', { name: login.fullName })}
                  onClick={() => setEditing(login)}
                />
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<Trash size={15} />}
                  aria-label={t('access.remove.button', { name: login.fullName })}
                  onClick={() => setRemoving(login)}
                />
              </span>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        title={t('access.grant.title', { name: restaurantName })}
        okText={t('access.grant.submit')}
        cancelText={t('access.cancel')}
        confirmLoading={grant.isPending}
        onOk={() => void submit()}
        onCancel={close}
        destroyOnHidden
      >
        <p className="text-[13px] text-[var(--color-text-muted)] mt-0 mb-4">
          {t('access.grant.intro')}
        </p>
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="fullName"
            label={t('access.grant.fullName')}
            rules={[
              {
                required: true,
                whitespace: true,
                min: 2,
                message: t('access.grant.fullNameRequired'),
              },
            ]}
          >
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item
            name="email"
            label={t('access.grant.email')}
            rules={[{ required: true, type: 'email', message: t('access.emailInvalid') }]}
          >
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="isOwner" valuePropName="checked" className="mb-2!">
            <Checkbox>{t('access.grant.makeOwner')}</Checkbox>
          </Form.Item>
        </Form>
        {error && <Alert type="error" showIcon title={error} />}
      </Modal>

      <EditLoginModal
        login={editing}
        saving={update.isPending}
        error={update.error}
        onSave={save}
        onCancel={closeEdit}
      />

      <Modal
        open={Boolean(removing)}
        title={t('access.remove.title', { name: removing?.fullName ?? '' })}
        okText={t('access.remove.confirm')}
        okButtonProps={{ danger: true }}
        cancelText={t('access.cancel')}
        confirmLoading={remove.isPending}
        onOk={confirmRemove}
        onCancel={closeRemove}
        destroyOnHidden
      >
        <p className="text-[13px] text-[var(--color-text-secondary)] mt-0">
          {t('access.remove.body', { email: removing?.email ?? '' })}
        </p>
        {remove.error && (
          <Alert
            type="error"
            showIcon
            title={getApiErrorMessage(remove.error, t('access.failed'))}
          />
        )}
      </Modal>
    </div>
  )
}
