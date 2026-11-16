import { useState } from 'react'
import { Alert, Button, Form, Input, Modal, Tag, message as antMessage } from 'antd'
import { UserPlus } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import { useGrantAccessMutation, usePortalLoginsQuery } from './hooks'
import type { GrantAccessPayload, PortalLogin } from './types'

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
 * Who can sign in to this restaurant on the Partner Portal, and a way to give
 * another email access. This is how support reconnects an owner who has lost
 * their login, or who opened a second account by mistake.
 */
export function PortalAccessCard({ restaurantId, restaurantName }: Readonly<Props>) {
  const { t } = useTranslation('restaurants')
  const [message, contextHolder] = antMessage.useMessage()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm<GrantAccessPayload>()
  const { data: logins = [], isLoading, isError } = usePortalLoginsQuery(restaurantId)
  const grant = useGrantAccessMutation(restaurantId)

  const close = () => {
    form.resetFields()
    grant.reset()
    setOpen(false)
  }

  const submit = async () => {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    grant.mutate(
      { fullName: values.fullName.trim(), email: values.email.trim().toLowerCase() },
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
        <Alert type="warning" showIcon message={t('access.logins.none')} />
      )}

      {logins.length > 0 && (
        <ul className="list-none m-0 p-0 divide-y divide-[var(--color-border)]">
          {logins.map((login) => (
            <li key={login.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="min-w-0">
                <span className="text-[13px] font-medium text-[var(--color-text)]">
                  {login.fullName}
                </span>
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
        </Form>
        {error && <Alert type="error" showIcon message={error} />}
      </Modal>
    </div>
  )
}
