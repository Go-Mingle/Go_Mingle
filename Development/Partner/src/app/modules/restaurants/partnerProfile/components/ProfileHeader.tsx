import { Switch, Tooltip } from 'antd'
import { PencilSimple, Bank, Camera, PaperPlaneTilt, Storefront } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../../atoms/AppButton'
import { displayOr } from '../format'
import type { PartnerRestaurantProfile, RestaurantProfileStatus } from '../types'

const STATUS_STYLE: Record<RestaurantProfileStatus, string> = {
  DRAFT: 'bg-[var(--color-badge-neutral)]',
  PENDING: 'bg-[var(--color-warning)]',
  ACTIVE: 'bg-[var(--color-success)]',
  REJECTED: 'bg-[var(--color-error)]',
}

interface ProfileHeaderProps {
  profile: PartnerRestaurantProfile
  onEditName: () => void
  onOpenImage: () => void
  onOpenPayments: () => void
  onToggleVisibility: (next: boolean) => void
  onSubmit: () => void
  submitting: boolean
  saving: boolean
  launchingPayments: boolean
}

/**
 * The profile header (US-01).
 *
 * Affordances are state-dependent: Save as Draft appears in Draft and Rejected,
 * the visibility pill and toggle only in Active, and nothing is editable in
 * Pending. Send for Approval is the exception — it stays on screen in Pending,
 * disabled, because a partner who has just submitted is still looking at this
 * page. "Update Payment Info" stays available wherever the profile is editable,
 * since revising bank details is a normal Active-state action.
 */
export function ProfileHeader({
  profile,
  onEditName,
  onOpenImage,
  onOpenPayments,
  onToggleVisibility,
  onSubmit,
  submitting,
  saving,
  launchingPayments,
}: ProfileHeaderProps) {
  const { t } = useTranslation(['restaurants', 'common'])
  const { status, editable, submissionReadiness } = profile
  const isSetupState = status === 'DRAFT' || status === 'REJECTED'
  const isPending = status === 'PENDING'

  /** Why the submit button is disabled, or null when it is live. */
  const submitHint = (() => {
    if (isPending) return 'restaurants:profile.submitPendingHint'
    if (!submissionReadiness.canSubmit) return 'restaurants:profile.submitBlockedHint'
    return null
  })()

  return (
    <div className="mb-6 flex flex-col gap-4 rounded-[var(--radius-lg)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-sm)] md:mb-5 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 items-start gap-4 md:items-center">
        {/* Cover thumbnail — opens the Restaurant image modal (BR-08). */}
        <button
          type="button"
          onClick={onOpenImage}
          aria-label={t('restaurants:profile.coverAria')}
          className="relative shrink-0 rounded-[12px] border-none bg-transparent p-0 cursor-pointer"
        >
          {profile.coverPhotoUrl ? (
            <img
              src={profile.coverPhotoUrl}
              alt=""
              className="h-16 w-16 rounded-[12px] border border-[var(--color-border)] object-cover"
              loading="lazy"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-[12px] bg-[var(--color-accent-light)]">
              <Storefront size={26} className="text-[var(--color-accent)]" />
            </span>
          )}
          <span className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--color-card)] bg-[var(--color-accent)] text-white">
            <Camera size={14} weight="fill" />
          </span>
        </button>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Placeholders are driven off null, not empty string — a fresh
                Draft returns null for the name, shown muted like the source. */}
            <h1 className="m-0 truncate text-[22px] font-bold font-[var(--font-display)] leading-tight text-[var(--color-text)]">
              {profile.name ? (
                profile.name
              ) : (
                <span className="font-semibold text-[var(--color-text-subtle)]">
                  {t('restaurants:profile.namePlaceholder')}
                </span>
              )}
            </h1>
            <span
              className={`shrink-0 inline-flex h-[22px] items-center rounded-[4px] px-2 text-[12px] font-semibold text-white ${STATUS_STYLE[status]}`}
            >
              {t(`restaurants:profile.status.${status.toLowerCase()}`)}
            </span>
            {editable && (
              <button
                type="button"
                onClick={onEditName}
                aria-label={t('restaurants:profile.editNameAria')}
                className="shrink-0 border-none bg-transparent p-1 text-[var(--color-text-muted)] cursor-pointer md:hover:text-[var(--color-accent)]"
              >
                <PencilSimple size={16} />
              </button>
            )}
          </div>
          <div className="mt-1.5 truncate text-[14px] text-[var(--color-text-secondary)]">
            {displayOr(
              [profile.location.areaDistrict, profile.location.city].filter(Boolean).join(', '),
              t('restaurants:profile.locationPlaceholder'),
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:gap-3">
        {/* Visibility is Active-only (AC-08.3). */}
        {status === 'ACTIVE' && (
          <div className="inline-flex items-center gap-2.5 h-9 px-[14px] rounded-[12px] bg-[var(--color-card)] border-[1.5px] border-solid border-[var(--color-border-strong)]">
            <Switch
              checked={profile.visibleOnApp}
              disabled={saving}
              onChange={onToggleVisibility}
              aria-label={t('restaurants:profile.visibilityLabel')}
            />
            <span
              className={`text-[13px] font-medium whitespace-nowrap ${
                profile.visibleOnApp ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
              }`}
            >
              {t('restaurants:profile.visibilityLabel')}
            </span>
          </div>
        )}

        {editable && (
          <AppButton
            variant="secondary"
            onClick={onOpenPayments}
            disabled={launchingPayments}
            className="justify-center"
          >
            <Bank size={15} />
            {submissionReadiness.payoutConfigured
              ? t('restaurants:profile.updatePayments')
              : t('restaurants:profile.addPayoutAccount')}
          </AppButton>
        )}

        {/**
         * Pending keeps the button, disabled, rather than dropping it. A partner
         * who has just submitted is on this same page, and a control that
         * vanishes reads as a bug — a disabled one that says why reads as state.
         *
         * DEVIATION from J6A BR-03 / AC-01.4, which say Pending shows "no edit
         * actions": a deliberate product decision, not an oversight, taken when
         * the Pending holding screen was removed and Pending began landing here.
         * It needs a spec amendment. The button is inert either way — the guard
         * is server-side and a second submit answers 409 `ERR_INVALID_STATE`.
         */}
        {(isSetupState || isPending) && (
          <Tooltip title={submitHint ? t(submitHint) : ''}>
            <span>
              <AppButton
                variant="primary"
                onClick={onSubmit}
                disabled={isPending || !submissionReadiness.canSubmit || submitting}
                className="justify-center"
              >
                <PaperPlaneTilt size={15} weight="fill" />
                {t('restaurants:profile.sendForApproval')}
              </AppButton>
            </span>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
