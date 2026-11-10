import { useEffect, useRef, useState } from 'react'
import { Modal, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'
import { useDebouncedValue } from '../../../../shared/hooks/useDebouncedValue'

export interface PickerRestaurant {
  id: string
  name: string
}

interface Props {
  open: boolean
  restaurants: PickerRestaurant[]
  onCancel: () => void
  onContinue: (restaurantId: string) => void
  /** Fired as the user types — the parent re-queries restaurants by name. */
  onSearch?: (term: string) => void
  loading?: boolean
}

/**
 * Restaurant-selection step shown before the create flow on the global
 * (cross-restaurant) Interest Tables page. Interest tables are always created
 * within a restaurant's declared availability, so the user must pick one first;
 * the chosen id is handed back and the standard CreateInterestTableModal takes over.
 *
 * The list is ACTIVE-only and searched server-side by the parent, so the Select
 * does no client-side filtering of its own.
 *
 * The debounce lives here rather than in the parent on purpose. `onSearch` is
 * what makes the parent re-render, and the parent owns the master-list grid —
 * so calling it per keystroke rebuilt every column and row on each character and
 * made typing visibly stutter. Keystrokes now only touch this component's local
 * state; the parent is notified once the user pauses.
 */
const SEARCH_DEBOUNCE_MS = 450

export function RestaurantPickerModal({
  open,
  restaurants,
  onCancel,
  onContinue,
  onSearch,
  loading,
}: Props) {
  const { t } = useTranslation('interest-tables')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // What the user has typed, updated immediately so the input stays responsive.
  const [term, setTerm] = useState('')
  const debouncedTerm = useDebouncedValue(term, SEARCH_DEBOUNCE_MS)

  // `onSearch` is held in a ref and kept out of the dep list deliberately —
  // parents commonly pass an inline arrow, which would otherwise re-fire the
  // search on every parent render.
  const onSearchRef = useRef(onSearch)
  useEffect(() => {
    onSearchRef.current = onSearch
  })
  useEffect(() => {
    onSearchRef.current?.(debouncedTerm.trim())
  }, [debouncedTerm])

  const options = restaurants.map((r) => ({ value: r.id, label: r.name }))

  const reset = () => {
    setSelectedId(null)
    setTerm('')
    // Clear the parent immediately rather than waiting out the debounce, so a
    // reopened modal never briefly shows the previous search's results.
    onSearchRef.current?.('')
  }

  const handleCancel = () => {
    reset()
    onCancel()
  }
  const handleContinue = () => {
    if (!selectedId) return
    onContinue(selectedId)
    reset()
  }

  // Busy from the first keystroke through to the request resolving, so the gap
  // while the debounce is pending doesn't read as "no results".
  const isSearching = Boolean(loading) || term.trim() !== debouncedTerm.trim()

  // Nothing is listed until the user searches, so say so rather than showing
  // AntD's bare "No data".
  const notFoundContent = term.trim() ? (
    isSearching ? null : (
      <div className="px-2 py-1.5 text-[13px] text-[var(--color-text-muted)]">
        {t('pickRestaurant.noResults')}
      </div>
    )
  ) : (
    <div className="px-2 py-1.5 text-[13px] text-[var(--color-text-muted)]">
      {t('pickRestaurant.typeToSearch')}
    </div>
  )

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={t('pickRestaurant.title')}
      footer={null}
      width={460}
      destroyOnClose
    >
      <div className="font-[Poppins]">
        <p className="mt-0 mb-4 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
          {t('pickRestaurant.helper')}
        </p>
        <Select
          showSearch
          value={selectedId ?? undefined}
          onChange={(v) => setSelectedId(v)}
          placeholder={t('pickRestaurant.placeholder')}
          options={options}
          className="w-full"
          size="large"
          loading={isSearching}
          // Search is server-side — never narrow the list a second time locally.
          filterOption={false}
          onSearch={setTerm}
          notFoundContent={notFoundContent}
        />
        <div className="app-modal-footer">
          <AppButton variant="neutral" onClick={handleCancel}>
            {t('form.cancel')}
          </AppButton>
          <AppButton variant="primary" onClick={handleContinue} disabled={!selectedId}>
            {t('pickRestaurant.continue')}
          </AppButton>
        </div>
      </div>
    </Modal>
  )
}
