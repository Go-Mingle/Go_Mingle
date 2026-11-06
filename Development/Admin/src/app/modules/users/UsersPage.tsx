import { useState, useEffect } from 'react'
import dayjs from 'dayjs'
import { Spin, Alert, Form, message, Pagination, Flex, Row, Col, Grid, Modal } from 'antd'
import { Plus, PencilSimple, Key, Trash } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { HttpError } from '../../../shared/api/httpClient'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { useActiveRolesQuery } from '../../modules/roles-access/hooks/useRolesQuery'
import {
  useUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useSetUserPasswordMutation,
} from './hooks/useUsersQuery'
import type { UserRow } from './components/types'
import type { ListUsersQueryParams } from './types'
import { UsersTable } from './components/UsersTable'
import { RoleName } from './components/RoleName'
import { UsersPaginationRow } from './components/UsersPaginationRow'
import { NewUserModal } from './components/NewUserModal'
import { EditUserModal } from './components/EditUserModal'
import { DeleteUserModal } from './components/DeleteUserModal'
import { ResetPasswordModal } from './components/ResetPasswordModal'
import { AppButton } from '../../atoms/AppButton'

const CARD_CLS = 'bg-(--color-card) rounded-xl p-4 flex flex-col gap-3'

const LABEL_CLS =
  'text-[10px] font-semibold uppercase tracking-[0.06em] text-(--color-text-subtle) mb-[3px]'

const VALUE_BASE_CLS = 'text-[13px]'

// ── UsersCardList ─────────────────────────────────────────────
interface UsersCardListProps {
  data: UserRow[]
  onEdit: (u: UserRow) => void
  onReset: (u: UserRow) => void
  onDelete: (u: UserRow) => void
}

