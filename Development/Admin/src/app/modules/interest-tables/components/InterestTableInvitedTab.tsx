import { useMemo, useState } from 'react'
import { withFixedEnds } from '../../../molecules/withFixedEnds'
import { useNavigate } from 'react-router-dom'
import { Table, Select, Tooltip, Modal, Grid } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { UsersThree, Plus, XCircle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { InterestTable, InterestTableBooking } from '../types'
import { ProminglerBadge } from '../../../molecules/ProminglerBadge'
import { ActionIcon } from '../../minglers/components/MinglerActionIcon'
import { TableAvatar } from '../../../molecules/TableAvatar'
import {
  tableSortIcon,
  funnelIcon,
  makeSearchFilter,
  makeDateFilter,
} from './interestTablesTableHelpers'
import { SecondaryActionButton, PrimaryActionButton } from '../../../atoms/ModalActions'
import { MODAL_WIDTH } from '../../../atoms/modalWidth'
import { formatShortDate, dateSortValue } from '../../../../shared/utils/dateHelpers'

export interface InviteeMingler {
  id: string
  name: string
  phone?: string
}

interface Row {
  [key: string]: unknown
  id: string
  name: string
  isPromingler: boolean
  joined: boolean
  invitedDate: string
}

interface Props {
  table: InterestTable
  bookings: InterestTableBooking[]
  /** All minglers, used to resolve names and offer new invitees. */
  minglers: InviteeMingler[]
  onAddInvitee?: (minglerIds: string[]) => void
  onRemoveInvitee?: (minglerId: string) => void
}

// A's booking statuses are UPPERCASE — a mingler counts as "joined" when they have
// an active (non-cancelled) booking on this table.
const ACTIVE = new Set(['PENDING', 'CONFIRMED', 'COMPLETED'])

function StatusBadge({ joined }: { joined: boolean }) {
  const { t } = useTranslation('interest-tables')
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        padding: '0 10px',
        borderRadius: 4,
        background: joined ? 'var(--color-success)' : 'var(--color-warning)',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'Poppins, sans-serif',
        whiteSpace: 'nowrap',
      }}
    >
      {joined ? t('detail.invited.joined') : t('detail.invited.invited')}
    </span>
  )
}

