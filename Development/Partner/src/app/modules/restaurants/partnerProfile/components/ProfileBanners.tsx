import { Info, WarningCircle, Clock } from '@phosphor-icons/react'
import { Trans, useTranslation } from 'react-i18next'
import { displayProfileDate } from '../format'
import type {
  ProfileRejection,
  RestaurantProfileStatus,
  SubmissionReadiness,
  SubmitBlockedDetails,
} from '../types'

const BANNER_BASE = 'mb-5 flex items-start gap-2.5 rounded-[var(--radius-lg)] p-4'
const INFO_BANNER = `${BANNER_BASE} bg-[var(--color-accent-light)] text-[var(--color-accent-dark)]`
const ERROR_BANNER = `${BANNER_BASE} bg-[var(--color-error-bg)] text-[var(--color-error)]`
const WARN_BANNER = `${BANNER_BASE} bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] text-[var(--color-warning)]`

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
export function SubmitBlockers({
  blockers,
  checklist = false,
}: {
  blockers: SubmitBlockedDetails | null
  /** True when shown up front from the server's readiness, before any submit. */
  checklist?: boolean
}) {
  const { t } = useTranslation('restaurants')
  if (!blockers) return null

  const missing = blockers.missingFields ?? []

  return (
    <div className={checklist ? WARN_BANNER : ERROR_BANNER} role={checklist ? 'status' : 'alert'}>
      <WarningCircle size={18} weight="fill" className="shrink-0 mt-px" />
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">
          {t(checklist ? 'profile.blockers.checklistTitle' : 'profile.blockers.title')}
        </div>
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
  readiness?: SubmissionReadiness
}

/**
 * What still stands between a draft and "Send for Approval", taken from the
 * server's readiness. Without it a disabled button gave no reason at all: the
 * blocker list only ever appeared after a failed submit, which a disabled
 * button can never make.
 */
function readinessBlockers(readiness: SubmissionReadiness | undefined): SubmitBlockedDetails | null {
  if (!readiness || readiness.canSubmit) return null
  return {
    missingFields: readiness.missingFields,
    needsPayout: !readiness.payoutConfigured,
    needsCoverPhoto: !readiness.hasCoverPhoto,
  }
}

/** The state-dependent banner stack above the tab strip. */
export function ProfileBanners({ status, rejections, blockers, readiness }: ProfileBannersProps) {
  const editableDraft = status === 'DRAFT' || status === 'REJECTED'
  const checklist = !blockers && editableDraft ? readinessBlockers(readiness) : null
  return (
    <>
      {status === 'REJECTED' && <RejectionHistory rejections={rejections} />}
      {status === 'PENDING' && <PendingBanner />}
      {editableDraft && <DraftBanner />}
      {blockers ? <SubmitBlockers blockers={blockers} /> : <SubmitBlockers blockers={checklist} checklist />}
    </>
  )
}
