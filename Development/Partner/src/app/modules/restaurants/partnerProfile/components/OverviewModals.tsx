import { Input, Modal, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../../atoms/AppButton'
import { LocationMapPicker } from './LocationMapPicker'
import { PROFILE_LIMITS } from '../constants'
import type { useOverviewCards } from '../hooks/useOverviewCards'

type Cards = ReturnType<typeof useOverviewCards>

const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]'
const FIELD_ERROR = 'mt-1 text-[12px] text-[var(--color-error)]'

/**
 * One labelled field.
 *
 * `error` carries either a client-side validation message or a mapped
 * `details.fields` entry from a 422 — the same renderer serves both, so a
 * server-only rule points at its input rather than only raising a toast.
 */
export function LabelledInput({
  label,
  value,
  onChange,
  maxLength,
  textarea,
  placeholder,
  error,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  maxLength?: number
  textarea?: boolean
  placeholder?: string
  error?: string
}) {
  const Control = textarea ? Input.TextArea : Input
  return (
    <div>
      <div className={LABEL}>{label}</div>
      <Control
        size="large"
        className="mt-2"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        status={error ? 'error' : undefined}
        aria-label={label}
        rows={textarea ? 3 : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <p className={FIELD_ERROR}>{error}</p>}
    </div>
  )
}

export function ModalFooter({
  onCancel,
  onSave,
  saving,
  blocked,
}: {
  onCancel: () => void
  onSave: () => void
  saving: boolean
  /** True while the card holds errors. Editing any field clears them. */
  blocked?: boolean
}) {
  const { t } = useTranslation('common')
  return (
    <div className="app-modal-footer">
      <AppButton variant="neutral" onClick={onCancel}>
        {t('buttons.cancel')}
      </AppButton>
      {/* Safe to disable because the controller's setters clear the card's errors
          on any edit — the first keystroke re-enables Save, so a corrected form
          can never deadlock behind a stale error. */}
      <AppButton variant="primary" onClick={onSave} disabled={saving || blocked}>
        {t('buttons.save')}
      </AppButton>
    </div>
  )
}

/**
 * The four per-card edit modals (AC-04.2).
 *
 * Restaurant Details holds only Cuisine and Description — no Name (that is the
 * header modal), no Category (admin-assigned), and no Business Registration or
 * Seating (dropped from the partner UI).
 *
 * Cuisine is a plain text input: there is no cuisine catalogue anywhere on the
 * platform, and the spec's earlier "single-select from the admin cuisine list"
 * described a picker that was never specced (BR-06a).
 */
