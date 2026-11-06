import { Info, WarningCircle, Clock } from '@phosphor-icons/react'
import { Trans, useTranslation } from 'react-i18next'
import { displayProfileDate } from '../format'
import type { ProfileRejection, RestaurantProfileStatus, SubmitBlockedDetails } from '../types'

const BANNER_BASE = 'mb-5 flex items-start gap-2.5 rounded-[var(--radius-lg)] p-4'
const INFO_BANNER = `${BANNER_BASE} bg-[var(--color-accent-light)] text-[var(--color-accent-dark)]`
const ERROR_BANNER = `${BANNER_BASE} bg-[var(--color-error-bg)] text-[var(--color-error)]`

/**
 * Draft guidance (AC-01.2) — states plainly that only Overview gates submission,
 * so a partner does not think every tab must be filled first.
 */
export function DraftBanner() {
  return (
    <div className={INFO_BANNER}>
      <Info size={18} weight="fill" className="shrink-0 mt-px" />
      <div className="text-[13px] leading-relaxed">
        {/* `Trans` rather than `t`, so the two phrases the partner has to act on
            can carry weight without splitting the sentence into fragments — which
            would leave a translator reordering words they cannot see together. */}
        <Trans
          i18nKey="profile.banners.draft"
          ns="restaurants"
          components={{ b: <strong className="font-semibold" /> }}
        />
      </div>
    </div>
  )
}

/** Pending is read-only end to end (AC-01.4) — every write would 409. */
export function PendingBanner() {
  const { t } = useTranslation('restaurants')
  return (
    <div className={INFO_BANNER}>
      <Clock size={18} weight="fill" className="shrink-0 mt-px" />
      <div className="text-[13px] leading-relaxed">{t('profile.banners.pending')}</div>
    </div>
  )
}

/**
 * The decline history (BR-13) — every past reason with its date, newest first,
 * pinned while REJECTED and never naming the declining admin.
 */
export function RejectionHistory({ rejections }: { rejections: ProfileRejection[] }) {
  const { t } = useTranslation('restaurants')
  if (rejections.length === 0) return null

  return (
    <div className={ERROR_BANNER}>
      <WarningCircle size={18} weight="fill" className="shrink-0 mt-px" />
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">{t('profile.banners.rejectedTitle')}</div>
        <ul className="mt-1.5 m-0 flex list-none flex-col gap-1.5 p-0">
          {rejections.map((rejection, index) => (
            <li key={`${rejection.rejectedAt}-${index}`} className="text-[12.5px] leading-relaxed">
              <span>{rejection.reason}</span>
              <span className="ml-1.5 opacity-80">
                · {displayProfileDate(rejection.rejectedAt)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * The submission gate's blockers (BR-09), rendered together.
 *
 * All three arrive in one 422 precisely so the partner sees everything standing
 * between them and submission at once, rather than discovering them one submit
 * at a time.
 */
export function SubmitBlockers({ blockers }: { blockers: SubmitBlockedDetails | null }) {
  const { t } = useTranslation('restaurants')
  if (!blockers) return null

  const missing = blockers.missingFields ?? []

  return (
    <div className={ERROR_BANNER} role="alert">
      <WarningCircle size={18} weight="fill" className="shrink-0 mt-px" />
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">{t('profile.blockers.title')}</div>
        <ul className="mt-1.5 m-0 flex list-none flex-col gap-1 p-0 text-[12.5px]">
          {missing.length > 0 && (
            <li>
              {t('profile.blockers.missingFields', {
                fields: missing.map((field) => t(`profile.fields.${field}`, field)).join(', '),
              })}
            </li>
          )}
          {blockers.needsPayout && <li>{t('profile.blockers.needsPayout')}</li>}
          {blockers.needsCoverPhoto && <li>{t('profile.blockers.needsCoverPhoto')}</li>}
        </ul>
      </div>
    </div>
  )
}

interface ProfileBannersProps {
  status: RestaurantProfileStatus | undefined
  rejections: ProfileRejection[]
  blockers: SubmitBlockedDetails | null
}

/** The state-dependent banner stack above the tab strip. */
export function ProfileBanners({ status, rejections, blockers }: ProfileBannersProps) {
  return (
    <>
      {status === 'REJECTED' && <RejectionHistory rejections={rejections} />}
      {status === 'PENDING' && <PendingBanner />}
      {(status === 'DRAFT' || status === 'REJECTED') && <DraftBanner />}
      <SubmitBlockers blockers={blockers} />
    </>
  )
}
