import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Form, Grid, Spin, Alert, message } from 'antd'
import { Trash, PencilSimple } from '@phosphor-icons/react'
import { InterestFormModal } from './InterestFormModal'
import { ConfirmModal } from '../../molecules/ConfirmModal'
import { InterestsPageHeader } from './components/InterestsPageHeader'
import { InterestsTable } from './components/InterestsTable'
import { InterestsPagination } from './components/InterestsPagination'
import {
  useInterestsQuery,
  useActiveInterestsQuery,
  useInterestQuery,
  useCreateInterestMutation,
  useUpdateInterestMutation,
  useDeleteInterestMutation,
} from './hooks/useInterestsQuery'
import { INTERESTS_PAGE_SIZE } from './constants'
import type { Interest, CreateInterestDto } from './types'
import { getApiErrorMessage } from '../../../shared/utils/apiError'

export function InterestsPage() {
  const { t } = useTranslation('interests')
  const [messageApi, contextHolder] = message.useMessage()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Interest | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Interest | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(INTERESTS_PAGE_SIZE)
  const [form] = Form.useForm()

  const {
    data: interestList,
    isPending,
    isError,
  } = useInterestsQuery({ page: currentPage, pageSize })
  const interests = interestList?.items ?? []
  const total = interestList?.pagination.totalRecords ?? 0
  // Active interests power the create/edit modal's category dropdown.
  const { data: activeInterests = [] } = useActiveInterestsQuery()
  // Fetch the full record when editing so the form reflects the latest server state.
  const { data: editDetail } = useInterestQuery(editing?.id ?? null)
  const createMutation = useCreateInterestMutation()
  const updateMutation = useUpdateInterestMutation()
  const deleteMutation = useDeleteInterestMutation()

  // Distinct groupName values from the (unpaginated) active-interests endpoint.
  // They feed both the table's category filter and the modal's "select or type"
  // field — the paginated list only carries the current page, so deriving them
  // from it would shrink the filter to whatever happens to be on screen.
  const categoryOptions = useMemo(
    () => Array.from(new Set(activeInterests.map((i) => i.groupName).filter(Boolean))).sort(),
    [activeInterests],
  )

  // Populate the edit form once the detail fetch resolves.
  useEffect(() => {
    if (modalOpen && editing && editDetail) {
      form.setFieldsValue({ name: editDetail.name, groupName: editDetail.groupName })
    }
  }, [modalOpen, editing, editDetail, form])

  const openNew = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }
  const openEdit = (interest: Interest) => {
    setEditing(interest)
    setModalOpen(true)
    // Seed with the row data immediately; the detail fetch refreshes it on arrival.
    setTimeout(() => {
      form.setFieldsValue({ name: interest.name, groupName: interest.groupName })
    }, 0)
  }
  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    form.resetFields()
  }

  const handleSave = (v: CreateInterestDto) => {
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: v },
        {
          onSuccess: () => {
            closeModal()
            void messageApi.success(t('form.updatedToast', { name: v.name }))
          },
          onError: () => void messageApi.error(t('form.updateError')),
        },
      )
    } else {
      createMutation.mutate(v, {
        onSuccess: () => {
          closeModal()
          void messageApi.success(t('form.createdToast', { name: v.name }))
        },
        onError: () => void messageApi.error(t('form.createError')),
      })
    }
  }

  const handleDelete = (target: Interest) => {
    deleteMutation.mutate(target.id, {
      onSuccess: () => {
        setDeleteTarget(null)
        // Removing the only row on the last page would leave the table sitting
        // on a page the server no longer returns — step back one.
        if (interests.length === 1 && currentPage > 1) setCurrentPage((page) => page - 1)
        void messageApi.success(t('delete.deletedToast', { name: target.name }))
      },
      // Surface the API's own message (e.g. ERR_INTEREST_IN_USE) so the user
      // learns why the delete was rejected; fall back to the generic string.
      onError: (error) => void messageApi.error(getApiErrorMessage(error, t('delete.deleteError'))),
    })
  }

  if (isPending) return <Spin className="flex justify-center mt-20" />
  if (isError) return <Alert type="error" message={t('common:errors.fetchError')} className="m-4" />

  const startRecord = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, total)
  // The API already returns just this page — no client-side slicing.
  const pagedData = interests

  const deleteName = deleteTarget?.name ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {contextHolder}
      <InterestsPageHeader onNew={openNew} />

      {isMobile ? (
        <div
          className="interests-card-list"
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {pagedData.map((interest) => (
            <div
              key={interest.id}
              style={{
                background: 'var(--color-card)',
                borderRadius: 12,
                boxShadow: 'var(--shadow-sm)',
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {interest.name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {interest.groupName}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => openEdit(interest)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 34,
                    padding: '0 14px',
                    background: 'var(--color-accent-light)',
                    color: 'var(--color-accent-dark)',
                    border: '1.5px solid var(--color-accent)',
                    borderRadius: 12,
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <PencilSimple size={13} weight="regular" />
                  {t('actions.edit')}
                </button>
                <button
                  onClick={() => setDeleteTarget(interest)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 34,
                    padding: '0 14px',
                    background: 'var(--color-error-bg)',
                    color: 'var(--color-error)',
                    border: '1.5px solid var(--color-error-border)',
                    borderRadius: 12,
                    fontFamily: 'Poppins, sans-serif',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Trash size={13} weight="regular" />
                  {t('actions.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <InterestsTable
          pagedData={pagedData}
          categoryOptions={categoryOptions}
          onEdit={openEdit}
          onDeleteTarget={setDeleteTarget}
        />
      )}

      <InterestsPagination
        currentPage={currentPage}
        pageSize={pageSize}
        total={total}
        startRecord={startRecord}
        endRecord={endRecord}
        onPageChange={setCurrentPage}
        onPageSizeChange={(val) => {
          setPageSize(val)
          setCurrentPage(1)
        }}
      />

      <InterestFormModal
        open={modalOpen}
        editing={editing}
        form={form}
        categoryOptions={categoryOptions}
        submitting={createMutation.isPending || updateMutation.isPending}
        onClose={closeModal}
        onFinish={handleSave}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        danger
        title={t('delete.title')}
        content={t('delete.confirmContent', { name: deleteName })}
        cancelText={t('delete.cancel')}
        confirmText={t('delete.confirm')}
      />
    </div>
  )
}
