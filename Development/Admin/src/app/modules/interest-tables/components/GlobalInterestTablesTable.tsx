import { Grid, Table } from 'antd'
import type { SorterResult } from 'antd/es/table/interface'
import { useTranslation } from 'react-i18next'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import type { ListAllInterestTablesParams, MasterInterestTableItem } from '../types'
import { EM_DASH, buildMasterListParams, formatMasterListDateTime } from '../masterListHelpers'
import {
  buildGlobalInterestTablesColumns,
  type GlobalColumnCallbacks,
} from './globalInterestTablesColumns'
import { LinkCell, ProminglerCell } from './masterListCells'
import { InterestTableStatusBadge } from './InterestTableStatusBadge'
import { LabelTag } from '../../../atoms/LabelTag'
import { TableAvatar } from '../../../molecules/TableAvatar'

interface Props extends GlobalColumnCallbacks {
  items: MasterInterestTableItem[]
  params: ListAllInterestTablesParams
  loading?: boolean
  onParamsChange: (partial: Partial<ListAllInterestTablesParams>) => void
}

const CARD_LABEL =
  'mb-[3px] font-[Poppins] text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-subtle)]'

/**
 * Cross-restaurant Interest Tables grid (CR-43). Purpose-built for the master
 * list rather than shared with the per-restaurant tab: the two payloads differ
 * (pre-formatted dates, a flat promingler, a joined restaurant) and the master
 * list filters entirely server-side.
 */
export function GlobalInterestTablesTable({
  items,
  params,
  loading,
  onParamsChange,
  ...callbacks
}: Props) {
  const { t } = useTranslation('interest-tables')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const columns = buildGlobalInterestTablesColumns(params, t, callbacks)

  if (isMobile) {
    return (
      <div className="flex flex-col gap-2.5">
        {items.map((row) => (
          <div
            key={row.id}
            onClick={() => callbacks.onView(row)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') callbacks.onView(row)
            }}
            className="flex cursor-pointer flex-col gap-3 rounded-xl bg-[var(--color-card)] p-4 shadow-[var(--shadow-sm)]"
          >
            {/* Row 1 — thumbnail + name + restaurant + status */}
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <TableAvatar
                  name={row.name}
                  imageUrl={row.coverImageUrl}
                  size={40}
                  shape="rounded"
                />
                <div className="flex min-w-0 flex-col gap-[3px]">
                  <span className="truncate font-[Poppins] text-[14px] font-semibold text-[var(--color-text)]">
                    {row.name}
                  </span>
                  <LinkCell
                    label={row.restaurant?.name ?? EM_DASH}
                    targetId={row.restaurant?.id}
                    onClick={callbacks.onRestaurantClick}
                    size="label"
                  />
                </div>
              </div>
              <InterestTableStatusBadge status={row.status} />
            </div>

            {/* Row 2 — date & time + max guests */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className={CARD_LABEL}>{t('table.headers.dateTime')}</div>
                <span className="font-[Poppins] text-[14px] font-medium text-[var(--color-text-secondary)]">
                  {formatMasterListDateTime(row.startDate, row.startTime)}
                </span>
              </div>
              <div>
                <div className={CARD_LABEL}>{t('table.headers.maxGuests')}</div>
                <span className="font-[Poppins] text-[14px] font-medium text-[var(--color-text-secondary)]">
                  {row.maxGuests ?? EM_DASH}
                </span>
              </div>
            </div>

            {/* Row 3 — availability + promingler */}
            <div className="flex items-center justify-between gap-2.5 border-t border-[var(--color-divider)] pt-2.5">
              <div>
                <div className={CARD_LABEL}>{t('mode.label')}</div>
                {row.availabilityMode ? (
                  <LabelTag>{t(`mode.${row.availabilityMode.toLowerCase()}`)}</LabelTag>
                ) : (
                  <span className="font-[Poppins] text-[14px] font-medium text-[var(--color-text-subtle)]">
                    {EM_DASH}
                  </span>
                )}
              </div>
              <div className="text-right" onClick={(e) => e.stopPropagation()}>
                <div className={CARD_LABEL}>{t('promingler.label')}</div>
                <ProminglerCell row={row} t={t} onProminglerClick={callbacks.onProminglerClick} />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="interest-tables-table">
      <Table<MasterInterestTableItem>
        dataSource={items}
        columns={withFixedEnds(columns)}
        rowKey="id"
        size="middle"
        pagination={false}
        loading={loading}
        scroll={{ x: 'max-content' }}
        onChange={(_pagination, filters, sorter) => {
          onParamsChange(
            buildMasterListParams(
              filters,
              sorter as
                | SorterResult<MasterInterestTableItem>
                | SorterResult<MasterInterestTableItem>[],
            ),
          )
        }}
        onRow={(record) => ({
          onClick: () => callbacks.onView(record),
          className: 'cursor-pointer',
        })}
      />
    </div>
  )
}
