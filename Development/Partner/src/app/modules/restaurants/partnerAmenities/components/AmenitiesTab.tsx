import { useState } from 'react'
import { Alert, Spin, Switch } from 'antd'
import { MagnifyingGlass, Sparkle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import type { CatalogueAmenity } from '../types'
import type { useAmenitiesTab } from '../hooks/useAmenitiesTab'

type Amenities = ReturnType<typeof useAmenitiesTab>

/**
 * The catalogue icon.
 *
 * Icons are admin-managed CDN assets, and the spec's own Deltas flag the icon
 * domain as unconfirmed — so a URL that fails to load is a realistic outcome, not
 * an edge case. Falling back to a glyph keeps the row readable instead of leaving
 * a blank square.
 */
function AmenityIcon({ amenity }: { amenity: CatalogueAmenity }) {
  const [broken, setBroken] = useState(false)

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-[var(--color-accent-light)] text-[var(--color-accent)]">
      {amenity.iconUrl && !broken ? (
        <img
          src={amenity.iconUrl}
          alt=""
          className="h-[20px] w-[20px]"
          onError={() => setBroken(true)}
        />
      ) : (
        <Sparkle size={20} />
      )}
    </div>
  )
}

/**
 * The Amenities tab (US-01).
 *
 * Save-on-toggle — each flip is its own write, applied optimistically, with no
 * Save button and no dirty-state buffer (AC-01.4). Search filters the list
 * already held and issues no request (BR-08).
 */
export function AmenitiesTab({ c }: { c: Amenities }) {
  const { t } = useTranslation(['restaurants', 'common'])

  if (c.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    )
  }

  if (c.isError) {
    return (
      <Alert type="error" message={getApiErrorMessage(c.error, t('common:errors.fetchError'))} />
    )
  }

  return (
    <div className="pt-1">
      <div className="relative mb-4">
        <MagnifyingGlass
          size={17}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]"
        />
        <input
          value={c.search}
          onChange={(event) => c.applySearch(event.target.value)}
          placeholder={t('restaurants:partnerAmenities.searchPlaceholder')}
          aria-label={t('restaurants:partnerAmenities.searchPlaceholder')}
          className="h-12 w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-card)] pl-11 pr-4 text-[14px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="border-b border-[var(--color-border)] bg-[var(--color-hover-neutral)] px-5 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            {t('restaurants:partnerAmenities.columnHeader')}
          </span>
        </div>

        {c.amenities.map((amenity) => (
          <div
            key={amenity.amenityId}
            className="flex items-center gap-3 border-b border-[var(--color-divider)] px-5 py-3.5 last:border-b-0"
          >
            <AmenityIcon amenity={amenity} />
            <span className="min-w-0 flex-1 text-[14px] font-medium text-[var(--color-text)]">
              {amenity.name}
            </span>
            {/* Disabled while under review rather than left to 409 (BR-07). */}
            <Switch
              checked={amenity.selected}
              disabled={!c.editable}
              onChange={(next) => c.toggle(amenity, next)}
              aria-label={amenity.name}
            />
          </div>
        ))}

        {c.amenities.length === 0 && (
          <div className="px-5 py-8 text-center text-[13px] text-[var(--color-text-muted)]">
            {/* An empty catalogue and a search that matched nothing are
                different situations, and the copy should say which. */}
            {c.totalCount === 0
              ? t('restaurants:partnerAmenities.empty')
              : t('restaurants:partnerAmenities.noMatch')}
          </div>
        )}
      </div>
    </div>
  )
}