function UsersCardList({ data, onEdit, onReset, onDelete }: UsersCardListProps) {
  const { t } = useTranslation('users')

  return (
    <div className="users-card-list">
      {data.map((u) => {
        const id = u.id as string
        const name = u.fullName
        const email = u.email
        const status = String(u.status ?? '').toUpperCase()
        const lastActive = u.createdAt
        const isActive = status === 'ACTIVE'

        return (
          <div key={id} className={CARD_CLS}>
            {/* Row 1: name/role + status badge */}
            <Flex align="center" gap={12}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-(--color-text) whitespace-nowrap overflow-hidden text-ellipsis">
                  {name}
                </div>
                <div className="text-xs text-(--color-text-muted) mt-0.5">
                  <RoleName name={u.role.name} />
                </div>
              </div>
              <span
                className={`shrink-0 ${isActive ? 'bg-(--color-success)' : 'bg-(--color-error)'} text-white h-6 px-2.5 rounded text-xs font-semibold inline-flex items-center border-none`}
              >
                {isActive ? t('card.active') : t('card.suspended')}
              </span>
            </Flex>

            {/* Row 2: 2-col grid */}
            <Row gutter={[8, 8]}>
              <Col xs={12} sm={12} md={12} lg={12}>
                <div className={LABEL_CLS}>{t('card.email')}</div>
                <div
                  className={`${VALUE_BASE_CLS} text-(--color-text-secondary) overflow-hidden text-ellipsis whitespace-nowrap`}
                >
                  {email}
                </div>
              </Col>
              <Col xs={12} sm={12} md={12} lg={12}>
                <div className={LABEL_CLS}>{t('card.lastActive')}</div>
                <div className={`${VALUE_BASE_CLS} text-(--color-text-muted)`}>
                  {lastActive ? dayjs(lastActive).format('YYYY-MM-DD') : '—'}
                </div>
              </Col>
            </Row>

            {/* Row 3: actions */}
            <Flex justify="flex-end" gap={8} className="pt-2 border-t border-(--color-divider)">
              <AppButton variant="secondary" onClick={() => onEdit(u)}>
                <PencilSimple size={14} />
                {t('actions.edit')}
              </AppButton>
              <AppButton variant="secondary" onClick={() => onReset(u)}>
                <Key size={14} />
                {t('actions.reset')}
              </AppButton>
              <AppButton variant="danger" onClick={() => onDelete(u)}>
                <Trash size={14} />
                {t('actions.delete')}
              </AppButton>
            </Flex>
          </div>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export function UsersPage() {
  const { t } = useTranslation('users')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [newOpen, setNewOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [resetPasswordTarget, setResetPasswordTarget] = useState<UserRow | null>(null)
  const [queryParams, setQueryParams] = useState<ListUsersQueryParams>({
    page: 1,
    pageSize: 10,
    sortBy: 'name',
    sortOrder: 'asc',
  })
  const [newForm] = Form.useForm()
  const [editForm] = Form.useForm()

  const { data: usersData, isPending, isFetching, isError } = useUsersQuery(queryParams)
  const { data: activeRoles } = useActiveRolesQuery()

  const [messageApi, contextHolder] = message.useMessage()

  const createMutation = useCreateUserMutation()
  const updateMutation = useUpdateUserMutation()
  const deleteMutation = useDeleteUserMutation()
  const setPasswordMutation = useSetUserPasswordMutation()

  useEffect(() => {
    if (editTarget) {
      editForm.setFieldsValue({
        name: editTarget.fullName,
        email: editTarget.email,
        role: editTarget.role.id,
        status: editTarget.status,
      })
    }
  }, [editTarget, editForm])

  if (isPending) return <Spin className="flex justify-center mt-20" />
  if (isError) return <Alert type="error" message={t('common:errors.fetchError')} className="m-4" />

  const roleOptions = activeRoles?.items.map((r) => ({ value: r.id, label: r.name })) ?? []
  const roleFilterOptions = activeRoles?.items.map((r) => ({ text: r.name, value: r.id })) ?? []

  const handleQueryParamsChange = (partial: Partial<ListUsersQueryParams>) => {
    setQueryParams((prev) => ({ ...prev, ...partial, page: 1 }))
  }

  const handleNewSave = () => {
    newForm
      .validateFields()
      .then((values) => {
        createMutation.mutate(
          {
            fullName: (values.name as string).trim(),
            email: values.email as string,
            roleId: values.role as string,
            status: (values.status as 'ACTIVE' | 'SUSPENDED') ?? 'ACTIVE',
            password: values.password as string,
            confirmPassword: values.confirmPassword as string,
          },
          {
            onSuccess: (data) => {
              if ((data as { emailFailed?: boolean }).emailFailed) {
                void messageApi.warning(t('messages.createdEmailFailed'))
              } else {
                void messageApi.success(t('messages.created'))
              }
              setNewOpen(false)
              newForm.resetFields()
            },
            onError: (err) => {
              // A-04 — both codes mean "this address cannot be used", so both belong
              // on the email field. ERR_USER_CREATION_FAILED is the Cognito-squatting
              // case: the API reports a generic 500 telling the operator to retry,
              // which can never succeed.
              if (
                err instanceof HttpError &&
                (err.code === 'ERR_EMAIL_IN_USE' || err.code === 'ERR_USER_CREATION_FAILED')
              ) {
                newForm.setFields([
                  {
                    name: 'email',
                    errors: [getApiErrorMessage(err, t('common:errors.genericError'))],
                  },
                ])
                return
              }
              void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))
            },
          },
        )
      })
      .catch(() => {
        // Field-level validation errors are surfaced inline by AntD; swallow the
        // rejection so it doesn't bubble up as an unhandled promise rejection.
      })
  }

  const handleEditSave = () => {
    editForm.validateFields().then((values) => {
      if (!editTarget) return
      updateMutation.mutate(
        {
          id: editTarget.id,
          data: {
            fullName: (values.name as string)?.trim(),
            roleId: values.role as string,
            status: values.status as 'ACTIVE' | 'SUSPENDED',
          },
        },
        {
          onSuccess: () => {
            void messageApi.success(
              t('messages.updated', { name: (values.name as string) ?? editTarget.fullName }),
            )
            setEditTarget(null)
            editForm.resetFields()
          },
          onError: (err) => {
            if (err instanceof HttpError && err.code === 'ERR_LAST_SUPER_ADMIN') {
              void Modal.warning({
                title: t('modals.actionNotAllowed'),
                content: getApiErrorMessage(err, t('common:errors.genericError')),
              })
              return
            }
            if (err instanceof HttpError && err.code === 'ERR_SELF_MODIFICATION') {
              void messageApi.warning(getApiErrorMessage(err, t('common:errors.genericError')))
              return
            }
            void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))
          },
        },
      )
    })
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    const name = deleteTarget.fullName
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        void messageApi.success(t('modals.delete.deleted', { name }))
        setDeleteTarget(null)
      },
      onError: (err) => {
        if (err instanceof HttpError && err.code === 'ERR_LAST_SUPER_ADMIN') {
          void Modal.warning({
            title: t('modals.actionNotAllowed'),
            content: getApiErrorMessage(err, t('common:errors.genericError')),
          })
          setDeleteTarget(null)
        } else if (err instanceof HttpError && err.code === 'ERR_SELF_MODIFICATION') {
          void messageApi.warning(getApiErrorMessage(err, t('common:errors.genericError')))
          setDeleteTarget(null)
        } else {
          // Previously any other failure was swallowed silently, leaving the
          // user with no feedback (and no toast). Surface it like the other
          // mutations do.
          void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))
          setDeleteTarget(null)
        }
      },
    })
  }

  const handleSendPasswordReset = (data: { newPassword: string; confirmNewPassword: string }) => {
    if (!resetPasswordTarget) return
    const email = resetPasswordTarget.email
    const name = resetPasswordTarget.fullName
    setPasswordMutation.mutate(
      {
        id: resetPasswordTarget.id,
        data: { newPassword: data.newPassword, confirmNewPassword: data.confirmNewPassword },
      },
      {
        onSuccess: () => {
          void messageApi.success(t('modals.resetPassword.sent', { name, email }))
          setResetPasswordTarget(null)
        },
        onError: (err) => {
          if (err instanceof HttpError && err.code === 'ERR_SELF_MODIFICATION') {
            void messageApi.warning(getApiErrorMessage(err, t('common:errors.genericError')))
            setResetPasswordTarget(null)
          } else {
            // Previously bypassed the shared resolver, so this was the only mutation
            // whose failures never surfaced the server's reason.
            void messageApi.error(getApiErrorMessage(err, t('messages.passwordSetFailed')))
          }
        },
      },
    )
  }

  return (
    <Flex vertical>
      {contextHolder}
      <Flex align="center" justify="space-between" gap={12} className="mb-6">
        <h1
          className={`m-0 ${isMobile ? 'text-xl' : 'text-[26px]'} font-bold text-(--color-text) leading-tight`}
        >
          {t('title')}
        </h1>
        <AppButton variant="primary" onClick={() => setNewOpen(true)}>
          <Plus size={15} weight="bold" />
          {t('actions.newUserShort')}
        </AppButton>
      </Flex>

      {isMobile ? (
        <UsersCardList
          data={usersData?.items ?? []}
          onEdit={setEditTarget}
          onReset={setResetPasswordTarget}
          onDelete={setDeleteTarget}
        />
      ) : (
        <UsersTable
          data={usersData?.items ?? []}
          loading={isFetching}
          onEdit={setEditTarget}
          onResetPassword={setResetPasswordTarget}
          onDelete={setDeleteTarget}
          onQueryParamsChange={handleQueryParamsChange}
          roleFilterOptions={roleFilterOptions}
          onRowClick={setEditTarget}
        />
      )}

      {isMobile ? (
        <Flex justify="center" className="pt-4">
          <Pagination
            current={queryParams.page ?? 1}
            total={usersData?.pagination.totalRecords ?? 0}
            pageSize={queryParams.pageSize ?? 10}
            onChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
            showSizeChanger={false}
            size="small"
          />
        </Flex>
      ) : (
        <UsersPaginationRow
          total={usersData?.pagination.totalRecords ?? 0}
          currentPage={queryParams.page ?? 1}
          pageSize={queryParams.pageSize ?? 10}
          onPageChange={(page) => setQueryParams((prev) => ({ ...prev, page }))}
          onPageSizeChange={(s) => {
            setQueryParams((prev) => ({ ...prev, pageSize: s as 10 | 25 | 50, page: 1 }))
          }}
        />
      )}

      <NewUserModal
        open={newOpen}
        form={newForm}
        roleOptions={roleOptions}
        submitting={createMutation.isPending}
        onSave={handleNewSave}
        onCancel={() => {
          setNewOpen(false)
          newForm.resetFields()
        }}
      />

      <EditUserModal
        open={!!editTarget}
        form={editForm}
        roleOptions={roleOptions}
        onSave={handleEditSave}
        onCancel={() => {
          setEditTarget(null)
          editForm.resetFields()
        }}
      />

      <DeleteUserModal
        target={deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ResetPasswordModal
        target={resetPasswordTarget}
        onConfirm={handleSendPasswordReset}
        onCancel={() => setResetPasswordTarget(null)}
      />
    </Flex>
  )
}
