import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Form, Pagination, Grid, Modal, Button, message, Spin, Alert } from 'antd'
import type { TableProps } from 'antd/es/table'
import type { SorterResult } from 'antd/es/table/interface'
import { Plus, PencilSimple, Trash } from '@phosphor-icons/react'
import { ConfirmModal } from '../../molecules/ConfirmModal'
import { RoleFormModal } from './RoleFormModal'
import { RolesTable } from './components/RolesTable'
import { RolesPagination } from './components/RolesPagination'
import { ALL_MODULES } from './components/rolesTableHelpers'
import type { Role } from './components/rolesTableHelpers'
import { ROLES_PAGE_SIZE } from './constants'
import {
  useRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} from './hooks/useRolesQuery'
import { HttpError } from '../../../shared/api/httpClient'
import { getApiErrorMessage } from '../../../shared/utils/apiError'

// ── card class constants ──────────────────────────────────────
const CARD_CLS = 'bg-[var(--color-card)] rounded-xl p-4 flex flex-col gap-3'
const LABEL_CLS =
  'text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-subtle)] font-[Poppins] mb-[3px]'
const ACTION_BTN_CLS =
  'flex-1 h-[34px] px-[14px] rounded-xl text-xs font-semibold font-[Poppins] inline-flex items-center justify-center gap-[6px] cursor-pointer'

// ── RolesCardList ─────────────────────────────────────────────
interface RolesCardListProps {
  data: Role[]
  onEdit: (role: Role) => void
  onDelete: (role: Role) => void
}

