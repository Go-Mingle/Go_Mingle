import { useEffect } from 'react'
import { Form, Input, Modal, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAppSelector, useAppDispatch } from '../../../shared/store/hooks'
import { updateUserAction } from '../../../shared/store/authSlice'
import { authService } from '../../modules/auth/services'

interface ChangeNameModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Shown when the user clicks "View profile" in the topbar dropdown.
 * Email is read-only, full name is editable.
 */
export function ChangeNameModal({ open, onClose }: ChangeNameModalProps) {
  const { t } = useTranslation('profile')
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)
  const [form] = Form.useForm<{ name: string }>()
  const email = user?.email ?? ''

  useEffect(() => {
    if (open && user?.name) {
      form.setFieldsValue({ name: user.name })
    }
  }, [open, user?.name, form])

  const handleFinish = async (values: { name: string }): Promise<void> => {
    const trimmed = values.name.trim()
    if (!trimmed) return
    if (trimmed === user?.name) {
      onClose()
      form.resetFields()
      return
    }
    try {
      await authService.updateProfile({ fullName: trimmed })
      dispatch(updateUserAction({ name: trimmed }))
      void message.success(t('updated'))
      onClose()
      form.resetFields()
    } catch {
      form.setFields([{ name: 'name', errors: ['Failed to update profile. Please try again.'] }])
    }
  }

  const handleCancel = () => {
    onClose()
    form.resetFields()
  }

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={<span className="text-[20px] font-semibold">{t('myProfile')}</span>}
      footer={null}
      width={420}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        requiredMark={false}
        className="app-form mt-4"
      >
        <Form.Item
          label={
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              {t('email')}
            </span>
          }
        >
          <Input size="large" value={email} disabled readOnly />
        </Form.Item>

        <Form.Item
          label={
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              {t('fullName')}
            </span>
          }
          name="name"
          rules={[{ required: true, whitespace: true, message: t('fullNameRequired') }]}
        >
          <Input size="large" placeholder={t('enterFullName')} />
        </Form.Item>

        <div className="app-modal-footer">
          <button
            type="button"
            onClick={handleCancel}
            className="h-9 px-4 rounded-[12px] border border-[var(--color-border-strong)] bg-transparent text-[13px] font-medium text-[var(--color-text)] cursor-pointer hover:bg-[var(--color-hover-neutral)]"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            className="h-9 px-4 rounded-[12px] bg-[var(--color-accent)] text-white border-none text-[13px] font-semibold cursor-pointer hover:bg-[var(--color-accent-dark)]"
          >
            {t('saveChanges')}
          </button>
        </div>
      </Form>
    </Modal>
  )
}
