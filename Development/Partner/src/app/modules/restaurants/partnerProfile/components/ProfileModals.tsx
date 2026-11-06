import { Alert, Modal, Tooltip } from 'antd'
import { Info, Storefront } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../../atoms/AppButton'
import { ConfirmModal } from '../../../../molecules/ConfirmModal'
import { PROFILE_LIMITS } from '../constants'
import type { useProfilePage } from '../hooks/useProfilePage'
import { LabelledInput, ModalFooter } from './OverviewModals'

type ProfileController = ReturnType<typeof useProfilePage>

/** Name and location are edited in a modal, not inline (BR-07). */
export function NameLocationModal({ c }: { c: ProfileController }) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <Modal
      open={c.nameOpen}
      onCancel={c.closeNameModal}
      title={t('restaurants:profile.nameModal.title')}
      footer={null}
      width="auto"
      destroyOnHidden
    >
      <div className="mt-3 flex flex-col gap-4">
        <LabelledInput
          label={t('restaurants:profile.nameModal.name')}
          value={c.nameForm.name}
          maxLength={PROFILE_LIMITS.name}
          error={c.nameErrors.name}
          onChange={(name) => c.setNameForm({ ...c.nameForm, name })}
        />
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="flex-1">
            <LabelledInput
              label={t('restaurants:profile.nameModal.area')}
              value={c.nameForm.areaDistrict}
              maxLength={PROFILE_LIMITS.areaDistrict}
              error={c.nameErrors.areaDistrict}
              onChange={(areaDistrict) => c.setNameForm({ ...c.nameForm, areaDistrict })}
            />
          </div>
          <div className="flex-1">
            <LabelledInput
              label={t('restaurants:profile.nameModal.city')}
              value={c.nameForm.city}
              maxLength={PROFILE_LIMITS.city}
              error={c.nameErrors.city}
              onChange={(city) => c.setNameForm({ ...c.nameForm, city })}
            />
          </div>
        </div>
      </div>

      <ModalFooter
        onCancel={c.closeNameModal}
        onSave={c.saveNameLocation}
        saving={c.saving}
        blocked={c.nameBlocked}
      />
    </Modal>
  )
}

/**
 * The Restaurant image modal (BR-08).
 *
 * The cover photo is not editable here. J6B owns photo upload and cover
 * designation, and there is deliberately no separate cover store — the cover is
 * whichever photo `main_photo_key` points at — so this previews the current
 * cover and sends the partner to the gallery to change it. Uploading a first
 * photo there is also what lifts the submission gate.
 *
 * DEVIATION from J6A BR-08, which specifies "a Replace image action (JPEG/PNG,
 * max 5 MB)" in this modal (MET-1251). There is no file input here by design,
 * and the omission is asserted in the tests so it cannot be "fixed" by
 * accident. A second upload path would be a second writer of one field, with no
 * store of its own to write to, and it would duplicate the type/size rules J6B
 * already enforces against the server-reported limit. **BR-08 is what needs
 * amending**, along with its four cases: 016 retires, and 017/018/019 move to
 * the J6B suite, where they now live beside the rules they check.
 *
 * The 5 MB in BR-08 also contradicts J6B BR-05, which puts photos at 10 MB and
 * config-driven per environment. J6B's reading is the one implemented: the
 * client checks against the `maxBytes` step 1 reports, so neither number is
 * hardcoded here or there. Still open for the spec owners.
 */
