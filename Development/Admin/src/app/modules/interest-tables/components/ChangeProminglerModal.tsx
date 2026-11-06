import { useState } from 'react'
import { Modal, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { Crown } from '@phosphor-icons/react'
import { AppButton } from '../../../atoms/AppButton'

export interface ProminglerCandidate {
  id: string
  name: string
  phone: string
}

interface Props {
  open: boolean
  candidates: ProminglerCandidate[]
  currentId?: string
  onClose: () => void
  onConfirm: (prominglerId: string) => void
}

/**
 * Replace the Pro Mingler on a published table. The current Pro Mingler's booking
 * is system-cancelled and a new Confirmed booking is auto-created for the
 * replacement (backend behaviour — wired by the caller's onConfirm).
 */
export function ChangeProminglerModal({ open, candidates, currentId, onClose, onConfirm }: Props) {
  const { t } = useTranslation('interest-tables')
  const [selected, setSelected] = useState<string | undefined>(currentId)

  // Include the current Pro Mingler so the preselected value resolves to its
  // "name — phone" label instead of falling back to the raw id.
  const options = candidates.map((c) => ({ label: `${c.name} — ${c.phone}`, value: c.id }))

  return (
    <Modal
      open={open}
      onCancel={onClose}
      afterOpenChange={(isOpen) => {
        if (isOpen) setSelected(currentId)
      }}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Crown size={18} weight="fill" color="#B06000" />
          {t('promingler.changeTitle')}
        </span>
      }
      footer={null}
      width={480}
      destroyOnClose
    >
      <p
        style={{
          fontSize: 13,
          color: 'var(--color-text-muted)',
          fontFamily: 'Poppins, sans-serif',
          marginBottom: 16,
        }}
      >
        {t('promingler.changeDesc')}
      </p>
      <Select
        style={{ width: '100%' }}
        placeholder={t('promingler.selectPlaceholder')}
        options={options}
        value={selected}
        onChange={setSelected}
        showSearch
        optionFilterProp="label"
      />
      <div className="app-modal-footer" style={{ marginTop: 24 }}>
        <AppButton variant="neutral" onClick={onClose}>
          {t('form.cancel')}
        </AppButton>
        <AppButton
          variant="secondary"
          disabled={!selected || selected === currentId}
          onClick={() => selected && onConfirm(selected)}
        >
          {t('promingler.changeConfirm')}
        </AppButton>
      </div>
    </Modal>
  )
}
