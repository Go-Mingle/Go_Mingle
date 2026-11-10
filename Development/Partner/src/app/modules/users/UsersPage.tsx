import dayjs from 'dayjs'
import { Alert, Flex, Spin } from 'antd'
import { PencilSimple, Key, Trash, UsersThree, MagnifyingGlass } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { TabEmptyState } from '../restaurants/components/TabEmptyState'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import type { UserRow } from './components/types'
import { UsersTable } from './components/UsersTable'
import { NewUserModal } from './components/NewUserModal'
import { EditUserModal } from './components/EditUserModal'
import { DeleteUserModal } from './components/DeleteUserModal'
import { ResetPasswordModal } from './components/ResetPasswordModal'
import { CardActionsMenu } from '../../molecules/CardActionsMenu'
import type { CardAction } from '../../molecules/CardActionsMenu'
import { UsersPageHeader } from './components/UsersPageHeader'
import { UsersPagination } from './components/UsersPagination'
import { GuardModal } from './components/GuardModal'
import { useUsersPage } from './hooks/useUsersPage'

// ── shared card styles ────────────────────────────────────────
const CARD_CLASS =
  'bg-[var(--color-card)] rounded-xl shadow-[var(--shadow-sm)] p-4 flex flex-col gap-3'

// Detail rows: label and value share the same size — only the shade differs
// (label lighter, value darker).
const VALUE_CLASS =
  'text-[12px] font-medium font-[Poppins,sans-serif] text-[var(--color-text-secondary)]'

const ROW_LABEL_CLASS =
  'text-[12px] font-medium font-[Poppins,sans-serif] text-[var(--color-text-muted)] whitespace-nowrap shrink-0'

// ── UsersCardList ─────────────────────────────────────────────
interface UsersCardListProps {
  data: UserRow[]
  onEdit: (u: UserRow) => void
  onReset: (u: UserRow) => void
  onDelete: (u: UserRow) => void
  /** Shown in place of the cards when there is nothing to list (MET-1307). */
  emptyState: React.ReactNode
}

