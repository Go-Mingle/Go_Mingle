import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, Alert, message, Tabs, Flex } from 'antd'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useActiveCategoriesQuery } from '../categories/hooks/useCategoriesQuery'
import { handleApprovalActionError } from './approvalActionError'
import type { Application, ApprovalPageSize, ListApprovalsQueryParams } from './types'
import {
  useApprovalsQuery,
  useApproveApplicationMutation,
  useDeclineApplicationMutation,
} from './hooks/useApprovalQueueQuery'
import { AppDetailApproveModal } from './components/AppDetailApproveModal'
import { AppDetailDeclineModal } from './components/AppDetailDeclineModal'
import { PendingTabContent } from './components/PendingTabContent'
import { RejectedTabContent } from './components/RejectedTabContent'
import { PendingTabLabel } from './components/PendingTabLabel'

const PENDING_DEFAULTS: ListApprovalsQueryParams = {
  status: 'pending',
  page: 1,
  pageSize: 10,
  sortBy: 'submittedAt',
  sortOrder: 'asc',
}

// Rejected tab omits `sortBy` so the backend applies its `rejectedAt desc` default.
const REJECTED_DEFAULTS: ListApprovalsQueryParams = {
  status: 'rejected',
  page: 1,
  pageSize: 10,
  sortOrder: 'desc',
}