export function RestaurantImageModal({ c }: { c: ProfileController }) {
  const { t } = useTranslation(['restaurants', 'common'])
  const coverUrl = c.profile?.coverPhotoUrl

  return (
    <Modal
      open={c.imageOpen}
      onCancel={c.closeImageModal}
      title={
        <span className="inline-flex items-center gap-2">
          {t('restaurants:profile.imageModal.title')}
          <Tooltip title={t('restaurants:profile.imageModal.managedInPhotos')}>
            <button
              type="button"
              aria-label={t('restaurants:profile.imageModal.managedInPhotos')}
              className="inline-flex items-center border-none bg-transparent p-0 text-[var(--color-text-muted)] cursor-help md:hover:text-[var(--color-accent)]"
            >
              <Info size={15} />
            </button>
          </Tooltip>
        </span>
      }
      footer={null}
      width={480}
      destroyOnHidden
    >
      {/* The image gets the whole modal: no fixed frame, no crop, no footer. It
          is capped against the viewport rather than given a ratio, so landscape
          and portrait both render whole. The dialog's own X closes it. */}
      <div className="mt-3 flex items-center justify-center">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="max-h-[70vh] max-w-full w-auto rounded-[10px] object-contain"
          />
        ) : (
          <div className="flex h-[220px] w-[320px] flex-col items-center justify-center gap-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-page)] text-[var(--color-text-subtle)]">
            <Storefront size={28} />
            <span className="text-[12.5px]">{t('restaurants:profile.imageModal.none')}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}

/**
 * "Set up payments" / "Update payment info" (US-06).
 *
 * Titled from `paymentConfigured` rather than the response's `mode`: the server
 * picks the same branch from the same fact, and `mode` only arrives on the
 * response that immediately redirects to Safepay — far too late to title a modal
 * the partner is already looking at.
 *
 * The copy says GoMingle — the Figma renders "GoMingle Uses Safepay",
 * which the spec flags as the highest-priority copy fix because it ships in the
 * build rather than being a logo asset.
 *
 * A failed hand-off keeps this dialog open and says so (MET-1254). It used to
 * close the moment Proceed was pressed, which read as success even when the
 * onboarding endpoint answered 502 and the partner went nowhere.
 */
export function SetUpPaymentsModal({ c }: { c: ProfileController }) {
  const { t } = useTranslation(['restaurants', 'common'])
  const updating = c.profile?.paymentConfigured === true
  const failed = !!c.paymentsError

  return (
    <Modal
      open={c.paymentsOpen}
      onCancel={c.closePayments}
      title={t(
        updating
          ? 'restaurants:profile.paymentsModal.updateTitle'
          : 'restaurants:profile.paymentsModal.title',
      )}
      footer={null}
      width={480}
      destroyOnHidden
    >
      <p className="mt-2 mb-0 text-[13px] leading-relaxed text-[var(--color-text-muted)]">
        {t(
          updating
            ? 'restaurants:profile.paymentsModal.updateBody'
            : 'restaurants:profile.paymentsModal.body',
        )}
      </p>

      {/* Anchored between the explanation and the button that failed, so the
          reason sits where the partner is already looking. `role="alert"` because
          it appears without the focus moving — the same treatment as J6B's
          upload dialog. */}
      {failed ? (
        <Alert
          type="error"
          showIcon
          role="alert"
          className="mt-4 text-[13px]"
          message={c.paymentsError}
        />
      ) : null}

      <div className="app-modal-footer">
        <AppButton variant="neutral" onClick={c.closePayments}>
          {t('common:buttons.cancel')}
        </AppButton>
        {/* Still enabled after a failure: minting is retryable, and the dialog
            staying open is only useful if there is a way to try again. */}
        <AppButton variant="primary" onClick={c.launchPayments} disabled={c.launchingPayments}>
          {failed ? t('common:buttons.retry') : t('restaurants:profile.paymentsModal.proceed')}
        </AppButton>
      </div>
    </Modal>
  )
}

/**
 * Shown after Safepay hands the partner back.
 *
 * `paymentConfigured` can still be false here — it only flips when Safepay's
 * `account.updated` webhook lands, which can lag by seconds to minutes, or never
 * if verification is incomplete. So this reads as "verifying", never "failed",
 * polls for a bounded while, and always offers a manual re-check rather than
 * leaving a page reload as the only way forward.
 */
export function PaymentsReturnNotice({ c }: { c: ProfileController }) {
  const { t } = useTranslation(['restaurants', 'common'])
  if (c.paymentsReturnState !== 'returned') return null

  const configured = c.profile?.paymentConfigured === true

  return (
    <Alert
      type={configured ? 'success' : 'info'}
      className="mb-5"
      closable
      onClose={c.dismissPaymentsReturn}
      message={
        configured
          ? t('restaurants:profile.payments.configured')
          : t('restaurants:profile.payments.verifying')
      }
      action={
        configured ? undefined : (
          <AppButton variant="neutral" onClick={c.checkPaymentsAgain} disabled={c.checkingPayments}>
            {t(
              c.checkingPayments
                ? 'restaurants:profile.payments.checking'
                : 'restaurants:profile.payments.checkAgain',
            )}
          </AppButton>
        )
      }
    />
  )
}

/**
 * Confirms a submission (AC-07.2).
 *
 * A dialog rather than a toast because submitting no longer moves the partner
 * anywhere: the page they are looking at silently turns read-only, its actions
 * disable and the pending banner appears. A toast that fades leaves that reading
 * as "something broke", so the acknowledgement is something they dismiss.
 */
export function SubmittedModal({ c }: { c: ProfileController }) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <ConfirmModal
      open={c.submittedMessage !== null}
      onCancel={c.dismissSubmitted}
      // Single-button informational layout; there is nothing to confirm.
      onConfirm={c.dismissSubmitted}
      singleButton
      title={t('restaurants:profile.submittedTitle')}
      // The server authors this copy, so it is shown as sent; the fallback covers
      // a 200 that omits it.
      content={c.submittedMessage ?? t('restaurants:profile.submittedBody')}
    />
  )
}