function UsersCardList({ data, onEdit, onReset, onDelete, emptyState }: UsersCardListProps) {
  const { t } = useTranslation(['users', 'common'])

  // The card list used to render an empty <div> here, so on mobile the two empty
  // states were not merely indistinguishable — neither one said anything at all.
  if (data.length === 0) return <div className="users-card-list">{emptyState}</div>

  return (
    <div className="users-card-list">
      {data.map((u) => {
        const isActive = u.status === 'active'

        const actions: CardAction[] = [
          {
            key: 'edit',
            label: t('actions.edit'),
            icon: <PencilSimple size={16} />,
            onClick: () => onEdit(u),
          },
          {
            key: 'reset',
            label: t('actions.reset'),
            icon: <Key size={16} />,
            onClick: () => onReset(u),
          },
        ]

        // The primary user cannot be removed (BR-03); `canDelete` is the
        // server's own hint, so the control simply is not offered.
        if (u.canDelete) {
          actions.push({
            key: 'delete',
            label: t('actions.delete'),
            icon: <Trash size={16} />,
            danger: true,
            onClick: () => onDelete(u),
          })
        }

        return (
          <div key={u.id} className={CARD_CLASS}>
            {/* Header: name + status tag hugging on the left; more menu top-right */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[14px] font-semibold text-[var(--color-text)] font-[Poppins,sans-serif] whitespace-nowrap overflow-hidden text-ellipsis min-w-0">
                    {u.name}
                  </span>
                  <span
                    className={`shrink-0 ${
                      isActive ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)]'
                    } text-white h-[22px] px-2 rounded-[4px] text-[12px] font-semibold font-[Poppins,sans-serif] inline-flex items-center`}
                  >
                    {isActive ? t('card.active') : t('card.suspended')}
                  </span>
                </div>
                <div className="text-[12px] text-[var(--color-text-muted)] font-[Poppins,sans-serif] mt-0.5">
                  {u.designation ?? '—'}
                </div>
              </div>
              <CardActionsMenu moreLabel={t('common:buttons.more')} actions={actions} />
            </div>

            {/* Email + Last Active — label left (lighter), value right (darker) */}
            <div className="flex flex-col gap-2.5">
              <div className="flex justify-between items-center gap-3">
                <span className={ROW_LABEL_CLASS}>{t('card.email')}</span>
                <span
                  className={`${VALUE_CLASS} text-right [overflow-wrap:anywhere] [word-break:break-word] min-w-0`}
                >
                  {/* Grid rows carry no email by design — see the note in types.ts. */}
                  {u.email ?? '—'}
                </span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className={ROW_LABEL_CLASS}>{t('card.lastActive')}</span>
                <span className={`${VALUE_CLASS} text-right`}>
                  {u.lastActive ? dayjs(u.lastActive).format('DD-MM-YYYY') : '—'}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export function UsersPage() {
  const p = useUsersPage()
  const { t } = useTranslation(['users', 'common'])

  // A filter that matched nothing and a restaurant that has no other users are
  // different situations with different remedies — clear the filter vs. add a
  // user — so they get different copy rather than one shared "No data"
  // (MET-1307 / TC-PARTNER-USERS-012c). Same split as the Interest Tables tab.
  const emptyState = p.hasFilters ? (
    <TabEmptyState
      IconComp={MagnifyingGlass}
      title={t('users:noMatch.title')}
      description={t('users:noMatch.description')}
      compact
    />
  ) : (
    <TabEmptyState
      IconComp={UsersThree}
      title={t('users:empty.title')}
      description={t('users:empty.description')}
      compact
    />
  )

  return (
    <Flex vertical>
      {p.contextHolder}

      <UsersPageHeader isMobile={p.isMobile} onNew={() => p.setNewOpen(true)} />

      {p.isPending && (
        <div className="flex justify-center py-20">
          <Spin />
        </div>
      )}

      {p.isError && (
        <Alert
          type="error"
          className="m-4"
          message={getApiErrorMessage(p.error, t('common:errors.fetchError'))}
        />
      )}

      {!p.isPending && !p.isError && (
        <>
          {p.isMobile ? (
            <UsersCardList
              data={p.pagedData}
              onEdit={p.handleEditOpen}
              onReset={p.handleResetOpen}
              onDelete={p.handleDeleteOpen}
              emptyState={emptyState}
            />
          ) : (
            <UsersTable
              data={p.pagedData}
              loading={p.isFetching}
              onEdit={p.handleEditOpen}
              onResetPassword={p.handleResetOpen}
              onDelete={p.handleDeleteOpen}
              onListParamsChange={p.applyListParams}
              emptyText={emptyState}
            />
          )}

          <UsersPagination
            isMobile={p.isMobile}
            total={p.totalRecords}
            currentPage={p.currentPage}
            pageSize={p.pageSize}
            onPageChange={p.setCurrentPage}
            onPageSizeChange={p.handlePageSizeChange}
          />
        </>
      )}

      <NewUserModal
        open={p.newOpen}
        form={p.newForm}
        isValid={p.isNewFormValid}
        isSaving={p.isCreating}
        onSave={p.handleNewSave}
        onCancel={p.handleNewCancel}
      />

      <EditUserModal
        open={!!p.editTarget}
        form={p.editForm}
        email={p.editTarget?.email}
        // Renaming the primary user is allowed; only Status is off-limits (BR-03).
        statusDisabled={p.editTarget ? !p.editTarget.canSuspend : false}
        isValid={p.isEditFormValid}
        isSaving={p.isUpdating}
        onSave={p.handleEditSave}
        onCancel={p.handleEditCancel}
      />

      <DeleteUserModal
        target={p.deleteTarget}
        onConfirm={p.handleDelete}
        onCancel={() => p.setDeleteTarget(null)}
      />

      <ResetPasswordModal
        target={p.resetPasswordTarget}
        isSaving={p.isSettingPassword}
        onConfirm={p.handleSetPassword}
        onCancel={() => p.setResetPasswordTarget(null)}
      />

      <GuardModal message={p.guardMessage} onClose={() => p.setGuardMessage(null)} />
    </Flex>
  )
}