export function OverviewModals({ cards }: { cards: Cards }) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <>
      <Modal
        open={cards.openCard === 'details'}
        onCancel={cards.closeCard}
        title={t('restaurants:profile.overview.details')}
        footer={null}
        width={520}
        destroyOnHidden
      >
        <div className="mt-3 flex flex-col gap-4">
          <LabelledInput
            label={t('restaurants:profile.fields.cuisine')}
            value={cards.details.cuisine}
            maxLength={PROFILE_LIMITS.cuisine}
            placeholder={t('restaurants:profile.overview.cuisinePlaceholder')}
            error={cards.errors.cuisine}
            onChange={(cuisine) => cards.setDetails({ ...cards.details, cuisine })}
          />
          <LabelledInput
            label={t('restaurants:profile.fields.description')}
            value={cards.details.description}
            maxLength={PROFILE_LIMITS.description}
            textarea
            error={cards.errors.description}
            onChange={(description) => cards.setDetails({ ...cards.details, description })}
          />
        </div>
        <ModalFooter
          onCancel={cards.closeCard}
          onSave={cards.saveDetails}
          saving={cards.saving}
          blocked={cards.blocked}
        />
      </Modal>

      <Modal
        open={cards.openCard === 'location'}
        onCancel={cards.closeCard}
        title={t('restaurants:profile.overview.location')}
        footer={null}
        width={520}
        destroyOnHidden
      >
        <div className="mt-3 flex flex-col gap-4">
          <LabelledInput
            label={t('restaurants:profile.fields.fullAddress')}
            value={cards.location.fullAddress}
            maxLength={PROFILE_LIMITS.fullAddress}
            textarea
            error={cards.errors.fullAddress}
            onChange={(fullAddress) => cards.setLocation({ ...cards.location, fullAddress })}
          />
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <LabelledInput
                label={t('restaurants:profile.fields.areaDistrict')}
                value={cards.location.areaDistrict}
                maxLength={PROFILE_LIMITS.areaDistrict}
                error={cards.errors.areaDistrict}
                onChange={(areaDistrict) => cards.setLocation({ ...cards.location, areaDistrict })}
              />
            </div>
            <div className="flex-1">
              <LabelledInput
                label={t('restaurants:profile.fields.city')}
                value={cards.location.city}
                maxLength={PROFILE_LIMITS.city}
                error={cards.errors.city}
                onChange={(city) => cards.setLocation({ ...cards.location, city })}
              />
            </div>
          </div>

          {/* The map position (BR-09a). Was two numeric inputs, which asked the
              partner to know their own coordinates; both axes now move together
              from a search or a marker drag. */}
          <LocationMapPicker
            latitude={cards.location.latitude}
            longitude={cards.location.longitude}
            error={cards.errors.latitude ?? cards.errors.longitude}
            onChange={(latitude, longitude) =>
              cards.setLocation({ ...cards.location, latitude, longitude })
            }
          />

          {/* Paired on one row, as the design has them — they stack below md. */}
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <LabelledInput
                label={t('restaurants:profile.fields.restaurantPhone')}
                value={cards.location.phone}
                placeholder="+923001234567"
                error={cards.errors.phone}
                onChange={(phone) => cards.setLocation({ ...cards.location, phone })}
              />
            </div>
            <div className="flex-1">
              <LabelledInput
                label={t('restaurants:profile.fields.restaurantEmail')}
                value={cards.location.email}
                error={cards.errors.email}
                onChange={(email) => cards.setLocation({ ...cards.location, email })}
              />
            </div>
          </div>
          <LabelledInput
            label={t('restaurants:profile.fields.website')}
            value={cards.location.website}
            error={cards.errors.website}
            onChange={(website) => cards.setLocation({ ...cards.location, website })}
          />
        </div>
        <ModalFooter
          onCancel={cards.closeCard}
          onSave={cards.saveLocation}
          saving={cards.saving}
          blocked={cards.blocked}
        />
      </Modal>

      <Modal
        open={cards.openCard === 'owner'}
        onCancel={cards.closeCard}
        title={t('restaurants:profile.overview.owner')}
        footer={null}
        width={480}
        destroyOnHidden
      >
        <div className="mt-3 flex flex-col gap-4">
          <LabelledInput
            label={t('restaurants:profile.fields.ownerName')}
            value={cards.owner.name}
            maxLength={PROFILE_LIMITS.ownerName}
            error={cards.errors.name}
            onChange={(name) => cards.setOwner({ ...cards.owner, name })}
          />
          <LabelledInput
            label={t('restaurants:profile.fields.ownerEmail')}
            value={cards.owner.email}
            error={cards.errors.email}
            onChange={(email) => cards.setOwner({ ...cards.owner, email })}
          />
          <LabelledInput
            label={t('restaurants:profile.fields.ownerPhone')}
            value={cards.owner.phone}
            placeholder="+923001234567"
            error={cards.errors.phone}
            onChange={(phone) => cards.setOwner({ ...cards.owner, phone })}
          />
        </div>
        <ModalFooter
          onCancel={cards.closeCard}
          onSave={cards.saveOwner}
          saving={cards.saving}
          blocked={cards.blocked}
        />
      </Modal>

      <Modal
        open={cards.openCard === 'rules'}
        onCancel={cards.closeCard}
        title={t('restaurants:profile.overview.rules')}
        footer={null}
        width={520}
        destroyOnHidden
      >
        <div className="mt-3 flex flex-col gap-4">
          <LabelledInput
            label={t('restaurants:profile.fields.houseRules')}
            value={cards.rules.houseRules}
            maxLength={PROFILE_LIMITS.houseRules}
            textarea
            error={cards.errors.houseRules}
            onChange={(houseRules) => cards.setRules({ ...cards.rules, houseRules })}
          />
          <LabelledInput
            label={t('restaurants:profile.fields.dressCode')}
            value={cards.rules.dressCode}
            maxLength={PROFILE_LIMITS.dressCode}
            error={cards.errors.dressCode}
            onChange={(dressCode) => cards.setRules({ ...cards.rules, dressCode })}
          />
          <div>
            <div className={LABEL}>{t('restaurants:profile.fields.servesAlcohol')}</div>
            <Select
              size="large"
              className="mt-2 w-full"
              value={cards.rules.servesAlcohol}
              placeholder={t('restaurants:profile.overview.selectOne')}
              onChange={(servesAlcohol) => cards.setRules({ ...cards.rules, servesAlcohol })}
              options={[
                { value: true, label: t('restaurants:profile.overview.yes') },
                { value: false, label: t('restaurants:profile.overview.no') },
              ]}
            />
          </div>
        </div>
        <ModalFooter
          onCancel={cards.closeCard}
          onSave={cards.saveRules}
          saving={cards.saving}
          blocked={cards.blocked}
        />
      </Modal>
    </>
  )
}
