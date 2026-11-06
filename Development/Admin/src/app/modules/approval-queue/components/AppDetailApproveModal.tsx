import { Modal, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { CheckCircle, Info } from '@phosphor-icons/react'
import { AppButton } from '../../../atoms/AppButton'

interface CategoryOption {
  value: string
  label: string
}

interface AppDetailApproveModalProps {
  open: boolean
  applicationName: string
  selectedCategory: string | null
  categoryOptions: CategoryOption[]
  loading?: boolean
  onCategoryChange: (value: string | null) => void
  onCancel: () => void
  onConfirm: () => void
}

export function AppDetailApproveModal({
  open,
  applicationName,
  selectedCategory,
  categoryOptions,
  loading,
  onCategoryChange,
  onCancel,
  onConfirm,
}: AppDetailApproveModalProps) {
  const { t } = useTranslation('approval-queue')
  const noCategories = categoryOptions.length === 0

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={t('approve.modalTitle')}
      width={480}
      footer={null}
      closable
      destroyOnClose
    >
      <div className="[font-family:var(--font-ui)]">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-[#E8F5E9] flex items-center justify-center">
            <CheckCircle size={28} color="var(--color-success)" weight="fill" />
          </div>
        </div>
        <p className="m-0 mb-1 text-sm font-semibold text-(--color-text) text-center">
          {applicationName}
        </p>
        <p className="m-0 mb-4 text-[13px] text-(--color-text-muted) text-center leading-[1.6]">
          {t('approve.modalSubtitle')}
        </p>
        <label className="block text-xs font-semibold text-(--color-text-muted) mb-1.5 uppercase tracking-[0.06em]">
          {t('approve.selectCategoryLabel')}
        </label>
        <Select
          value={selectedCategory}
          onChange={(v) => onCategoryChange(v)}
          options={categoryOptions}
          disabled={noCategories}
          placeholder={t('approve.selectCategoryPlaceholderShort')}
          className="w-full!"
        />
        <div
          className={`mt-3 flex items-start gap-1.5 text-xs ${
            noCategories ? 'text-(--color-error)' : 'text-(--color-text-muted)'
          }`}
        >
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            {noCategories ? t('approve.noCategoriesGuard') : t('approve.categoryMustBeSelected')}
          </span>
        </div>
        <div className="app-modal-footer">
          <AppButton variant="neutral" onClick={onCancel}>
            {t('approve.cancel')}
          </AppButton>
          <AppButton
            variant="primary"
            onClick={onConfirm}
            disabled={!selectedCategory || noCategories}
            loading={loading}
          >
            <CheckCircle size={14} weight="regular" />
            {t('approve.confirmApproval')}
          </AppButton>
        </div>
      </div>
    </Modal>
  )
}
