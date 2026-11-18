import { Alert, Grid, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { EnvelopeSimple, UsersThree } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { PageSkeleton } from '../../visual/PageSkeleton'
import { TabEmptyState } from '../restaurants/components/TabEmptyState'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { initialsOf } from './adapters'
import { OwnerBadge } from './components/OwnerBadge'
import { usePartnerUsersQuery } from './hooks/usePartnerUsersQuery'
import type { PartnerUserListItem } from './types'

/**
 * The team as a team member sees it: everyone who can sign in to this
 * restaurant, with their role, designation and email. Read-only; owners manage
 * people on the full Users page.
 */
export function TeamDirectory() {
  const { t } = useTranslation('users')
  const isMobile = !Grid.useBreakpoint().md
  const query = usePartnerUsersQuery({ pageSize: 100, sortBy: 'name', sortOrder: 'asc' })
  // Owners first, then everyone by name.
  const people = [...(query.data?.items ?? [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))

  const role = (p: PartnerUserListItem) => (p.isPrimary ? t('roles.owner') : t('roles.member'))
  const email = (p: PartnerUserListItem) =>
    p.email ? (
      <a
        href={`mailto:${p.email}`}
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] [overflow-wrap:anywhere]"
      >
        <EnvelopeSimple size={14} aria-hidden="true" />
        {p.email}
      </a>
    ) : (
      '—'
    )
  const person = (p: PartnerUserListItem) => (
    <div className="flex items-center gap-3 min-w-0">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-light)] text-[12px] font-semibold text-[var(--color-accent)]"
      >
        {initialsOf(p.fullName)}
      </span>
      <span className="flex items-center gap-2 min-w-0 text-[14px] font-medium text-[var(--color-text)]">
        <span className="truncate">{p.fullName}</span>
        {p.isPrimary && <OwnerBadge />}
      </span>
    </div>
  )

  const columns: ColumnsType<PartnerUserListItem> = [
    { title: t('table.headers.name'), key: 'name', render: (_, p) => person(p) },
    { title: t('table.headers.role'), key: 'role', render: (_, p) => role(p) },
    { title: t('table.headers.designation'), key: 'designation', render: (_, p) => p.designation ?? '—' },
    { title: t('table.headers.email'), key: 'email', render: (_, p) => email(p) },
  ]

  return (
    <div>
      <h1 className={`m-0 mb-1 ${isMobile ? 'text-[20px]' : 'text-[26px]'} font-bold text-[var(--color-text)] leading-[1.2]`}>
        {t('title')}
      </h1>
      <p className="m-0 mb-6 text-[14px] text-[var(--color-text-secondary)]">{t('directory.subtitle')}</p>

      {query.isPending && <PageSkeleton variant="table" />}
      {query.isError && <Alert type="error" showIcon title={getApiErrorMessage(query.error, t('directory.loadFailed'))} />}
      {query.isSuccess &&
        (people.length === 0 ? (
          <TabEmptyState IconComp={UsersThree} title={t('directory.emptyTitle')} description={t('directory.emptyBody')} />
        ) : isMobile ? (
          <ul className="m-0 p-0 list-none flex flex-col gap-3" aria-label={t('title')}>
            {people.map((p) => (
              <li key={p.id} className="rounded-xl bg-[var(--color-card)] p-4 shadow-[var(--shadow-sm)] flex flex-col gap-2">
                {person(p)}
                <div className="flex justify-between gap-3 text-[12px]">
                  <span className="text-[var(--color-text-muted)]">{t('table.headers.role')}</span>
                  <span className="text-[var(--color-text-secondary)]">
                    {role(p)}
                    {p.designation ? `, ${p.designation}` : ''}
                  </span>
                </div>
                {email(p)}
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl bg-[var(--color-card)] shadow-[var(--shadow-sm)] overflow-hidden">
            <Table rowKey="id" columns={columns} dataSource={people} pagination={false} />
          </div>
        ))}
      <p className="mt-4 text-[12px] text-[var(--color-text-muted)]">{t('directory.ownerNote')}</p>
    </div>
  )
}
