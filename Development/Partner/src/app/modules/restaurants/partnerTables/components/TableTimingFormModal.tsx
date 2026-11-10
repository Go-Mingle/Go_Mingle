import { Input, Modal, Switch, TimePicker } from 'antd'
import { Copy, Plus, X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { AppButton } from '../../../../atoms/AppButton'
import { DISPLAY_DAY_ORDER, TABLE_LIMITS } from '../constants'
import { dayErrorsAt, rangeErrorsAt } from '../hooks/useTableTimingsTab'
import type { TableTimingsTabController } from '../hooks/useTableTimingsTab'
import type { DayDraft, WeekdayKey } from '../types'
import type { DayErrors } from '../validation'

dayjs.extend(customParseFormat)

/**
 * The picker's display format. State is held in the wire's `HH:MM`, so this is
 * presentation only — `dayjs` does the conversion both ways and an unparseable
 * time can never reach the request body.
 */
const DISPLAY_FORMAT = 'h:mm A'
const WIRE_FORMAT = 'HH:mm'

const DAY_ACTION =
  'inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-accent)] hover:underline bg-transparent border-none cursor-pointer px-0'
const FIELD_ERROR = 'mt-1 text-[12px] text-[var(--color-error)]'

/**
 * Add / Edit table timing (US-02, US-03).
 *
 * `destroyOnHidden` keeps the fields from surviving a close, but the draft itself
 * lives in the controller — the modal is a pure view over it, which is what lets a
 * mapped 422 land on the right input after the round trip.
 */
export function TableTimingFormModal({ c }: { c: TableTimingsTabController }) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <Modal
      open={c.formOpen}
      onCancel={c.closeForm}
      title={
        c.editing
          ? t('restaurants:partnerTables.editTitle')
          : t('restaurants:partnerTables.addTitle')
      }
      footer={null}
      width={560}
      destroyOnHidden
    >
      <div className="app-form pt-1">
        <div>
          <label
            htmlFor="table-name"
            className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)] mb-1.5 block"
          >
            {t('restaurants:partnerTables.form.name')}
          </label>
          <Input
            id="table-name"
            value={c.draft.name}
            status={c.errors.name ? 'error' : undefined}
            maxLength={TABLE_LIMITS.nameMax}
            placeholder={t('restaurants:partnerTables.form.namePlaceholder')}
            onChange={(event) => c.setName(event.target.value)}
          />
          {c.errors.name && <p className={FIELD_ERROR}>{c.errors.name}</p>}
        </div>

        {/* Anything the server reported that belongs to no single input. */}
        {c.errors.general && <p className={FIELD_ERROR}>{c.errors.general}</p>}

        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)] mb-2 mt-4">
          {t('restaurants:partnerTables.timingsLabel')}
        </div>

        <div className="flex flex-col gap-2 max-h-[42vh] overflow-y-auto pr-1">
          {DISPLAY_DAY_ORDER.map((day) => (
            <DayTimingCard
              key={day}
              day={day}
              state={c.draft.days[day]}
              errors={dayErrorsAt(c.errors, day)}
              onToggle={c.toggleDay}
              onSetRange={c.setRange}
              onAddRange={c.addRange}
              onRemoveRange={c.removeRange}
              onCopyToAll={c.copyDayToAll}
            />
          ))}
        </div>

        <div className="app-modal-footer">
          <AppButton variant="neutral" onClick={c.closeForm}>
            {t('common:buttons.cancel')}
          </AppButton>
          <AppButton variant="primary" onClick={c.submit} disabled={c.saving}>
            {c.saving ? t('restaurants:partnerTables.form.saving') : t('common:buttons.save')}
          </AppButton>
        </div>
      </div>
    </Modal>
  )
}

