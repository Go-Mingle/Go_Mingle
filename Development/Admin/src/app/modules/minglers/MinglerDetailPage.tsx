import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { message } from 'antd'
import { ArrowLeft } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { MinglerIdentity } from './components/types'
import { HERO_STATUS_CONFIG } from './components/utils'
import { minglersService } from './services'
import {
  useSuspendMinglerMutation,
  useReactivateMinglerMutation,
  useActiveBookingsCountQuery,
  useSetProminglerMutation,
} from './hooks/useMinglersQuery'
import { MinglerHero } from './components/MinglerHero'
import { MinglerDetailTabs } from './components/MinglerDetailTabs'
import { SuspendModal } from './components/SuspendModal'
import { UnsuspendModal } from './components/UnsuspendModal'
import { HttpError } from '../../../shared/api/httpClient'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { hasCompositeAccess, getRoleFromUser } from '../../../shared/services/permissions'
import { useAppSelector } from '../../../shared/store/hooks'
import { LoadingState } from '../../molecules/LoadingState'

export function MinglerDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'overview'
  const handleTabChange = (key: string) => {
    const next = new URLSearchParams(searchParams)
    if (key === 'overview') next.delete('tab')
    else next.set('tab', key)
    setSearchParams(next, { replace: true })
  }
  const { t } = useTranslation('minglers')
  const [messageApi, contextHolder] = message.useMessage()

  const [suspendModal, setSuspendModal] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [unsuspendModal, setUnsuspendModal] = useState(false)

  const authUser = useAppSelector((s) => s.auth.user)
  const userRole = getRoleFromUser(authUser)
  const hasBookingsAccess = hasCompositeAccess(userRole, 'MANAGE_MINGLERS', 'BOOKINGS')
  const hasReviewsAccess = hasCompositeAccess(userRole, 'MANAGE_MINGLERS', 'REVIEWS')

  const { data: mingler, isLoading } = useQuery({
    queryKey: ['mingler', id],
    queryFn: () => minglersService.getById(id!),
    enabled: !!id,
  })
  const suspendMutation = useSuspendMinglerMutation()
  const reactivateMutation = useReactivateMinglerMutation()
  const setProminglerMutation = useSetProminglerMutation()
  const { data: activeBookingsCount } = useActiveBookingsCountQuery(id, suspendModal)

  if (isLoading) return <LoadingState label={t('status.loading', { ns: 'common' })} />
  if (!mingler) return null

  const minglerStatus = mingler.status
  const isActive = minglerStatus.toUpperCase() === 'ACTIVE'
  const heroCfg = HERO_STATUS_CONFIG[minglerStatus.toUpperCase()] ?? {
    bg: 'var(--color-badge-neutral)',
    label: minglerStatus,
  }

  const identity: MinglerIdentity | undefined = mingler.about
    ? {
        name: mingler.fullName,
        birthdate: mingler.about.birthdate,
        energyDrive: mingler.about.energyDrive,
        relationshipStatus: mingler.about.relationshipStatus,
        children: mingler.about.children != null ? String(mingler.about.children) : undefined,
        professionIndustry: mingler.about.professionIndustry,
        profession: mingler.about.profession,
        personalInterests: mingler.about.personalInterests
          ? mingler.about.personalInterests
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
          : undefined,
        footballTeam: mingler.about.footballTeam,
        pets: mingler.about.pets,
        budget: mingler.about.budget,
        enneagramType: mingler.about.enneagramType,
      }
    : undefined

  const handleConfirmSuspend = () => {
    if (!id || suspendReason.length < 10) return
    suspendMutation.mutate(
      { id, reason: suspendReason },
      {
        onSuccess: (result) => {
          setSuspendModal(false)
          setSuspendReason('')
          void messageApi.error(
            t('messages.suspended', { name: mingler.fullName, count: result.bookingsCancelled }),
          )
        },
        onError: (err) => {
          if (err instanceof HttpError && err.code === 'ERR_MINGLER_ALREADY_ACTIONED') {
            setSuspendModal(false)
            void messageApi.warning(t('messages.alreadyActioned'))
            return
          }
          void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))
        },
      },
    )
  }

  const handleConfirmUnsuspend = () => {
    if (!id) return
    reactivateMutation.mutate(
      { id },
      {
        onSuccess: () => {
          setUnsuspendModal(false)
          void messageApi.success(t('messages.reactivated', { name: mingler.fullName }))
        },
        onError: (err) => {
          if (err instanceof HttpError && err.code === 'ERR_MINGLER_ALREADY_ACTIONED') {
            setUnsuspendModal(false)
            void messageApi.warning(t('messages.alreadyActioned'))
            return
          }
          void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))
        },
      },
    )
  }

  const handleTogglePromingler = (next: boolean) => {
    if (!id) return
    setProminglerMutation.mutate(
      { id, isPromingler: next },
      {
        onSuccess: () => {
          void messageApi.success(t('messages.prominglerUpdated', { name: mingler.fullName }))
        },
        onError: (err) => {
          void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))
        },
      },
    )
  }

  return (
    <div>
      {contextHolder}

      <div
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 cursor-pointer mb-6 text-[var(--color-accent)] transition-colors duration-150 ease-out select-none hover:text-[var(--color-accent-dark)]"
      >
        <ArrowLeft size={15} weight="regular" />
        <span className="text-[13px] font-medium">{t('hero.backToMinglers')}</span>
      </div>

      <MinglerHero
        name={mingler.fullName}
        joined={mingler.joinedAt}
        phone={mingler.phone}
        avatarBg={mingler.avatarColor}
        avatarUrl={mingler.avatarUrl}
        initials={mingler.initials}
        heroCfg={heroCfg}
        isActive={isActive}
        isPromingler={mingler.isPromingler}
        onSuspend={() => {
          setSuspendReason('')
          setSuspendModal(true)
        }}
        onUnsuspend={() => setUnsuspendModal(true)}
      />

      <MinglerDetailTabs
        minglerId={mingler.id}
        name={mingler.fullName}
        email={mingler.email}
        phone={mingler.phone}
        joined={mingler.joinedAt}
        bookings={mingler.totalBookings}
        points={mingler.loyaltyPoints}
        identity={identity}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        hasBookingsAccess={hasBookingsAccess}
        hasReviewsAccess={hasReviewsAccess}
        isPromingler={mingler.isPromingler}
        onTogglePromingler={handleTogglePromingler}
        prominglerUpdating={setProminglerMutation.isPending}
      />

      <SuspendModal
        open={suspendModal}
        minglerName={mingler.fullName}
        suspendReason={suspendReason}
        activeBookingsCount={activeBookingsCount}
        onSuspendReasonChange={setSuspendReason}
        onCancel={() => {
          setSuspendModal(false)
          setSuspendReason('')
        }}
        onConfirm={handleConfirmSuspend}
        confirmLoading={suspendMutation.isPending}
      />

      <UnsuspendModal
        open={unsuspendModal}
        minglerName={mingler.fullName}
        onCancel={() => setUnsuspendModal(false)}
        onConfirm={handleConfirmUnsuspend}
        confirmLoading={reactivateMutation.isPending}
      />
    </div>
  )
}
