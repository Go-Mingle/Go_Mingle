import { Alert, Input, InputNumber, Modal, Select } from 'antd'
import { Plus, X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../../atoms/AppButton'
import { MODAL_WIDTH } from '../../../../atoms/modalWidth'
import { COMBO_LIMITS } from '../constants'
import { sectionErrorsAt } from '../hooks/useMenuOptionsTab'
import type { useMenuOptionsTab } from '../hooks/useMenuOptionsTab'
import type { ComboCourse } from '../types'
import type { SectionErrors } from '../validation'

type Options = ReturnType<typeof useMenuOptionsTab>

const FIELD_ERROR = 'mt-1 text-[12px] text-[var(--color-error)]'
// Uppercase, letter-spaced label matching the source's `.app-form` treatment.
const LABEL =
  'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]'

/**
 * Add / edit a menu option (US-03).
 *
 * Save-on-submit, not per-field (BR-07). Every rule in BR-06 is mirrored
 * client-side, and a 422 that still comes back is rendered through the **same**
 * inline error shape rather than only as a toast — so a server-only rule still
 * points at the offending input.
 */
export function MenuOptionFormModal({ c }: { c: Options }) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <Modal
      open={c.formOpen}
      onCancel={c.closeForm}
      title={t(
        c.editing
          ? 'restaurants:partnerMenu.editOptionTitle'
          : 'restaurants:partnerMenu.addOptionTitle',
      )}
      footer={null}
      width={MODAL_WIDTH.standard}
      destroyOnHidden
    >
      {/* `app-form` gives the inputs the source's 40px height without switching to
          AntD Form — the controlled inputs + hook validation stay as they are. */}
      <div className="app-form">
        {/* Anything the server reported that could not be tied to a field — never
            silently dropped. */}
        {c.errors.general && <Alert type="error" className="mb-3" message={c.errors.general} />}

        <div className="flex flex-col pt-1 md:flex-row md:gap-3">
          <div className="md:flex-1">
            <label className={LABEL} htmlFor="menu-option-name">
              {t('restaurants:partnerMenu.form.name')}
            </label>
            <Input
              id="menu-option-name"
              value={c.draft.name}
              maxLength={COMBO_LIMITS.nameMax}
              status={c.errors.name ? 'error' : undefined}
              placeholder={t('restaurants:partnerMenu.form.namePlaceholder')}
              onChange={(event) => c.setName(event.target.value)}
            />
            {c.errors.name && <p className={FIELD_ERROR}>{c.errors.name}</p>}
          </div>

          <div className="mt-3 w-full md:mt-0 md:w-[160px]">
            <label className={LABEL} htmlFor="menu-option-price">
              {t('restaurants:partnerMenu.form.price')}
            </label>
            {/* 0 is a valid complimentary combo, so the field is never treated as
                empty just because it reads zero. */}
            <InputNumber
              id="menu-option-price"
              value={c.draft.pricePkr}
              min={COMBO_LIMITS.priceMin}
              precision={COMBO_LIMITS.priceDecimals}
              status={c.errors.pricePkr ? 'error' : undefined}
              className="w-full"
              onChange={(value) => c.setPrice(value ?? Number.NaN)}
            />
            {c.errors.pricePkr && <p className={FIELD_ERROR}>{c.errors.pricePkr}</p>}
          </div>
        </div>

        <div className="mt-4 mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          {t('restaurants:partnerMenu.form.sections')}
        </div>
        {c.errors.courses && <p className={`${FIELD_ERROR} mb-2`}>{c.errors.courses}</p>}

        <div className="flex max-h-[46vh] flex-col gap-3 overflow-y-auto pr-1">
          {c.draft.courses.map((course, index) => (
            <SectionRow
              key={index}
              course={course}
              errors={sectionErrorsAt(c.errors, index)}
              canRemove={c.draft.courses.length > COMBO_LIMITS.coursesMin}
              onChange={(patch) => c.patchSection(index, patch)}
              onRemove={() => c.removeSection(index)}
            />
          ))}

          {c.draft.courses.length < COMBO_LIMITS.coursesMax && (
            <button
              type="button"
              onClick={c.addSection}
              className="inline-flex cursor-pointer items-center gap-1 self-start border-none bg-transparent px-0 text-[12px] font-medium text-[var(--color-accent)] hover:underline"
            >
              <Plus size={13} weight="bold" /> {t('restaurants:partnerMenu.form.addSection')}
            </button>
          )}
        </div>

        <div className="app-modal-footer">
          <AppButton variant="neutral" onClick={c.closeForm}>
            {t('common:buttons.cancel')}
          </AppButton>
          <AppButton variant="primary" onClick={c.submit} disabled={c.saving}>
            {c.saving ? t('restaurants:partnerMenu.form.saving') : t('common:buttons.save')}
          </AppButton>
        </div>
      </div>
    </Modal>
  )
}

interface SectionRowProps {
  course: ComboCourse
  errors: SectionErrors
  canRemove: boolean
  onChange: (patch: Partial<ComboCourse>) => void
  onRemove: () => void
}

function SectionRow({ course, errors, canRemove, onChange, onRemove }: SectionRowProps) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <div className="rounded-[12px] border border-[var(--color-border)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Input
            value={course.course}
            maxLength={COMBO_LIMITS.courseNameMax}
            status={errors.course ? 'error' : undefined}
            aria-label={t('restaurants:partnerMenu.form.sectionName')}
            placeholder={t('restaurants:partnerMenu.form.sectionNamePlaceholder')}
            onChange={(event) => onChange({ course: event.target.value })}
          />
        </div>
        <span className="whitespace-nowrap text-[12px] text-[var(--color-text-muted)]">
          {t('restaurants:partnerMenu.form.choice')}
        </span>
        <InputNumber
          value={course.choose}
          min={1}
          precision={0}
          status={errors.choose ? 'error' : undefined}
          aria-label={t('restaurants:partnerMenu.form.choice')}
          className="w-[70px]"
          onChange={(value) => onChange({ choose: value ?? 0 })}
        />
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t('restaurants:partnerMenu.form.removeSection')}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border-none bg-transparent text-[var(--color-text-subtle)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {errors.course && <p className={FIELD_ERROR}>{errors.course}</p>}
      {errors.choose && <p className={FIELD_ERROR}>{errors.choose}</p>}

      {/* Typed items, Enter to add, chip with × to remove (AC-03.3). `open={false}`
          because there is no catalogue to pick from — the partner types their own. */}
      <Select
        mode="tags"
        value={course.options}
        onChange={(options: string[]) => onChange({ options })}
        status={errors.options ? 'error' : undefined}
        aria-label={t('restaurants:partnerMenu.form.items')}
        placeholder={t('restaurants:partnerMenu.form.itemsPlaceholder')}
        className="w-full"
        open={false}
        suffixIcon={null}
      />
      {errors.options && <p className={FIELD_ERROR}>{errors.options}</p>}
    </div>
  )
}