function RolesCardList({ data, onEdit, onDelete }: RolesCardListProps) {
  const { t } = useTranslation('roles-access')

  return (
    <div className="roles-card-list">
      {data.map((role) => {
        const name = role.name
        const usersAssigned = role.usersAssigned ?? 0
        const permissions = role.permissions ?? []
        const fullAccess = !!role.fullAccess

        const moduleLabels = fullAccess
          ? ALL_MODULES.map((m) => m.label)
          : ALL_MODULES.filter((m) => permissions.includes(m.key)).map((m) => m.label)

        return (
          <div key={role.id} className={CARD_CLS}>
            {/* Row 1: role name + users count pill */}
            <div className="flex justify-between items-center">
              <div className="text-sm font-semibold text-[var(--color-text)] font-[Poppins]">
                {name}
              </div>
              <span className="bg-[var(--color-page)] border border-[var(--color-border)] rounded-xl px-2.5 py-[3px] text-xs font-medium text-[var(--color-text-secondary)] font-[Poppins] whitespace-nowrap">
                {usersAssigned} {t('card.users')}
              </span>
            </div>

            {/* Row 2: permission chips */}
            <div>
              <div className={LABEL_CLS}>{t('table.headers.modules')}</div>
              <div className="flex flex-wrap gap-[6px]">
                {moduleLabels.length === 0 ? (
                  <span className="text-xs text-[var(--color-text-muted)] font-[Poppins]">
                    {t('card.noModules')}
                  </span>
                ) : (
                  moduleLabels.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center h-[22px] px-2 rounded text-[11px] font-medium font-[Poppins] bg-[var(--color-divider)] text-[var(--color-text-secondary)]"
                    >
                      {label}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Row 3: actions */}
            <div className="flex gap-2 pt-2 border-t border-[var(--color-divider)]">
              <button
                className={`${ACTION_BTN_CLS} bg-[var(--color-accent-light)] text-[var(--color-accent-dark)] border-[1.5px] border-[var(--color-accent)]`}
                onClick={() => onEdit(role)}
              >
                <PencilSimple size={14} />
                {t('actions.edit')}
              </button>
              <button
                className={`${ACTION_BTN_CLS} bg-[var(--color-error-bg)] text-[var(--color-error)] border-[1.5px] border-[var(--color-error-border)]`}
                onClick={() => onDelete(role)}
              >
                <Trash size={14} />
                {t('actions.delete')}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export function RolesAccessPage() {
  const { t } = useTranslation('roles-access')
  const [messageApi, contextHolder] = message.useMessage()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)
  const [fullAccess, setFullAccess] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(ROLES_PAGE_SIZE)
  const [search, setSearch] = useState('')
  // `sortBy: null` is the third "no sort" state — the query then omits sort
  // params and the server returns its default order. Roles default to name asc.
  const [sortBy, setSortBy] = useState<'name' | 'usersAssigned' | null>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [form] = Form.useForm()

  const {
    data: rolesResponse,
    isPending: rolesLoading,
    isFetching: rolesFetching,
    isError: rolesError,
  } = useRolesQuery({
    page,
    pageSize,
    search,
    // Omit sort params entirely in the "no sort" state (server default order).
    sortBy: sortBy ?? undefined,
    sortDir: sortBy ? sortDir : undefined,
  })
  const roles = rolesResponse?.items ?? []
  const pagination = rolesResponse?.pagination

  const createMutation = useCreateRoleMutation()
  const updateMutation = useUpdateRoleMutation()
  const deleteMutation = useDeleteRoleMutation()

  const LAST_SUPER_ADMIN_WARNING = {
    title: 'Action Not Allowed',
    content:
      'Cannot remove Full Access from this role. At least one active user must have Full Access on the platform.',
  } as const

  const openNew = () => {
    setEditing(null)
    setFullAccess(false)
    form.resetFields()
    setModalOpen(true)
  }
  const openEdit = (role: Role) => {
    setEditing(role)
    setFullAccess(!!role.fullAccess)
    form.setFieldsValue(role)
    setModalOpen(true)
  }
  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  // Surface any API failure as a toast and keep the originating modal open so
  // the user can retry — mirrors the preference-questions error handling.
  const handleMutationError = (error: unknown) => {
    void messageApi.error(getApiErrorMessage(error, t('common:errors.genericError')))
  }

  const onFinish = (values: Role) => {
    const selected = values.permissions ?? []
    // Selecting every permission manually is equivalent to ticking the Full
    // Access checkbox — the checkbox is only a shortcut — so send
    // fullAccess: true to keep the payload consistent with that flow.
    const isFull = fullAccess || ALL_MODULES.every((m) => selected.includes(m.key))
    const effectivePermissions = isFull ? [] : selected
    const payload = {
      name: values.name,
      fullAccess: isFull,
      permissions: effectivePermissions,
    }

    if (editing) {
      // Compare the effective (normalised) permission set so a manual-all edit
      // of an already-full-access role isn't treated as a spurious change.
      const sortedNew = [...effectivePermissions].sort().join(',')
      const sortedOld = [...(editing.fullAccess ? [] : (editing.permissions ?? []))]
        .sort()
        .join(',')
      if (
        values.name === editing.name &&
        isFull === editing.fullAccess &&
        sortedNew === sortedOld
      ) {
        closeModal()
        return
      }

      updateMutation.mutate(
        { id: editing.id, data: payload },
        {
          onError: (error) => {
            if (
              error instanceof HttpError &&
              error.code === 'ERR_LAST_SUPER_ADMIN_FULL_ACCESS_REQUIRED'
            ) {
              void Modal.warning(LAST_SUPER_ADMIN_WARNING)
              return
            }
            handleMutationError(error)
          },
          onSuccess: closeModal,
        },
      )
    } else {
      // Any failure (including a duplicate name the client-side validator
      // couldn't catch because the conflicting role is on another page) is
      // surfaced via handleMutationError, which shows the API's own error
      // message in a toast — nothing is hardcoded here.
      createMutation.mutate(payload, { onSuccess: closeModal, onError: handleMutationError })
    }
  }

  const total = pagination?.totalItems ?? 0
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endRecord = Math.min(page * pageSize, total)
  const pagedData = roles

  const handleTableChange: TableProps<Role>['onChange'] = (_pagination, filters, sorter) => {
    const nameValues = filters['name']
    setSearch(nameValues && nameValues.length > 0 ? String(nameValues[0]) : '')

    const single = Array.isArray(sorter)
      ? (sorter[0] as SorterResult<Role>)
      : (sorter as SorterResult<Role>)
    if (single?.order) {
      setSortBy(single.columnKey === 'usersAssigned' ? 'usersAssigned' : 'name')
      setSortDir(single.order === 'descend' ? 'desc' : 'asc')
    } else {
      // antd's third click on a sortable column reports a "cancelled" sort (no
      // order). Honor it as the genuine no-sort state so the column cycles
      // ascend → descend → no-sort instead of getting stuck toggling forever.
      setSortBy(null)
    }
    setPage(1)
  }

  const hasUsers = (deleteTarget?.usersAssigned ?? 0) > 0

  if (rolesLoading) return <Spin className="flex justify-center mt-20" />
  if (rolesError)
    return <Alert type="error" message={t('common:errors.fetchError')} className="m-4" />

  return (
    <div className="flex flex-col">
      {contextHolder}
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1
          className={`m-0 font-bold text-[var(--color-text)] font-[Poppins] leading-tight ${isMobile ? 'text-xl' : 'text-[26px]'}`}
        >
          {t('title')}
        </h1>
        <button
          onClick={openNew}
          className={`inline-flex items-center gap-[6px] border-0 rounded-xl font-[Poppins] font-semibold cursor-pointer shrink-0 whitespace-nowrap bg-[var(--color-accent)] text-white ${isMobile ? 'h-[34px] px-3 text-xs' : 'h-9 px-4 text-[13px]'}`}
        >
          <Plus size={isMobile ? 13 : 15} weight="bold" />
          {t('actions.newRoleShort')}
        </button>
      </div>

      {isMobile ? (
        <RolesCardList data={pagedData} onEdit={openEdit} onDelete={setDeleteTarget} />
      ) : (
        <RolesTable
          pagedData={pagedData}
          sortBy={sortBy}
          sortDir={sortDir}
          loading={rolesFetching}
          onEdit={openEdit}
          onDeleteTarget={setDeleteTarget}
          onTableChange={handleTableChange}
        />
      )}

      {isMobile ? (
        <div className="flex justify-center pt-4">
          <Pagination
            current={page}
            total={total}
            pageSize={pageSize}
            onChange={(p) => setPage(p)}
            showSizeChanger={false}
            size="small"
          />
        </div>
      ) : (
        <RolesPagination
          currentPage={page}
          pageSize={pageSize}
          total={total}
          startRecord={startRecord}
          endRecord={endRecord}
          onPageChange={setPage}
          onPageSizeChange={(val) => {
            setPageSize(val)
            setPage(1)
          }}
        />
      )}

      <RoleFormModal
        open={modalOpen}
        editing={editing}
        existingRoles={roles}
        fullAccess={fullAccess}
        setFullAccess={setFullAccess}
        form={form}
        submitting={createMutation.isPending || updateMutation.isPending}
        onFinish={onFinish}
        onCancel={closeModal}
      />

      {hasUsers ? (
        <ConfirmModal
          open={!!deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {}}
          title={t('delete.hasUsersTitle')}
          content={t('delete.hasUsersContent', { count: deleteTarget?.usersAssigned })}
          singleButton
          singleButtonText={t('gotIt')}
        />
      ) : (
        <Modal
          open={!!deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          footer={null}
          closable
          title={<span className="text-lg font-bold font-[Poppins]">{t('delete.title')}</span>}
          width={420}
          destroyOnClose
          centered
        >
          <p className="text-sm text-[var(--color-text-muted)] mb-6 font-[Poppins]">
            {t('delete.confirmContent', { name: deleteTarget?.name })}
          </p>
          <div className="app-modal-footer">
            <Button onClick={() => setDeleteTarget(null)} className="!h-9 !px-3 !rounded-xl">
              {t('delete.cancel')}
            </Button>
            <button
              type="button"
              onClick={() => {
                if (!deleteTarget) return
                const name = deleteTarget.name
                deleteMutation.mutate(deleteTarget.id, {
                  onSuccess: () => {
                    setDeleteTarget(null)
                    void messageApi.success(t('delete.deleted', { name }))
                  },
                  onError: handleMutationError,
                })
              }}
              className="h-9 px-3 bg-[var(--color-error)] hover:bg-[var(--color-error-dark)] text-white border-0 rounded-xl font-[Poppins] text-[13px] font-semibold cursor-pointer inline-flex items-center gap-[6px] transition-[background] duration-150 ease-out"
            >
              <Trash size={14} />
              {t('delete.confirm')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
