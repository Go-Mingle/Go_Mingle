import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Button, Grid, message } from 'antd'
import { Trash, PencilSimple, Plus } from '@phosphor-icons/react'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { QuestionFormModal } from './components/QuestionFormModal'
import { PageHeader } from '../../molecules/PageHeader'
import { AppButton } from '../../atoms/AppButton'
import { PreferenceQuestionsTable } from './components/PreferenceQuestionsTable'
import { PreferenceQuestionsPagination } from './components/PreferenceQuestionsPagination'
import {
  usePreferenceQuestionsQuery,
  useCreatePreferenceQuestionMutation,
  useUpdatePreferenceQuestionMutation,
  useDeletePreferenceQuestionMutation,
} from './hooks/usePreferenceQuestionsQuery'
import { PREFERENCE_QUESTIONS_PAGE_SIZE } from './constants'
import type {
  PreferenceQuestionListItem,
  CreatePreferenceQuestionInput,
  UpdatePreferenceQuestionInput,
} from './types'

const TYPE_BADGE: Record<'SINGLE_SELECT' | 'MULTI_SELECT', { bg: string; color: string }> = {
  SINGLE_SELECT: { bg: '#1565C0', color: '#ffffff' },
  MULTI_SELECT: { bg: '#B06000', color: '#ffffff' },
}

