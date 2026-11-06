import { useCallback, useEffect, useMemo, useState } from 'react'
import { Form, Grid, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import { meetsPasswordPolicy } from '../../../../shared/utils/passwordStrength'
import { hasNarrowingFilters, toApiStatus, toUserRows } from '../adapters'
import { USERS_DEFAULT_PAGE_SIZE } from '../constants'
import { usersErrorFallbackKey } from '../usersErrors'
import type {
  PartnerUserStatus,
  PartnerUsersQueryParams,
  UpdatePartnerUserDto,
  UserRow,
} from '../types'
import {
  useCreatePartnerUserMutation,
  useDeletePartnerUserMutation,
  usePartnerUsersQuery,
  useSetPartnerUserPasswordMutation,
  useUpdatePartnerUserMutation,
} from './usePartnerUsersQuery'

interface NewUserFormValues {
  name: string
  email: string
  designation?: string
  status: string
  password: string
  confirmPassword: string
}

interface EditUserFormValues {
  name: string
  designation?: string
  status: string
}

export interface SetPasswordFormValues {
  newPassword: string
  confirmPassword: string
}

/**
 * J3 Users Management.
 *
 * Every list operation is server-side: the API is paginated (25/page by default)
 * so the table cannot filter or sort a set it has never received. AntD's own
 * sort/search/filter controls are kept exactly as they were and simply feed
 * query params instead of comparators.
 *
 * There is no role concept anywhere here (BR-01), and the signed-in user is
 * absent from the list by contract (BR-02) — so the previous self-modify and
 * last-Super-Admin guards have no subject and are gone. The one remaining guard
 * is the primary user, who cannot be suspended or deleted (BR-03).
 */
export function useUsersPage() {
  const { t } = useTranslation(['users', 'common'])
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [messageApi, contextHolder] = message.useMessage()

  const [newOpen, setNewOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<UserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [resetPasswordTarget, setResetPasswordTarget] = useState<UserRow | null>(null)
  // Blocked-action notice shown in a modal rather than a toast — it is a rule,
  // not a failure.
  const [guardMessage, setGuardMessage] = useState<string | null>(null)

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(USERS_DEFAULT_PAGE_SIZE)
  const [listParams, setListParams] = useState<PartnerUsersQueryParams>({})

  const [newForm] = Form.useForm<NewUserFormValues>()
  const [editForm] = Form.useForm<EditUserFormValues>()

  const params = useMemo<PartnerUsersQueryParams>(
    () => ({ ...listParams, page: currentPage, pageSize }),
    [listParams, currentPage, pageSize],
  )

  const { data, isPending, isError, error, isFetching } = usePartnerUsersQuery(params)
  const createUser = useCreatePartnerUserMutation()
  const updateUser = useUpdatePartnerUserMutation()
  const setUserPassword = useSetPartnerUserPasswordMutation()
  const deleteUser = useDeletePartnerUserMutation()

  const pagedData = useMemo(() => toUserRows(data?.items ?? []), [data])
  const totalRecords = data?.pagination.totalRecords ?? 0

  // Which empty state the page owes the partner when `pagedData` is empty
  // (MET-1307). Reads `listParams`, not `params`, so paging never counts.
  const hasFilters = hasNarrowingFilters(listParams)

  const showError = useCallback(
    (cause: unknown) => {
      void messageApi.error(getApiErrorMessage(cause, t(usersErrorFallbackKey(cause))))
    },
    [messageApi, t],
  )

  useEffect(() => {
    if (editTarget) {
      editForm.setFieldsValue({
        name: editTarget.name,
        designation: editTarget.designation ?? '',
        status: editTarget.status,
      })
    }
  }, [editTarget, editForm])

  const newName = Form.useWatch('name', newForm) ?? ''
  const newEmail = Form.useWatch('email', newForm) ?? ''
  const newStatus = Form.useWatch('status', newForm)
  const newPassword = Form.useWatch('password', newForm) ?? ''
  const newConfirmPwd = Form.useWatch('confirmPassword', newForm) ?? ''
  const editName = Form.useWatch('name', editForm) ?? ''
  const editStatus = Form.useWatch('status', editForm)

  // The password gate is the policy rule, never a strength score — `Ab1!` scores
  // 3 of 4 yet is too short for the pool and would come back 422 (BR-08).
  const isNewFormValid = !!(
    newName.trim() &&
    newEmail.trim() &&
    newStatus !== undefined &&
    meetsPasswordPolicy(newPassword) &&
    newPassword === newConfirmPwd
  )
  const isEditFormValid = !!(editName.trim() && editStatus)

  /** Any change to sorting, searching or filtering resets to the first page. */
  const applyListParams = useCallback((next: PartnerUsersQueryParams) => {
    setListParams(next)
    setCurrentPage(1)
  }, [])

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const handleEditOpen = (u: UserRow) => setEditTarget(u)

  // Deliberately allowed on the primary user (AC-01.3) — unlike suspend and
  // delete, setting a password is not restricted.
  const handleResetOpen = (u: UserRow) => setResetPasswordTarget(u)

  const handleDeleteOpen = (u: UserRow) => {
    if (!u.canDelete) {
      setGuardMessage(t('users:guards.primaryUser'))
      return
    }
    setDeleteTarget(u)
  }

  const handleNewSave = () => {
    void newForm.validateFields().then((values) => {
      createUser.mutate(
        {
          fullName: values.name.trim(),
          email: values.email.trim(),
          designation: values.designation?.trim() || undefined,
          status: toApiStatus(values.status),
          password: values.password,
          // Required here and validated server-side — the inverse of signup,
          // which rejects the key outright.
          confirmPassword: values.confirmPassword,
        },
        {
          onSuccess: (created) => {
            void messageApi.success(
              created.reactivated ? t('users:messages.reAdded') : t('users:messages.created'),
            )
            setNewOpen(false)
            newForm.resetFields()
          },
          onError: showError,
        },
      )
    })
  }

  const handleEditSave = () => {
    if (!editTarget) return
    void editForm.validateFields().then((values) => {
      const target = editTarget
      const nextDesignation = values.designation?.trim() ?? ''
      const patch: UpdatePartnerUserDto = {}

      // Send only what changed — omitting a key leaves it alone, and an empty
      // designation string is how it is cleared.
      if (values.name.trim() !== target.name) patch.fullName = values.name.trim()
      if (nextDesignation !== (target.designation ?? '')) patch.designation = nextDesignation
      const nextStatus: PartnerUserStatus = toApiStatus(values.status)
      if (nextStatus !== toApiStatus(target.status)) patch.status = nextStatus

      if (Object.keys(patch).length === 0) {
        // A no-op save creates no change entry server-side (BR-14); skip the call.
        setEditTarget(null)
        editForm.resetFields()
        return
      }

      updateUser.mutate(
        { id: target.id, data: patch },
        {
          onSuccess: (updated) => {
            void messageApi.success(t('users:messages.updated', { name: updated.fullName }))
            setEditTarget(null)
            editForm.resetFields()
          },
          onError: showError,
        },
      )
    })
  }

  const handleDelete = () => {
    // The confirm modal's button is not disabled while in flight, so guard here
    // — a second DELETE would land on an already soft-deleted row and 404.
    if (!deleteTarget || deleteUser.isPending) return
    const { id, name } = deleteTarget
    deleteUser.mutate(id, {
      onSuccess: () => {
        void messageApi.success(t('users:modals.delete.deleted', { name }))
        setDeleteTarget(null)
      },
      onError: (cause) => {
        showError(cause)
        setDeleteTarget(null)
      },
    })
  }

  const handleSetPassword = (values: SetPasswordFormValues) => {
    if (!resetPasswordTarget) return
    const { id, name } = resetPasswordTarget
    setUserPassword.mutate(
      { id, data: { password: values.newPassword, confirmPassword: values.confirmPassword } },
      {
        onSuccess: () => {
          // The copy has to say no email was sent, or the actor assumes the user
          // was notified and nobody tells them (BR-07).
          void messageApi.success(t('users:modals.resetPassword.set', { name }))
          setResetPasswordTarget(null)
        },
        onError: showError,
      },
    )
  }

  const handleNewCancel = () => {
    setNewOpen(false)
    newForm.resetFields()
  }

  const handleEditCancel = () => {
    setEditTarget(null)
    editForm.resetFields()
  }

  return {
    contextHolder,
    isMobile,
    isPending,
    isError,
    error,
    isFetching,
    pagedData,
    totalRecords,
    hasFilters,
    currentPage,
    pageSize,
    setCurrentPage,
    handlePageSizeChange,
    applyListParams,
    handleEditOpen,
    handleResetOpen,
    handleDeleteOpen,
    newOpen,
    setNewOpen,
    newForm,
    isNewFormValid,
    handleNewSave,
    handleNewCancel,
    isCreating: createUser.isPending,
    editTarget,
    editForm,
    isEditFormValid,
    handleEditSave,
    handleEditCancel,
    isUpdating: updateUser.isPending,
    deleteTarget,
    setDeleteTarget,
    handleDelete,
    isDeleting: deleteUser.isPending,
    resetPasswordTarget,
    setResetPasswordTarget,
    handleSetPassword,
    isSettingPassword: setUserPassword.isPending,
    guardMessage,
    setGuardMessage,
  }
}