interface DayTimingCardProps {
  day: WeekdayKey
  state: DayDraft
  errors: DayErrors
  onToggle: TableTimingsTabController['toggleDay']
  onSetRange: TableTimingsTabController['setRange']
  onAddRange: TableTimingsTabController['addRange']
  onRemoveRange: TableTimingsTabController['removeRange']
  onCopyToAll: TableTimingsTabController['copyDayToAll']
}

function DayTimingCard({
  day,
  state,
  errors,
  onToggle,
  onSetRange,
  onAddRange,
  onRemoveRange,
  onCopyToAll,
}: DayTimingCardProps) {
  const { t } = useTranslation(['restaurants', 'common'])
  const dayName = t(`restaurants:partnerTables.days.${day}`)
  const atCap = state.ranges.length >= TABLE_LIMITS.rangesPerDayMax

  return (
    <div className="rounded-[12px] border border-[var(--color-border)] px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[var(--color-text)]">{dayName}</span>
        <Switch
          size="small"
          checked={state.open}
          aria-label={dayName}
          onChange={(open) => onToggle(day, open)}
        />
      </div>

      {state.open && (
        <div className="flex flex-col gap-2 mt-2.5">
          {state.ranges.map((range, index) => {
            const rangeErrors = rangeErrorsAt(errors, index)
            return (
              <div key={index} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <TimePicker
                    value={range.start ? dayjs(range.start, WIRE_FORMAT) : null}
                    use12Hours
                    format={DISPLAY_FORMAT}
                    minuteStep={15}
                    allowClear={false}
                    status={rangeErrors.start ? 'error' : undefined}
                    placeholder={t('restaurants:partnerTables.form.startPlaceholder')}
                    aria-label={`${dayName} ${t('restaurants:partnerTables.form.startPlaceholder')}`}
                    // Stored in the wire's format, so the request never has to
                    // re-parse a display string.
                    onChange={(value) =>
                      onSetRange(day, index, { start: value ? value.format(WIRE_FORMAT) : '' })
                    }
                    className="flex-1"
                  />
                  <span className="text-[var(--color-text-subtle)]">–</span>
                  <TimePicker
                    value={range.end ? dayjs(range.end, WIRE_FORMAT) : null}
                    use12Hours
                    format={DISPLAY_FORMAT}
                    minuteStep={15}
                    allowClear={false}
                    status={rangeErrors.end ? 'error' : undefined}
                    placeholder={t('restaurants:partnerTables.form.endPlaceholder')}
                    aria-label={`${dayName} ${t('restaurants:partnerTables.form.endPlaceholder')}`}
                    onChange={(value) =>
                      onSetRange(day, index, { end: value ? value.format(WIRE_FORMAT) : '' })
                    }
                    className="flex-1"
                  />
                  {state.ranges.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onRemoveRange(day, index)}
                      aria-label={`${t('restaurants:partnerTables.form.removeRange')} — ${dayName}`}
                      className="shrink-0 w-8 h-8 rounded-[var(--radius-sm)] border-none bg-transparent flex items-center justify-center cursor-pointer text-[var(--color-text-subtle)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {(rangeErrors.start ?? rangeErrors.end) && (
                  <p className={FIELD_ERROR}>{rangeErrors.start ?? rangeErrors.end}</p>
                )}
              </div>
            )
          })}

          {/* The day-level message: an open day with no rows, an overlap, or the cap. */}
          {errors.general && <p className={FIELD_ERROR}>{errors.general}</p>}

          <div className="flex flex-wrap items-center gap-4">
            {/* Capped at six, which is what the backend accepts (BR-05). */}
            {!atCap && (
              <button type="button" onClick={() => onAddRange(day)} className={DAY_ACTION}>
                <Plus size={13} weight="bold" /> {t('restaurants:partnerTables.form.addRange')}
              </button>
            )}
            <button type="button" onClick={() => onCopyToAll(day)} className={DAY_ACTION}>
              <Copy size={13} weight="bold" /> {t('restaurants:partnerTables.form.copyToAll')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
