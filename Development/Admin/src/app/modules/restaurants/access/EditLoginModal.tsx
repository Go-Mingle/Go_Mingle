import { Alert, Form, Input, Modal, Radio, Switch } from 'antd'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import type { PortalLogin, UpdateLoginPayload } from './types'

interface Props {
  login: PortalLogin | null
  saving: boolean
  error: unknown
  onSave: (changes: UpdateLoginPayload) => void
  onCancel: () => void
}

interface Values {
  fullName: string
  email: string
  designation: string
  role: 'owner' | 'member'
  active: boolean
}

/**
 * Edits one Partner Portal login: who it is, whether it is an owner, and
 * whether it can sign in. Only changed fields are sent, so an untouched email
 * is never re-checked.
 */
export function EditLoginModal({ login, saving, error, onSave, onCancel }: Readonly<Props>) {
  const { t } = useTranslation('restaurants')
  const [form] = Form.useForm<Values>()
  const role = Form.useWatch('role', form)

  const submit = async () => {
    if (!login) return
    const v = await form.validateFields().catch(() => null)
    if (!v) return
    const changes: UpdateLoginPayload = {}
    if (v.fullName.trim() !== login.fullName) changes.fullName = v.fullName.trim()
    if (v.email.trim().toLowerCase() !== login.email) changes.email = v.email.trim().toLowerCase()
    if (v.designation.trim() !== (login.designation ?? '')) changes.designation = v.designation.trim()
    if ((v.role === 'owner') !== login.isOwner) changes.isOwner = v.role === 'owner'
    if (v.active !== (login.status !== 'SUSPENDED')) changes.status = v.active ? 'ACTIVE' : 'SUSPENDED'
    if (Object.keys(changes).length === 0) return onCancel()
    onSave(changes)
  }

  const message = error ? getApiErrorMessage(error, t('access.failed')) : ''

  return (
    <Modal
      open={Boolean(login)}
      title={t('access.edit.title', { name: login?.fullName ?? '' })}
      okText={t('access.edit.submit')}
      cancelText={t('access.cancel')}
      confirmLoading={saving}
      onOk={() => void submit()}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        // Opened afresh for each login, so its current values are the starting point.
        key={login?.id}
        initialValues={
          login
            ? {
                fullName: login.fullName,
                email: login.email,
                designation: login.designation ?? '',
                role: login.isOwner ? 'owner' : 'member',
                active: login.status !== 'SUSPENDED',
              }
            : undefined
        }
      >
        <Form.Item
          name="fullName"
          label={t('access.grant.fullName')}
          rules={[{ required: true, whitespace: true, min: 2, message: t('access.grant.fullNameRequired') }]}
        >
          <Input maxLength={120} />
        </Form.Item>
        <Form.Item
          name="email"
          label={t('access.grant.email')}
          extra={t('access.edit.emailHint')}
          rules={[{ required: true, type: 'email', message: t('access.emailInvalid') }]}
        >
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item name="designation" label={t('access.edit.designation')}>
          <Input maxLength={100} placeholder={t('access.edit.designationPlaceholder')} />
        </Form.Item>
        <Form.Item name="role" label={t('access.edit.role')} extra={role === 'owner' ? t('access.edit.ownerHint') : t('access.edit.memberHint')}>
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            options={[
              { value: 'owner', label: t('access.logins.owner') },
              { value: 'member', label: t('access.logins.team') },
            ]}
          />
        </Form.Item>
        <Form.Item name="active" label={t('access.edit.canSignIn')} valuePropName="checked">
          <Switch checkedChildren={t('access.edit.active')} unCheckedChildren={t('access.logins.suspended')} />
        </Form.Item>
      </Form>
      {message && <Alert type="error" showIcon title={message} />}
    </Modal>
  )
}
