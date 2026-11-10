import { Grid } from 'antd'
import { Clock, Eye, EyeSlash, PencilSimple, Trash } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { LabelTag } from '../../../../atoms/LabelTag'
import { CardActionsMenu } from '../../../../molecules/CardActionsMenu'
import { HiddenNotice } from '../../components/HiddenNotice'
import { RowActionButton } from '../../components/RowActionButton'
import { DISPLAY_DAY_ORDER } from '../constants'
import { toDisplayTime } from '../format'
import type { PartnerTable, TimeRange } from '../types'

interface Props {
  table: PartnerTable
  editable: boolean
  onEdit: () => void
  onDelete: () => void
  onToggleVisibility: () => void
}

/**
 * One table area (US-01).
 *
 * Hidden tables are rendered, not filtered — the badge and the show affordance are
 * the point (AC-01.2). The eye/pencil/trash are absent entirely while read-only
 * rather than disabled (BR-10), the house convention across the profile tabs.
 *
 * The week reads Monday-first, as the design shows it, while the contract keys it
 * Sunday-first — {@link DISPLAY_DAY_ORDER} is the only place that ordering lives.
 */
export function TableTimingCard({ table, editable, onEdit, onDelete, onToggleVisibility }: Props) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <div className="bg-[var(--color-card)] rounded-[var(--radius-lg)] p-4 md:p-6 shadow-[var(--shadow-sm)]">
      {table.isHidden && (
        <HiddenNotice
          label={t('restaurants:partnerTables.hiddenBadge')}
          note={t('restaurants:partnerTables.hiddenNote')}
        />
      )}

      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <h3 className="text-sm md:text-base font-bold text-[var(--color-text)] m-0 truncate">
            {table.name}
          </h3>
        </div>
        {editable && (
          <TableCardActions
            table={table}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleVisibility={onToggleVisibility}
          />
        )}
      </div>

      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)] mb-3">
        {t('restaurants:partnerTables.timingsLabel')}
      </div>

      <TableTimingDays availability={table.availability} />
    </div>
  )
}

function TableCardActions({
  table,
  onEdit,
  onDelete,
  onToggleVisibility,
}: Omit<Props, 'editable'>) {
  const { t } = useTranslation(['restaurants', 'common'])
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  if (isMobile) {
    return (
      <CardActionsMenu
        moreLabel={t('common:buttons.more')}
        actions={[
          {
            key: 'visibility',
            label: table.isHidden
              ? t('restaurants:partnerTables.show')
              : t('restaurants:partnerTables.hide'),
            icon: table.isHidden ? <Eye size={16} /> : <EyeSlash size={16} />,
            onClick: onToggleVisibility,
          },
          {
            key: 'edit',
            label: t('common:buttons.edit'),
            icon: <PencilSimple size={16} />,
            onClick: onEdit,
          },
          {
            key: 'delete',
            label: t('common:buttons.delete'),
            icon: <Trash size={16} />,
            danger: true,
            onClick: onDelete,
          },
        ]}
      />
    )
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <RowActionButton
        tooltip={
          table.isHidden
            ? t('restaurants:partnerTables.showAction', { name: table.name })
            : t('restaurants:partnerTables.hideAction', { name: table.name })
        }
        hoverBg="var(--color-hover-neutral)"
        hoverColor="var(--color-text)"
        onClick={onToggleVisibility}
      >
        {/* The icon shows the current state; the tooltip names the action. */}
        {table.isHidden ? <EyeSlash size={17} /> : <Eye size={17} />}
      </RowActionButton>
      <RowActionButton
        tooltip={t('restaurants:partnerTables.editAction', { name: table.name })}
        hoverBg="var(--color-accent-light)"
        hoverColor="var(--color-accent)"
        onClick={onEdit}
      >
        <PencilSimple size={17} />
      </RowActionButton>
      <RowActionButton
        tooltip={t('restaurants:partnerTables.deleteAction', { name: table.name })}
        hoverBg="var(--color-error-bg)"
        hoverColor="var(--color-error)"
        onClick={onDelete}
      >
        <Trash size={17} />
      </RowActionButton>
    </div>
  )
}

function TableTimingDays({ availability }: { availability: PartnerTable['availability'] }) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <div className="flex flex-col gap-2.5">
      {DISPLAY_DAY_ORDER.map((day) => {
        const ranges = availability[day]
        // A day is open exactly when it has at least one range — there is no
        // separate flag on the wire (BR-04).
        const isOpen = ranges.length > 0

        return (
          <div key={day} className="flex items-start gap-3 min-h-[28px]">
            <span
              className={`w-11 shrink-0 pt-[5px] text-xs font-semibold uppercase tracking-[0.04em] font-[Poppins,sans-serif] ${
                isOpen ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-subtle)]'
              }`}
            >
              {t(`restaurants:partnerTables.dayShort.${day}`)}
            </span>
            {isOpen ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {ranges.map((range) => (
                  <RangeChip key={`${range.start}-${range.end}`} range={range} />
                ))}
              </div>
            ) : (
              <span className="pt-[5px] text-xs text-[var(--color-text-subtle)] font-[Poppins,sans-serif]">
                {t('restaurants:partnerTables.closed')}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Times arrive as `HH:MM`; the design shows them 12-hour. */
function RangeChip({ range }: { range: TimeRange }) {
  return (
    <LabelTag className="gap-[5px]">
      <Clock size={12} weight="bold" className="shrink-0" />
      {toDisplayTime(range.start)} – {toDisplayTime(range.end)}
    </LabelTag>
  )
}
