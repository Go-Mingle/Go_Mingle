import { Modal } from 'antd'
import { Key, Warning } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'
import { CopyButton } from './CopyButton'

interface SecretRevealModalProps {
  /** Full secret to display once; null keeps the modal closed. */
  secret: string | null
  onClose: () => void
}

/** One-time reveal of the full signing secret (PP9 AC5/AC6) — shown only here. */
export function SecretRevealModal({ secret, onClose }: SecretRevealModalProps) {
  const { t } = useTranslation('integrations')
  return (
    <Modal
      open={!!secret}
      onCancel={onClose}
      title={null}
      footer={null}
      width={480}
      closable={false}
      maskClosable={false}
      destroyOnHidden
    >
      <div className="pt-1">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-10 h-10 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center shrink-0">
            <Key size={20} className="text-[var(--color-accent)]" weight="fill" />
          </div>
          <h3 className="text-[16px] font-bold text-[var(--color-text)] m-0 font-[var(--font-display)]">
            {t('reveal.title')}
          </h3>
        </div>

        <div className="flex items-start gap-2 rounded-[8px] bg-[var(--color-warning-bg)] px-3.5 py-3 mb-4">
          <Warning
            size={16}
            weight="fill"
            className="text-[var(--color-warning)] shrink-0 mt-0.5"
          />
          <p className="text-[12.5px] text-[var(--color-warning)] m-0 leading-[1.5]">
            {t('reveal.body')}
          </p>
        </div>

        <div className="rounded-[8px] bg-[#1a2332] px-4 py-3.5 mb-4 overflow-x-auto font-[ui-monospace,SFMono-Regular,Menlo,monospace]">
          <span className="text-[13px] text-[#e6e9ef] whitespace-nowrap">{secret}</span>
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <CopyButton
            value={secret ?? ''}
            label={t('reveal.copy')}
            copiedLabel={t('reveal.copied')}
          />
          <AppButton variant="primary" onClick={onClose}>
            {t('reveal.done')}
          </AppButton>
        </div>
      </div>
    </Modal>
  )
}