export function ApprovalQueuePage() {
  const { t } = useTranslation('approval-queue')
  const navigate = useNavigate()
  const [messageApi, contextHolder] = message.useMessage()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'pending' | 'rejected'>('pending')

  const [pendingParams, setPendingParams] = useState<ListApprovalsQueryParams>(PENDING_DEFAULTS)
  const [rejectedParams, setRejectedParams] = useState<ListApprovalsQueryParams>(REJECTED_DEFAULTS)

  const pendingQuery = useApprovalsQuery(pendingParams)
  const rejectedQuery = useApprovalsQuery(rejectedParams, { enabled: activeTab === 'rejected' })
  const categoriesQuery = useActiveCategoriesQuery()

  const approveMutation = useApproveApplicationMutation()
  const declineMutation = useDeclineApplicationMutation()

  const [approveModal, setApproveModal] = useState<{
    open: boolean
    record: Application | null
    categoryId: string | null
  }>({ open: false, record: null, categoryId: null })
  const [rejectModal, setRejectModal] = useState<{
    open: boolean
    record: Application | null
    reason: string
  }>({ open: false, record: null, reason: '' })

  const activeQuery = activeTab === 'pending' ? pendingQuery : rejectedQuery
  const pendingCount = pendingQuery.data?.pagination.totalRecords ?? 0

  const closeApproveModal = () => setApproveModal({ open: false, record: null, categoryId: null })
  const closeRejectModal = () => setRejectModal({ open: false, record: null, reason: '' })

  const handleActionError = (err: unknown, closeModal: () => void) =>
    handleApprovalActionError(err, {
      messageApi,
      t,
      onTerminal: () => {
        closeModal()
        void qc.invalidateQueries({ queryKey: ['approvals'] })
      },
    })

  const handleApprove = () => {
    const record = approveModal.record
    const categoryId = approveModal.categoryId
    if (!record || !categoryId) return
    approveMutation.mutate(
      { id: record.id, categoryId },
      {
        onSuccess: () => {
          closeApproveModal()
          void messageApi.success(t('messages.approved', { name: record.name }))
        },
        onError: (err) => handleActionError(err, closeApproveModal),
      },
    )
  }

  const handleReject = () => {
    const record = rejectModal.record
    const reason = rejectModal.reason.trim()
    if (!record || reason.length < 10) return
    declineMutation.mutate(
      { id: record.id, reason },
      {
        onSuccess: () => {
          closeRejectModal()
          void messageApi.success(t('messages.declined', { name: record.name }))
        },
        onError: (err) => handleActionError(err, closeRejectModal),
      },
    )
  }

  const categoryList = Array.isArray(categoriesQuery.data) ? categoriesQuery.data : []
  const categoryOptions = categoryList.map((c) => ({
    value: c.id,
    label: c.name,
  }))

  if (activeQuery.isLoading) return <Spin className="flex justify-center mt-20" />
  if (activeQuery.isError)
    return <Alert type="error" message={t('common:errors.fetchError')} className="m-4" />

  return (
    <Flex vertical>
      {contextHolder}

      <div className="mb-6">
        <h1 className="m-0 text-[20px] md:text-[26px] font-bold text-(--color-text) [font-family:Poppins,sans-serif]">
          {t('title')}
        </h1>
      </div>

      <Tabs
        type="line"
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'pending' | 'rejected')}
        className="mb-6"
        items={[
          { key: 'pending', label: <PendingTabLabel count={pendingCount} /> },
          {
            key: 'rejected',
            label: <span className="[font-family:Poppins,sans-serif]">{t('tabs.rejected')}</span>,
          },
        ]}
      />

      {activeTab === 'pending' && (
        <PendingTabContent
          data={pendingQuery.data?.items ?? []}
          loading={pendingQuery.isFetching}
          total={pendingQuery.data?.pagination.totalRecords ?? 0}
          page={pendingParams.page ?? 1}
          pageSize={pendingParams.pageSize ?? 10}
          onQueryParamsChange={(partial) =>
            setPendingParams((prev) => ({ ...prev, ...partial, page: 1 }))
          }
          onApprove={(r) => setApproveModal({ open: true, record: r, categoryId: null })}
          onReject={(r) => setRejectModal({ open: true, record: r, reason: '' })}
          onView={(id) =>
            navigate(`/approval-queue/${id}`, {
              state: { fromApproval: true, backLabel: t('common:backTo.approvalQueue') },
            })
          }
          onPageChange={(page) => setPendingParams((prev) => ({ ...prev, page }))}
          onPageSizeChange={(size) =>
            setPendingParams((prev) => ({ ...prev, pageSize: size as ApprovalPageSize, page: 1 }))
          }
        />
      )}

      {activeTab === 'rejected' && (
        <RejectedTabContent
          data={rejectedQuery.data?.items ?? []}
          loading={rejectedQuery.isFetching}
          total={rejectedQuery.data?.pagination.totalRecords ?? 0}
          page={rejectedParams.page ?? 1}
          pageSize={rejectedParams.pageSize ?? 10}
          onQueryParamsChange={(partial) =>
            setRejectedParams((prev) => ({ ...prev, ...partial, page: 1 }))
          }
          onView={(id) =>
            navigate(`/approval-queue/${id}`, {
              state: { fromApproval: true, backLabel: t('common:backTo.approvalQueue') },
            })
          }
          onPageChange={(page) => setRejectedParams((prev) => ({ ...prev, page }))}
          onPageSizeChange={(size) =>
            setRejectedParams((prev) => ({ ...prev, pageSize: size as ApprovalPageSize, page: 1 }))
          }
        />
      )}

      <AppDetailApproveModal
        open={approveModal.open}
        applicationName={approveModal.record?.name ?? ''}
        selectedCategory={approveModal.categoryId}
        categoryOptions={categoryOptions}
        loading={approveMutation.isPending}
        onCategoryChange={(val) => setApproveModal((prev) => ({ ...prev, categoryId: val }))}
        onCancel={closeApproveModal}
        onConfirm={handleApprove}
      />

      <AppDetailDeclineModal
        open={rejectModal.open}
        applicationName={rejectModal.record?.name ?? ''}
        declineReason={rejectModal.reason}
        loading={declineMutation.isPending}
        onReasonChange={(val) => setRejectModal((prev) => ({ ...prev, reason: val }))}
        onCancel={closeRejectModal}
        onConfirm={handleReject}
      />
    </Flex>
  )
}
