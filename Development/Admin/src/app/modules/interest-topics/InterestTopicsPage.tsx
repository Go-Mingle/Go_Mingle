import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Form, Modal, Button, Grid, message } from 'antd'
import { Trash, PencilSimple, Plus } from '@phosphor-icons/react'
import { HttpError } from '../../../shared/api/httpClient'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { InterestTopicFormModal } from './InterestTopicFormModal'
import { PageHeader } from '../../molecules/PageHeader'
import { AppButton } from '../../atoms/AppButton'
import { InterestTopicsTable } from './components/InterestTopicsTable'
import { InterestTopicsPagination } from './components/InterestTopicsPagination'
import { TopicGraphic } from './components/TopicGraphic'
import { useTopicsList, useTopicSave, useTopicDelete } from './hooks/useTopics'
import { useInterestsCatalogue } from './hooks/useInterests'
import { INTEREST_TOPICS_PAGE_SIZE } from './constants'
import type { InterestTopic } from './types'

export function InterestTopicsPage() {
  const { t } = useTranslation('interest-topics')
  const qc = useQueryClient()
  const [messageApi, contextHolder] = message.useMessage()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<InterestTopic | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InterestTopic | null>(null)
  // The API's own reason for refusing a delete (e.g. ERR_TOPIC_IN_USE). Shown
  // verbatim in the confirm modal so the admin knows exactly why it failed —
  // the envelope's `details` can come back empty, so the tables count alone is
  // not enough to explain the refusal.
  const [deleteBlockedMessage, setDeleteBlockedMessage] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(INTEREST_TOPICS_PAGE_SIZE)
  const [form] = Form.useForm()
  // Bumped on every modal open so the form modal remounts with fresh internal
  // state. antd's `destroyOnClose` only unmounts the Modal's children, so
  // without this the uploaded-image key survives from one session to the next
  // and a just-created topic's graphic would overwrite the next topic edited
  // (MET-1285).
  const [formSession, setFormSession] = useState(0)
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const { data: topicList } = useTopicsList({
    page: currentPage,
    pageSize,
    q: search || undefined,
    sortBy: 'name',
    sortOrder,
  })
  const topics = topicList?.items ?? []
  const total = topicList?.pagination.totalRecords ?? 0

  const { data: interests = [] } = useInterestsCatalogue()

  const interestOptions = interests.map((i) => ({ value: i.id, label: i.name }))

  const saveMutation = useTopicSave()
  const deleteMutation = useTopicDelete()

  const openNew = () => {
    setEditing(null)
    form.resetFields()
    setFormSession((s) => s + 1)
    setModalOpen(true)
  }
  const openEdit = (topic: InterestTopic) => {
    // The form is populated inside the modal from the fetch-by-id detail
    // response (useTopicDetail), so reset any stale values and open.
    form.resetFields()
    setEditing(topic)
    setFormSession((s) => s + 1)
    setModalOpen(true)
  }
  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    form.resetFields()
  }

  const startRecord = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const endRecord = Math.min(currentPage * pageSize, total)
  const pagedData = topics

  const tablesCount = deleteTarget?.interestTablesCount ?? 0
  const deleteName = deleteTarget?.name ?? ''
  const inUse = tablesCount > 0 || !!deleteBlockedMessage

  const openDelete = (topic: InterestTopic) => {
    setDeleteBlockedMessage(null)
    setDeleteTarget(topic)
  }
  const closeDelete = () => {
    setDeleteBlockedMessage(null)
    setDeleteTarget(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {contextHolder}
      <PageHeader
        title={t('title')}
        action={
          <AppButton variant="primary" onClick={openNew}>
            <Plus size={15} weight="bold" />
            {t('actions.newTopic')}
          </AppButton>
        }
      />

      {isMobile ? (
        <div className="interest-topics-card-list">
          {pagedData.map((topic) => (
            <div
              key={topic.id}
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
              {/* Row 1 — Name + tables pill */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <TopicGraphic graphicUrl={topic.graphicUrl} name={topic.name} />
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      fontFamily: 'Poppins, sans-serif',
                    }}
                  >
                    {topic.name}
                  </span>
                </div>
              </div>

              {/* Row 2 — Interests */}
              {topic.interests.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {topic.interests.map((i) => (
                    <span
                      key={i.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        height: 22,
                        padding: '0 8px',
                        borderRadius: 6,
                        background: 'var(--color-coral-light)',
                        color: 'var(--color-coral-dark)',
                        fontFamily: 'Poppins, sans-serif',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {i.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Row 3 — Actions */}
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  paddingTop: 10,
                  borderTop: '1px solid var(--color-divider)',
                }}
              >
                <button
                  onClick={() => openEdit(topic)}
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
                  {t('actions.edit')}
                </button>
                <button
                  onClick={() => openDelete(topic)}
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
                  {t('actions.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <InterestTopicsTable
          pagedData={pagedData}
          sortOrder={sortOrder}
          searchValue={search}
          onSortToggle={() => {
            setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
            setCurrentPage(1)
          }}
          onSearchChange={(value) => {
            setSearch(value)
            setCurrentPage(1)
          }}
          onEdit={openEdit}
          onDeleteTarget={openDelete}
        />
      )}

      <InterestTopicsPagination
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

      <InterestTopicFormModal
        key={formSession}
        open={modalOpen}
        editing={editing}
        form={form}
        interestOptions={interestOptions}
        submitting={saveMutation.isPending}
        onClose={closeModal}
        onFinish={(v) => {
          const wasEdit = !!editing
          saveMutation.mutate(
            { id: editing?.id, data: v },
            {
              onSuccess: () => {
                closeModal()
                void messageApi.success(
                  wasEdit
                    ? t('form.updatedToast', { name: v.name })
                    : t('form.createdToast', { name: v.name }),
                )
              },
              onError: (error) => {
                if (error instanceof HttpError) {
                  if (error.code === 'ERR_TOPIC_NAME_IN_USE') {
                    form.setFields([{ name: 'name', errors: [t('form.nameDuplicate')] }])
                    return
                  }
                  if (error.code === 'ERR_VALIDATION') {
                    const body = error.responseBody as {
                      error?: { details?: { fields?: Record<string, string | string[]> } }
                    }
                    const fields = body?.error?.details?.fields
                    if (fields) {
                      // The API may return a field's error as a single string or a
                      // string[]. antd's setFields expects string[] — passing a bare
                      // string makes it render one character per line, so normalise.
                      form.setFields(
                        Object.entries(fields).map(([name, errors]) => ({
                          name,
                          errors: Array.isArray(errors) ? errors : [errors],
                        })),
                      )
                      return
                    }
                  } else if (error.code === 'ERR_TOPIC_NOT_FOUND') {
                    closeModal()
                    void messageApi.error(t('errors.notFound'))
                    void qc.invalidateQueries({ queryKey: ['interest-topics'] })
                    return
                  }
                }
                // Any other API error code or a network failure: surface the
                // API's own message via toast (falls back to a generic string).
                void messageApi.error(getApiErrorMessage(error, t('common:errors.genericError')))
              },
            },
          )
        }}
      />

      {/* Delete topic — declarative Modal with 36/12 buttons */}
      <Modal
        open={!!deleteTarget}
        onCancel={closeDelete}
        title={inUse ? t('delete.blockedTitle') : t('delete.title')}
        width={420}
        footer={null}
        closable
        destroyOnClose
      >
        <p
          style={{
            fontSize: 14,
            color: deleteBlockedMessage ? 'var(--color-error)' : 'var(--color-text-muted)',
            fontFamily: 'Poppins, sans-serif',
            margin: '4px 0 0',
            lineHeight: 1.6,
          }}
        >
          {deleteBlockedMessage ??
            (inUse
              ? t('delete.blockedContent', { name: deleteName, count: tablesCount })
              : t('delete.confirmContent', { name: deleteName }))}
        </p>
        <div className="app-modal-footer">
          <Button
            onClick={closeDelete}
            style={{
              height: 36,
              borderRadius: 12,
              fontFamily: 'Poppins, sans-serif',
              fontSize: 13,
            }}
          >
            {inUse ? t('delete.gotIt') : t('delete.cancel')}
          </Button>
          {!inUse && deleteTarget && (
            <button
              onClick={() => {
                const id = deleteTarget.id
                const name = deleteTarget.name
                deleteMutation.mutate(id, {
                  onSuccess: () => {
                    closeDelete()
                    void messageApi.success(t('delete.deletedToast', { name }))
                  },
                  onError: (error) => {
                    if (error instanceof HttpError) {
                      if (error.code === 'ERR_TOPIC_IN_USE') {
                        const body = error.responseBody as {
                          error?: { details?: { interestTablesCount?: number } }
                        }
                        const count = body?.error?.details?.interestTablesCount ?? 0
                        if (count > 0) {
                          setDeleteTarget((prev) =>
                            prev ? { ...prev, interestTablesCount: count } : prev,
                          )
                        }
                        // Show the API's own explanation — `details` is often
                        // empty, so the count is not a reliable substitute.
                        setDeleteBlockedMessage(
                          getApiErrorMessage(error, t('delete.blockedContent', { name, count })),
                        )
                        return
                      }
                      if (error.code === 'ERR_TOPIC_NOT_FOUND') {
                        closeDelete()
                        void messageApi.error(t('errors.notFound'))
                        void qc.invalidateQueries({ queryKey: ['interest-topics'] })
                        return
                      }
                    }
                    // Any other API error code or a network failure: surface the
                    // API's own message via toast.
                    void messageApi.error(
                      getApiErrorMessage(error, t('common:errors.genericError')),
                    )
                  },
                })
              }}
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