export function PreferenceQuestionsPage() {
  const { t } = useTranslation('preference-questions')
  const [messageApi, contextHolder] = message.useMessage()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PreferenceQuestionListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PreferenceQuestionListItem | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PREFERENCE_QUESTIONS_PAGE_SIZE)
  const [sortBy, setSortBy] = useState<'order' | 'question'>('order')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [q, setQ] = useState('')

  const { data, isPending } = usePreferenceQuestionsQuery({ page, pageSize, sortBy, sortOrder, q })

  const createMutation = useCreatePreferenceQuestionMutation()
  const updateMutation = useUpdatePreferenceQuestionMutation()
  const deleteMutation = useDeletePreferenceQuestionMutation()

  const pagedData = data?.items ?? []
  const total = data?.pagination.totalRecords ?? 0
  const startRecord = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endRecord = Math.min(page * pageSize, total)

  const openNew = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (item: PreferenceQuestionListItem) => {
    setEditing(item)
    setModalOpen(true)
  }
  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const handleSort = (by: 'order' | 'question', dir: 'asc' | 'desc') => {
    setSortBy(by)
    setSortOrder(dir)
    setPage(1)
  }

  const handleSearch = (value: string) => {
    setQ(value)
    setPage(1)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setPage(1)
  }

  const handleMutationError = (error: unknown) => {
    void messageApi.error(getApiErrorMessage(error, t('common:errors.genericError')))
  }

  const handleFormFinish = (
    v: CreatePreferenceQuestionInput | UpdatePreferenceQuestionInput,
    mode: 'create' | 'edit',
  ) => {
    if (mode === 'edit' && editing) {
      const payload = v as UpdatePreferenceQuestionInput
      updateMutation.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: () => {
            closeModal()
            void messageApi.success(
              t('messages.updatedToast', { name: payload.question ?? editing.question }),
            )
          },
          onError: handleMutationError,
        },
      )
    } else if (mode === 'create') {
      const payload = v as CreatePreferenceQuestionInput
      createMutation.mutate(payload, {
        onSuccess: () => {
          closeModal()
          void messageApi.success(t('messages.createdToast', { name: payload.question }))
        },
        onError: handleMutationError,
      })
    }
  }

  const emptyText = total === 0 && !isPending ? (q ? t('table.noMatch') : t('table.empty')) : ''

  const deleteName = deleteTarget?.question ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {contextHolder}
      <PageHeader
        title={t('title')}
        action={
          <AppButton variant="primary" onClick={openNew}>
            <Plus size={15} weight="bold" />
            {t('actions.newQuestion')}
          </AppButton>
        }
      />

      {isMobile ? (
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          className="preference-questions-card-list"
        >
          {pagedData.map((record) => {
            const colors = TYPE_BADGE[record.type]
            return (
              <div
                key={record.id}
                style={{
                  background: 'var(--color-card)',
                  borderRadius: 12,
                  boxShadow: 'var(--shadow-sm)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* Row 1 — Order + Question (type badge stacks below) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 22,
                        height: 22,
                        padding: '0 6px',
                        borderRadius: 6,
                        background: 'var(--color-divider)',
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'Poppins, sans-serif',
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {record.questionOrder}
                    </span>
                    <span
                      style={{
                        fontFamily: 'Poppins, sans-serif',
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--color-text)',
                        flex: 1,
                        minWidth: 0,
                        wordBreak: 'break-word',
                      }}
                    >
                      {record.question}
                    </span>
                  </div>
                  <span
                    style={{
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      alignItems: 'center',
                      height: 22,
                      padding: '0 10px',
                      borderRadius: 4,
                      background: colors.bg,
                      color: colors.color,
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: 11,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {record.type === 'SINGLE_SELECT' ? t('type.single') : t('type.multi')}
                  </span>
                </div>

                {/* Row 2 — Actions (mobile retains explicit Edit button per assumption A5) */}
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    paddingTop: 10,
                    borderTop: '1px solid var(--color-divider)',
                  }}
                >
                  <button
                    onClick={() => openEdit(record)}
                    style={{
                      flex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
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
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteTarget(record)}
                    style={{
                      flex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
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
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <PreferenceQuestionsTable
          pagedData={pagedData}
          sortBy={sortBy}
          sortOrder={sortOrder}
          searchValue={q}
          onSort={handleSort}
          onRowClick={openEdit}
          onDeleteTarget={setDeleteTarget}
          onSearch={handleSearch}
          emptyText={emptyText}
          loading={isPending}
        />
      )}

      <PreferenceQuestionsPagination
        currentPage={page}
        pageSize={pageSize}
        total={total}
        startRecord={startRecord}
        endRecord={endRecord}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
      />

      <QuestionFormModal
        open={modalOpen}
        editing={editing}
        totalCount={total}
        submitting={createMutation.isPending || updateMutation.isPending}
        onClose={closeModal}
        onFinish={handleFormFinish}
      />

      {/* Delete confirmation — matches canonical 36/12 Cancel + red Delete pattern */}
      <Modal
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        title={t('delete.title')}
        width={420}
        footer={null}
        closable
        destroyOnClose
      >
        <p
          style={{
            fontSize: 14,
            color: 'var(--color-text-muted)',
            fontFamily: 'Poppins, sans-serif',
            margin: '4px 0 0',
            lineHeight: 1.6,
          }}
        >
          {t('delete.content', { name: deleteName })}
        </p>
        <div className="app-modal-footer">
          <Button
            onClick={() => setDeleteTarget(null)}
            style={{
              height: 36,
              borderRadius: 12,
              fontFamily: 'Poppins, sans-serif',
              fontSize: 13,
            }}
          >
            {t('delete.cancel')}
          </Button>
          {deleteTarget && (
            <button
              onClick={() =>
                deleteMutation.mutate(deleteTarget.id, {
                  onSuccess: () => {
                    const name = deleteTarget?.question ?? ''
                    setDeleteTarget(null)
                    void messageApi.success(t('messages.deletedToast', { name }))
                  },
                })
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 36,
                padding: '0 20px',
                background: 'var(--color-error)',
                color: 'white',
                border: 'none',
                borderRadius: 12,
                fontFamily: 'Poppins, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 150ms ease-out',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-error-dark)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-error)')}
            >
              <Trash size={14} weight="regular" color="white" />
              {t('delete.confirm')}
            </button>
          )}
        </div>
      </Modal>
    </div>
  )
}
