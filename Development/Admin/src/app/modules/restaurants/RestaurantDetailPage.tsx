import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { message } from 'antd'
import { CheckCircle, XCircle } from '@phosphor-icons/react'
import type { Review } from './restaurantDetail.types'
import { AppButton } from '../../atoms/AppButton'
import { LoadingState } from '../../molecules/LoadingState'
import { ChangeCategoryModal } from './ChangeCategoryModal'
import { RestaurantDetailHeader } from './components/RestaurantDetailHeader'
import { RestaurantDetailTabs } from './components/restaurantDetailTabs'
import { RestaurantSuspendModal } from './components/RestaurantSuspendModal'
import { RestaurantUnsuspendModal } from './components/RestaurantUnsuspendModal'
import { DeleteReviewModal } from './components/DeleteReviewModal'
import { AppDetailApproveModal } from '../approval-queue/components/AppDetailApproveModal'
import { AppDetailDeclineModal } from '../approval-queue/components/AppDetailDeclineModal'
import { AppDetailDeclinedBanner } from '../approval-queue/components/AppDetailDeclinedBanner'
import { hasCompositeAccess, getRoleFromUser } from '../../../shared/services/permissions'
import { useAppSelector } from '../../../shared/store/hooks'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import {
  useActiveCategoriesQuery,
  useChangeCategoryMutation,
  useRestaurantDetailQuery,
  useSuspendRestaurantMutation,
  useUnsuspendRestaurantMutation,
  useActiveBookingsCountQuery,
  useDeleteReviewMutation,
} from './hooks/useRestaurantsQuery'
import {
  useApprovalDetailQuery,
  useApproveApplicationMutation,
  useDeclineApplicationMutation,
} from '../approval-queue/hooks/useApprovalQueueQuery'

const APPROVAL_STATUSES = new Set(['PENDING', 'REJECTED'])

