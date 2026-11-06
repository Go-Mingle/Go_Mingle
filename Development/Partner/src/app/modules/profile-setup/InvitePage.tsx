import { Form, Input } from 'antd'
import { Lock, WarningCircle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAppDispatch } from '../../../shared/store/hooks'
import { loginAction } from '../../../shared/store/authSlice'
import { AppButton } from '../../atoms/AppButton'
import { GoMingleLogo } from '../../atoms/GoMingleLogo'
import { PARTNER_RESTAURANT_ID } from './profileGate'
import { useInviteActivationMutation } from './hooks/useInviteActivationMutation'

/**
 * Invite-link account setup (PP1). Public route. On password creation the
 * partner account is activated in Draft status and routed to profile setup.
 * (UI prototype — token validation and the real invite email come with the backend.)
 */
export function InvitePage() {
  const { t } = useTranslation('setup')
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { mutation } = useInviteActivationMutation(PARTNER_RESTAURANT_ID)
  const [params] = useSearchParams()
  const [form] = Form.useForm<{ password: string; confirm: string }>()

  const expired = params.get('expired') === '1'

  if (expired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-bg)]">
        <div className="w-full max-w-[420px] bg-[var(--color-card)] rounded-[var(--radius-lg)] p-8 shadow-[var(--shadow-sm)] text-center">
          <WarningCircle
            size={40}
            weight="fill"
            className="text-[var(--color-error)] mx-auto mb-3"
          />
          <h1 className="text-[18px] font-bold text-[var(--color-text)] mb-2">
            {t('invite.expiredTitle')}
          </h1>
          <p className="text-[13px] text-[var(--color-text-muted)] mb-5">
            {t('invite.expiredBody')}
          </p>
          <Link to="/login" className="text-[13px] font-medium text-[var(--color-accent)]">
            {t('invite.backToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async () => {
    await form.validateFields()
    // Activate the account in Draft and sign the partner in (mock).
    mutation.mutate(
      { profileStatus: 'draft', rejectionReason: '' },
      {
        onSuccess: () => {
          dispatch(
            loginAction({
              id: 'u1',
              name: 'Hira Mansoor',
              email: 'partner@gomingle.com',
              role: 'Super Admin',
              initials: 'HM',
            }),
          )
          navigate('/', { replace: true })
        },
      },
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-bg)]">
      <div className="w-full max-w-[420px] bg-[var(--color-card)] rounded-[var(--radius-lg)] p-8 shadow-[var(--shadow-sm)]">
        <GoMingleLogo height={34} />
        <h1 className="text-[20px] font-bold text-[var(--color-text)] mt-5 mb-1">
          {t('invite.title')}
        </h1>
        <p className="text-[13px] text-[var(--color-text-muted)] mb-6">{t('invite.subtitle')}</p>

        <Form form={form} layout="vertical" requiredMark={false} className="app-form">
          <Form.Item
            name="password"
            label={t('invite.password')}
            rules={[{ required: true, min: 8, message: t('invite.weak') }]}
          >
            <Input.Password
              prefix={<Lock size={15} className="text-[var(--color-text-subtle)]" />}
              placeholder={t('invite.passwordPlaceholder')}
            />
          </Form.Item>
          <Form.Item
            name="confirm"
            label={t('invite.confirm')}
            dependencies={['password']}
            rules={[
              { required: true, message: t('invite.mismatch') },
              ({ getFieldValue }) => ({
                validator: (_, v) =>
                  !v || getFieldValue('password') === v
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('invite.mismatch'))),
              }),
            ]}
          >
            <Input.Password
              prefix={<Lock size={15} className="text-[var(--color-text-subtle)]" />}
              placeholder={t('invite.confirmPlaceholder')}
            />
          </Form.Item>
          <AppButton variant="primary" onClick={handleSubmit} fillContainer className="w-full mt-1">
            {t('invite.submit')}
          </AppButton>
        </Form>
      </div>
    </div>
  )
}
