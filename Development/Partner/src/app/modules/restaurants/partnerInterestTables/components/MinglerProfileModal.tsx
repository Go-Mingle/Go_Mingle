import { Modal, Spin } from 'antd'
import { UserCircle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { MODAL_WIDTH } from '../../../../atoms/modalWidth'
import { StatusBadge } from '../../../../atoms/StatusBadge'
import { ProminglerBadge } from '../../../../molecules/ProminglerBadge'
import { displayServerDate } from '../../../../../shared/utils/formatting'
import { minglerStatusVariant, preferenceAnswers, prominglerBadge } from '../format'
import { useMinglerQuery } from '../hooks/usePartnerInterestTablesQueries'
import type { EatingPreference } from '../types'

/**
 * The Mingler profile modal (BR-10), opened from a name in Bookings or Invited.
 *
 * Two things this does **not** do:
 *
 * 1. It does not hardcode the eating-preference questions. The set comes from an
 *    admin-managed catalogue and changes, so the payload is an ordered
 *    `{ question, answers }[]` and is rendered by **iterating**. This is why the
 *    existing `MinglerEatingPreferencesTab` could not be reused — it names all seven
 *    questions and conditionally hides drinks behind an `alcohol === 'Yes'` check,
 *    both of which break the moment admin edits the catalogue.
 * 2. It shows no payment-card or loyalty data — none is returned, by design.
 *
 * A 404 renders "Profile unavailable" rather than an error: a partner may only view
 * Minglers with a booking or invite on one of their own tables, so an unreachable
 * profile is an expected outcome.
 */
export function MinglerProfileModal({
  minglerId,
  onClose,
}: {
  minglerId: string | null
  onClose: () => void
}) {
  const { t } = useTranslation(['restaurants', 'common'])
  const query = useMinglerQuery(minglerId)

  return (
    <Modal
      open={Boolean(minglerId)}
      onCancel={onClose}
      title={t('restaurants:partnerInterestTables.minglerModal.title')}
      footer={null}
      width={MODAL_WIDTH.large}
      destroyOnHidden
    >
      {query.isPending && (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      )}

      {query.isError && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <UserCircle size={32} className="text-[var(--color-text-subtle)]" />
          <p className="m-0 text-[14px] font-semibold text-[var(--color-text)]">
            {t('restaurants:partnerInterestTables.minglerModal.unavailable')}
          </p>
          <p className="m-0 text-[12.5px] text-[var(--color-text-muted)]">
            {t('restaurants:partnerInterestTables.minglerModal.unavailableHint')}
          </p>
        </div>
      )}

      {query.data && (
        <div>
          <div className="flex items-center gap-3 border-b border-[var(--color-divider)] pb-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-light)] text-[16px] font-bold text-[var(--color-accent)]">
              {query.data.fullName.trim().charAt(0).toUpperCase() || '?'}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[15px] font-bold text-[var(--color-text)]">
                  {query.data.fullName}
                </span>
                {prominglerBadge(query.data.proMinglerKind).show && (
                  <ProminglerBadge verified={prominglerBadge(query.data.proMinglerKind).verified} />
                )}
                <StatusBadge variant={minglerStatusVariant(query.data.accountStatus)} />
              </div>
              <p className="m-0 mt-0.5 text-[12.5px] text-[var(--color-text-muted)]">
                {/* Server-formatted; guarded so a missing/unusable value renders "—". */}
                {t('restaurants:partnerInterestTables.minglerModal.since', {
                  date: displayServerDate(query.data.minglerSince),
                })}
              </p>
            </div>
          </div>

          <PreferencesGrid preferences={query.data.eatingPreferences} />
        </div>
      )}
    </Modal>
  )
}

/**
 * The eating-preferences grid, rendered generically.
 *
 * Whatever questions the catalogue currently holds are what appear, in the order the
 * server sent them. An empty `answers` array renders "Not specified" — the server
 * sends the empty array and making it readable is the client's job.
 */
function PreferencesGrid({ preferences }: { preferences: EatingPreference[] }) {
  const { t } = useTranslation(['restaurants', 'common'])

  if (preferences.length === 0) {
    return (
      <p className="m-0 py-6 text-center text-[13px] text-[var(--color-text-muted)]">
        {t('restaurants:partnerInterestTables.minglerModal.noPreferences')}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 pt-4 md:grid-cols-2">
      {preferences.map((preference) => {
        const answers = preferenceAnswers(preference)
        return (
          <div key={preference.question}>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
              {preference.question}
            </p>
            <p
              className={`m-0 mt-0.5 text-[13px] ${
                answers ? 'text-[var(--color-text)]' : 'text-[var(--color-text-subtle)] italic'
              }`}
            >
              {answers ?? t('restaurants:partnerInterestTables.minglerModal.notSpecified')}
            </p>
          </div>
        )
      })}
    </div>
  )
}