export function RestaurantDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation(['restaurants', 'common', 'approval-queue'])
  const [messageApi, contextHolder] = message.useMessage()

  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'overview'
  const setActiveTab = (key: string) => {
    const next = new URLSearchParams(searchParams)
    if (key === 'overview') next.delete('tab')
    else next.set('tab', key)
    setSearchParams(next, { replace: true })
  }

  const [changeCatOpen, setChangeCatOpen] = useState(false)
  const [newCategoryId, setNewCategoryId] = useState<string | null>(null)
  const [suspendModalOpen, setSuspendModalOpen] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [unsuspendModalOpen, setUnsuspendModalOpen] = useState(false)
  const [deleteReviewTarget, setDeleteReviewTarget] = useState<Review | null>(null)
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [approveCategoryId, setApproveCategoryId] = useState<string | null>(null)
  const [declineModalOpen, setDeclineModalOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState('')

  const authUser = useAppSelector((s) => s.auth.user)
  const userRole = getRoleFromUser(authUser)
  const hasReviewsAccess = hasCompositeAccess(userRole, 'MANAGE_RESTAURANTS', 'REVIEWS')

  const { data: activeCategories = [] } = useActiveCategoriesQuery()
  const { data: restaurant, isLoading, isError } = useRestaurantDetailQuery(id)

  const changeCategoryMutation = useChangeCategoryMutation(id)
  const suspendMutation = useSuspendRestaurantMutation(id)
  const unsuspendMutation = useUnsuspendRestaurantMutation(id)
  const deleteReviewMutation = useDeleteReviewMutation(id)
  const approveMutation = useApproveApplicationMutation()
  const declineMutation = useDeclineApplicationMutation()
  const { data: activeBookingsCount } = useActiveBookingsCountQuery(id, suspendModalOpen)
  // Rejection history is only fetched for a REJECTED restaurant; approving/pending never hits it.
  const approvalDetail = useApprovalDetailQuery(id, {
    enabled: restaurant?.status === 'REJECTED',
  })

  if (isLoading) return <LoadingState label={t('common:status.loading')} />
  if (isError) {
    return (
      <div className="text-[var(--color-text-muted)] p-8">
        Unable to load this restaurant. Please refresh or try another restaurant.
      </div>
    )
  }
  if (!restaurant) return null

  const isActive = restaurant.status === 'ACTIVE'
  const isSuspended = restaurant.status === 'SUSPENDED'
  const isApprovalMode = APPROVAL_STATUSES.has(restaurant.status)
  const isPending = restaurant.status === 'PENDING'

  const platformStatusStyle = (() => {
    switch (restaurant.status) {
      case 'ACTIVE':
        return { bg: 'var(--color-success)', text: '#FFFFFF', label: 'Active' }
      case 'SUSPENDED':
        return { bg: 'var(--color-error)', text: '#FFFFFF', label: 'Suspended' }
      case 'PENDING':
        return { bg: 'var(--color-warning)', text: '#FFFFFF', label: 'Pending' }
      case 'REJECTED':
        return { bg: 'var(--color-error)', text: '#FFFFFF', label: 'Rejected' }
      default:
        return { bg: 'var(--color-text-secondary)', text: '#FFFFFF', label: 'Unknown' }
    }
  })()

  // J9 US-003 AC-001: on the approval shell (PENDING/REJECTED) the header always reads
  // "Not visible on Mingler App". The J10A detail endpoint returns the raw partner-controlled
  // column, which is `true` by default pre-approval, so it cannot be trusted here — only
  // /admin/approvals/{id} reports the approval-context value, and it hardcodes false.
  // ACTIVE/SUSPENDED keep the partner's own toggle (visibility is status-independent per J10A).
  const effectiveVisibleOnApp = isApprovalMode ? false : restaurant.visibleOnApp

  const visibilityStyle = effectiveVisibleOnApp
    ? {
        bg: 'var(--color-accent-light)',
        text: 'var(--color-accent-dark)',
        label: 'Visible on Mingler App',
      }
    : {
        bg: 'var(--color-error-bg)',
        text: 'var(--color-error)',
        label: 'Not Visible on Mingler App',
      }

  const restaurantRecord = restaurant as unknown as Record<string, unknown>
  const currentCategory = restaurant.category
  const categoryOptions = activeCategories.map((c) => ({
    value: c.id,
    label: c.commissionRate !== undefined ? `${c.name} — ${c.commissionRate}% commission` : c.name,
  }))

  const onError = (err: unknown) =>
    void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))

  const handleCategoryConfirm = () => {
    if (!newCategoryId) return
    changeCategoryMutation.mutate(
      { categoryId: newCategoryId },
      {
        onSuccess: () => {
          setChangeCatOpen(false)
          setNewCategoryId(null)
          void messageApi.success(t('restaurants:messages.categoryUpdated'))
        },
        onError,
      },
    )
  }

  const closeSuspendModal = () => {
    setSuspendModalOpen(false)
    setSuspendReason('')
  }

  const handleConfirmSuspend = () => {
    if (suspendReason.length < 10) return
    const name = restaurant.name
    suspendMutation.mutate(suspendReason, {
      onSuccess: () => {
        closeSuspendModal()
        void messageApi.success(t('restaurants:messages.suspended', { name }))
      },
      onError,
    })
  }

  const handleConfirmUnsuspend = () => {
    const name = restaurant.name
    unsuspendMutation.mutate(undefined, {
      onSuccess: () => {
        setUnsuspendModalOpen(false)
        void messageApi.success(t('restaurants:messages.unsuspended', { name }))
      },
      onError,
    })
  }

  const handleConfirmDeleteReview = () => {
    if (!deleteReviewTarget) return
    deleteReviewMutation.mutate(deleteReviewTarget.id, {
      onSuccess: () => {
        setDeleteReviewTarget(null)
        void messageApi.success(t('restaurants:messages.reviewDeleted'))
      },
      onError,
    })
  }

  const handleConfirmApprove = () => {
    if (!id || !approveCategoryId) return
    approveMutation.mutate(
      { id, categoryId: approveCategoryId },
      {
        onSuccess: () => {
          setApproveModalOpen(false)
          setApproveCategoryId(null)
          void messageApi.success(t('approval-queue:messages.approved', { name: restaurant.name }))
        },
        onError,
      },
    )
  }

  const handleConfirmDecline = () => {
    if (!id || declineReason.trim().length < 10) return
    declineMutation.mutate(
      { id, reason: declineReason },
      {
        onSuccess: () => {
          setDeclineModalOpen(false)
          setDeclineReason('')
          void messageApi.success(t('approval-queue:messages.declined', { name: restaurant.name }))
        },
        onError,
      },
    )
  }

  const approvalActions = (
    <>
      <AppButton variant="danger" onClick={() => setDeclineModalOpen(true)}>
        <XCircle size={14} /> {t('approval-queue:actions.reject')}
      </AppButton>
      <AppButton variant="primary" onClick={() => setApproveModalOpen(true)}>
        <CheckCircle size={14} /> {t('approval-queue:actions.approve')}
      </AppButton>
    </>
  )

  const suspendWarning =
    activeBookingsCount && activeBookingsCount.count > 0
      ? t('restaurants:suspend.activeBookingsWarning', { count: activeBookingsCount.count })
      : undefined

  return (
    <div>
      {contextHolder}
      <RestaurantDetailHeader
        restaurant={restaurantRecord}
        isActive={isActive}
        platformStatusStyle={platformStatusStyle}
        visibilityStyle={visibilityStyle}
        isSuspended={isSuspended}
        // Approve/Reject only while PENDING. A REJECTED application's decision
        // is already made → no action buttons (empty fragment suppresses the
        // default live-restaurant Change Category / Suspend actions too).
        actions={isPending ? approvalActions : isApprovalMode ? <></> : undefined}
        onChangeCategoryClick={() => {
          setNewCategoryId(restaurant.category?.id ?? null)
          setChangeCatOpen(true)
        }}
        onSuspend={() => setSuspendModalOpen(true)}
        onReactivate={() => setUnsuspendModalOpen(true)}
      />

      {restaurant.status === 'REJECTED' && approvalDetail.data && (
        <AppDetailDeclinedBanner rejections={approvalDetail.data.rejections} />
      )}

      <RestaurantDetailTabs
        restaurant={restaurantRecord}
        restaurantId={id}
        hideRestrictedTabs={isApprovalMode}
        onDeleteReview={(review) => setDeleteReviewTarget(review)}
        hasReviewsAccess={hasReviewsAccess}
        t={t}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <ChangeCategoryModal
        open={changeCatOpen}
        onClose={() => {
          setChangeCatOpen(false)
          setNewCategoryId(null)
        }}
        onConfirm={handleCategoryConfirm}
        currentCategoryId={currentCategory?.id}
        newCategoryId={newCategoryId}
        onCategoryChange={setNewCategoryId}
        categoryOptions={categoryOptions}
        confirmLoading={changeCategoryMutation.isPending}
      />

      <RestaurantSuspendModal
        open={suspendModalOpen}
        restaurantName={restaurant.name}
        reason={suspendReason}
        onReasonChange={setSuspendReason}
        activeBookingsWarning={suspendWarning}
        confirmLoading={suspendMutation.isPending}
        onCancel={closeSuspendModal}
        onConfirm={handleConfirmSuspend}
      />

      <RestaurantUnsuspendModal
        open={unsuspendModalOpen}
        restaurantName={restaurant.name}
        confirmLoading={unsuspendMutation.isPending}
        onCancel={() => setUnsuspendModalOpen(false)}
        onConfirm={handleConfirmUnsuspend}
      />

      <DeleteReviewModal
        open={!!deleteReviewTarget}
        confirmLoading={deleteReviewMutation.isPending}
        onCancel={() => setDeleteReviewTarget(null)}
        onConfirm={handleConfirmDeleteReview}
      />

      <AppDetailApproveModal
        open={approveModalOpen}
        applicationName={restaurant.name}
        selectedCategory={approveCategoryId}
        categoryOptions={categoryOptions}
        loading={approveMutation.isPending}
        onCategoryChange={setApproveCategoryId}
        onCancel={() => {
          setApproveModalOpen(false)
          setApproveCategoryId(null)
        }}
        onConfirm={handleConfirmApprove}
      />

      <AppDetailDeclineModal
        open={declineModalOpen}
        applicationName={restaurant.name}
        declineReason={declineReason}
        loading={declineMutation.isPending}
        onReasonChange={setDeclineReason}
        onCancel={() => {
          setDeclineModalOpen(false)
          setDeclineReason('')
        }}
        onConfirm={handleConfirmDecline}
      />
    </div>
  )
}
