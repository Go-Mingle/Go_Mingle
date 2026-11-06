import { useState } from 'react'
import { Input, message } from 'antd'
import { Clock } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { LabelTag } from '../../atoms/LabelTag'
import { AppButton } from '../../atoms/AppButton'
import { GoMingleLogo } from '../../atoms/GoMingleLogo'
import { getPartnerRestaurantId } from './profileGate'
import { useReviewStatusMutation } from './hooks/useReviewStatusMutation'

export function ReviewStatusScreen() {
  const { t } = useTranslation('setup')
  const navigate = useNavigate()
  const [messageApi, contextHolder] = message.useMessage()
  const [reason, setReason] = useState('')
  const restaurantId = getPartnerRestaurantId()

  const { mutation } = useReviewStatusMutation(restaurantId)

  const approve = () =>
    mutation.mutate(
      { profileStatus: 'active', rejectionReason: '' },
      {
        onSuccess: () => {
          void messageApi.success(t('review.approvedToast'))
          navigate('/', { replace: true })
        },
      },
    )

  const reject = () =>
    mutation.mutate(
      { profileStatus: 'rejected', rejectionReason: reason.trim() },
      {
        onSuccess: () => {
          void messageApi.success(t('review.rejectedToast'))
          navigate('/', { replace: true })
        },
      },
    )

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-bg)]">
      {contextHolder}
      <div className="w-full max-w-[520px] bg-[var(--color-card)] rounded-[var(--radius-lg)] p-8 shadow-[var(--shadow-sm)]">
        <GoMingleLogo height={30} />
        <div className="flex items-center gap-3 mt-6 mb-1">
          <div className="w-11 h-11 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center shrink-0">
            <Clock size={24} className="text-[var(--color-accent)]" weight="fill" />
          </div>
          <div>
            <h1 className="text-[19px] font-bold text-[var(--color-text)] m-0">
              {t('review.title')}
            </h1>
            <LabelTag>{t('review.badge')}</LabelTag>
          </div>
        </div>
        <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed mt-3">
          {t('review.body')}
        </p>

        {/* Demo-only admin decision simulator (real decision comes from the admin panel). */}
        <div className="mt-6 pt-5 border-t border-[var(--color-border)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)] m-0">
            {t('review.simulateTitle')}
          </p>
          <p className="text-[12px] text-[var(--color-text-subtle)] mt-1 mb-3">
            {t('review.simulateHint')}
          </p>
          <Input.TextArea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder={t('review.rejectReasonPlaceholder')}
            className="mb-3"
          />
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-[var(--color-border)]">
            <AppButton variant="danger" onClick={reject} disabled={mutation.isPending}>
              {t('review.reject')}
            </AppButton>
            <AppButton variant="primary" onClick={approve} disabled={mutation.isPending}>
              {t('review.approve')}
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  )
}
