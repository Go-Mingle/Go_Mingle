import { useState } from 'react'
import { Modal, Select, Button } from 'antd'
import { Check } from '@phosphor-icons/react'
import { ButtonSpinner } from '../../atoms/ButtonSpinner'

interface ChangeCategoryModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  currentCategoryId?: string | undefined
  /** Alias kept for callers passing the current category by value (listing page). */
  currentCategory?: string | undefined
  newCategoryId: string | null
  onCategoryChange: (id: string) => void
  categoryOptions: { value: string; label: string }[]
  confirmLoading?: boolean
}

export function ChangeCategoryModal({
  open,
  onClose,
  onConfirm,
  currentCategoryId,
  currentCategory,
  newCategoryId,
  onCategoryChange,
  categoryOptions,
  confirmLoading = false,
}: ChangeCategoryModalProps) {
  const [hovered, setHovered] = useState(false)
  const compareValue = currentCategoryId ?? currentCategory
  const isDisabled = !newCategoryId || newCategoryId === compareValue || confirmLoading

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable
      title={
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>
          Change category
        </span>
      }
      width={420}
      destroyOnClose
    >
      <div
        className="app-form"
        style={{
          paddingTop: 12,
          paddingBottom: 4,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Select
          options={categoryOptions}
          value={newCategoryId}
          onChange={onCategoryChange}
          style={{ width: '100%', height: 40, borderRadius: 8 }}
          placeholder="Select category"
        />

        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            marginTop: 8,
          }}
        >
          Changing the category will update the commission rate for all future bookings.
        </div>

        <div className="app-modal-footer">
          <Button onClick={onClose} style={{ height: 36, borderRadius: 12 }}>
            Cancel
          </Button>
          <button
            disabled={isDisabled}
            onClick={onConfirm}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 36,
              padding: '0 20px',
              borderRadius: 12,
              border: 'none',
              background: isDisabled
                ? 'var(--color-disabled-bg)'
                : hovered
                  ? 'var(--color-accent-dark)'
                  : 'var(--color-accent)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {confirmLoading ? <ButtonSpinner /> : <Check size={14} weight="bold" />}
            Change category
          </button>
        </div>
      </div>
    </Modal>
  )
}