export function InterestTableInvitedTab({
  table,
  bookings,
  minglers,
  onAddInvitee,
  onRemoveInvitee,
}: Props) {
  const { t } = useTranslation(['interest-tables', 'common'])
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [toAdd, setToAdd] = useState<string[]>([])
  const [cancelling, setCancelling] = useState<Row | null>(null)

  const nameById = useMemo(
    () => Object.fromEntries(minglers.map((m) => [m.id, m.name])),
    [minglers],
  )
  const joinedIds = useMemo(
    () => new Set(bookings.filter((b) => ACTIVE.has(b.status)).map((b) => b.minglerId)),
    [bookings],
  )

  const rows: Row[] = useMemo(() => {
    const invitedDate = (mid: string) => table.inviteDates?.[mid] ?? table.created
    const list: Row[] = []
    const seen = new Set<string>()
    if (table.promingler) {
      list.push({
        id: table.promingler.id,
        name:
          table.promingler.name ??
          table.promingler.fullName ??
          nameById[table.promingler.id] ??
          table.promingler.id,
        isPromingler: true,
        joined: joinedIds.has(table.promingler.id),
        invitedDate: invitedDate(table.promingler.id),
      })
      seen.add(table.promingler.id)
    }
    for (const id of table.inviteList ?? []) {
      if (seen.has(id)) continue
      seen.add(id)
      list.push({
        id,
        name: nameById[id] ?? id,
        isPromingler: false,
        joined: joinedIds.has(id),
        invitedDate: invitedDate(id),
      })
    }
    return list
  }, [table.promingler, table.inviteList, table.inviteDates, table.created, joinedIds, nameById])

  const addOptions = minglers
    .filter((m) => !rows.some((r) => r.id === m.id))
    .map((m) => ({ value: m.id, label: `${m.name}${m.phone ? ` — ${m.phone}` : ''}` }))

  const columns: ColumnsType<Row> = [
    {
      title: t('detail.invited.cols.mingler'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      sortIcon: tableSortIcon,
      ...makeSearchFilter(t('detail.invited.searchMingler'), 'name'),
      render: (_: unknown, row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TableAvatar name={row.name} size={32} />
          <span
            role="button"
            onClick={() =>
              navigate(`/minglers/${row.id}`, {
                state: { backLabel: t('common:backTo.interestTable') },
              })
            }
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--color-accent)',
              cursor: 'pointer',
            }}
          >
            {row.name}
          </span>
          {row.isPromingler && <ProminglerBadge verified size={14} />}
        </div>
      ),
    },
    {
      title: t('detail.invited.cols.dateInvited'),
      dataIndex: 'invitedDate',
      key: 'invitedDate',
      sorter: (a, b) => dateSortValue(a.invitedDate) - dateSortValue(b.invitedDate),
      sortIcon: tableSortIcon,
      ...makeDateFilter('invitedDate'),
      render: (v: string) => (
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text-muted)',
          }}
        >
          {formatShortDate(v)}
        </span>
      ),
    },
    {
      title: t('detail.invited.cols.status'),
      key: 'status',
      sorter: (a, b) => Number(a.joined) - Number(b.joined),
      sortIcon: tableSortIcon,
      filters: [
        { text: t('detail.invited.invited'), value: 'invited' },
        { text: t('detail.invited.joined'), value: 'joined' },
      ],
      filterIcon: funnelIcon,
      onFilter: (value, row) => (row.joined ? 'joined' : 'invited') === value,
      render: (_: unknown, row) => <StatusBadge joined={row.joined} />,
    },
    {
      title: '',
      key: 'actions',
      align: 'center' as const,
      render: (_: unknown, row) => {
        // Promingler is managed via Change Promingler on the header — no row action.
        // Table Booked → no action. Invited → admin can cancel the invite.
        if (row.isPromingler || row.joined || !onRemoveInvitee) {
          return <span style={{ color: 'var(--color-text-subtle)', fontSize: 12 }}>—</span>
        }
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Tooltip title={t('detail.invited.cancelInvite')} placement="top">
              <ActionIcon
                hoverBg="var(--color-error-bg)"
                hoverColor="var(--color-error)"
                onClick={() => setCancelling(row)}
              >
                <XCircle size={17} weight="regular" />
              </ActionIcon>
            </Tooltip>
          </div>
        )
      },
    },
  ]

  return (
    <div className="pt-5">
      {onAddInvitee && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 16,
            flexDirection: isMobile ? 'column' : 'row',
          }}
        >
          <Select
            mode="multiple"
            showSearch
            optionFilterProp="label"
            placeholder={t('detail.invited.addPlaceholder')}
            options={addOptions}
            value={toAdd}
            onChange={setToAdd}
            maxTagCount="responsive"
            style={{ minWidth: 260, flex: isMobile ? undefined : '1 1 420px' }}
          />
          <PrimaryActionButton
            disabled={toAdd.length === 0}
            onClick={() => {
              onAddInvitee(toAdd)
              setToAdd([])
            }}
          >
            <Plus size={14} weight="bold" /> {t('detail.invited.add')}
          </PrimaryActionButton>
        </div>
      )}

      {rows.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            padding: '48px 0',
          }}
        >
          <UsersThree size={32} weight="regular" style={{ color: 'var(--color-text-subtle)' }} />
          <span
            style={{
              fontSize: 13,
              color: 'var(--color-text-muted)',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {t('detail.invited.empty')}
          </span>
        </div>
      ) : isMobile ? (
        <div className="flex flex-col gap-2.5">
          {rows.map((row) => {
            const canCancel = !row.isPromingler && !row.joined && !!onRemoveInvitee
            return (
              <div
                key={row.id}
                className="bg-[var(--color-card)] rounded-xl shadow-[var(--shadow-sm)] p-3.5 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <TableAvatar name={row.name} size={32} />
                    <span
                      role="button"
                      onClick={() =>
                        navigate(`/minglers/${row.id}`, {
                          state: { backLabel: t('common:backTo.interestTable') },
                        })
                      }
                      className="font-[var(--font-ui)] text-sm font-medium text-[var(--color-accent)] cursor-pointer truncate"
                    >
                      {row.name}
                    </span>
                    {row.isPromingler && <ProminglerBadge verified size={14} />}
                  </div>
                  {canCancel && (
                    <Tooltip title={t('detail.invited.cancelInvite')} placement="top">
                      <ActionIcon
                        hoverBg="var(--color-error-bg)"
                        hoverColor="var(--color-error)"
                        onClick={() => setCancelling(row)}
                      >
                        <XCircle size={17} weight="regular" />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <StatusBadge joined={row.joined} />
                  <span className="text-xs text-[var(--color-text-muted)] font-[var(--font-ui)]">
                    {formatShortDate(row.invitedDate)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="interest-table-invited-table">
          <Table<Row>
            dataSource={rows}
            columns={withFixedEnds(columns)}
            rowKey="id"
            size="middle"
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </div>
      )}

      <Modal
        open={!!cancelling}
        onCancel={() => setCancelling(null)}
        closable={false}
        footer={null}
        width={MODAL_WIDTH.confirm}
        title={null}
        destroyOnClose
      >
        {cancelling && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 8,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--color-error-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <XCircle size={24} color="var(--color-error)" weight="fill" />
            </div>
            <p
              style={{
                margin: '0 0 8px',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--color-text)',
                textAlign: 'center',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {t('detail.invited.cancelTitle')}
            </p>
            <p
              style={{
                margin: '0 0 24px',
                fontSize: 13,
                color: 'var(--color-text-muted)',
                textAlign: 'center',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              {t('detail.invited.cancelDesc', { name: cancelling.name })}
            </p>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <SecondaryActionButton fillContainer onClick={() => setCancelling(null)}>
                {t('detail.invited.keep')}
              </SecondaryActionButton>
              <PrimaryActionButton
                danger
                fillContainer
                onClick={() => {
                  onRemoveInvitee?.(cancelling.id)
                  setCancelling(null)
                }}
              >
                {t('detail.invited.cancelOk')}
              </PrimaryActionButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
