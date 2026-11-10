import type { ReactNode } from 'react'
import {
  Article,
  City,
  CoatHanger,
  Envelope,
  ForkKnife,
  Globe,
  Info,
  MapPin,
  MapTrifold,
  NavigationArrow,
  Percent,
  Phone,
  Plus,
  User,
  Wine,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../../atoms/AppButton'
import { LabelTag } from '../../../../atoms/LabelTag'
import { OverviewField } from '../../components/OverviewField'
import { TabEmptyState } from '../../components/TabEmptyState'
import { SectionCard } from '../../restaurantDetail.utils'
import { formatPhoneForDisplay, hasProfileValue } from '../format'
import type { PartnerRestaurantProfile } from '../types'
import type { OverviewCard, useOverviewCards } from '../hooks/useOverviewCards'

/**
 * Zero row gap — the row rhythm comes from `OverviewField`'s own `py-2.5`, so a
 * row gap here would double it.
 */
const FIELD_GRID = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-0'
const LINK = 'text-[var(--color-accent)] no-underline'

/** Neutral, non-negative placeholder for a value the partner has not added yet. */
function NotProvided({ label }: { label: string }) {
  return (
    <span
      aria-label={label}
      className="text-[14px] text-[var(--color-text-subtle)] font-[Poppins,sans-serif]"
    >
      —
    </span>
  )
}

function textOr(value: string | null | undefined, notProvided: string): ReactNode {
  return hasProfileValue(value) ? value : <NotProvided label={notProvided} />
}

/**
 * What "View on map" should point at.
 *
 * The dropped pin wins when there is one: it is the exact position the partner
 * chose, where the written address is prose a geocoder has to guess at. Falls back
 * to the address so the link still works for a profile that predates the picker,
 * and returns null when there is neither, so the link is not rendered at all.
 *
 * `!== null` rather than a truthiness check: 0 is a legal coordinate on both axes.
 */
function mapQueryFor(location: PartnerRestaurantProfile['location']): string | null {
  const { latitude, longitude, fullAddress } = location
  if (latitude !== null && longitude !== null) return `${String(latitude)},${String(longitude)}`
  return hasProfileValue(fullAddress) ? (fullAddress as string) : null
}

/** A website may or may not arrive with a scheme; never emit `https://https://…`. */
function websiteHref(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`
}

interface OverviewCardShellProps {
  title: string
  filled: boolean
  editable: boolean
  onEdit: () => void
  /** Icon + copy for the rich empty state shown while the card is unfilled. */
  emptyIcon: Icon
  emptyTitle: string
  emptyDescription: string
  emptyAction: string
  /** True when a failed submit named a field this card owns (AC-07.3). */
  needsAttention?: boolean
  children: ReactNode
}

/**
 * One Overview card. In Draft an unfilled card shows a centered empty state — an
 * icon, a title, a short description and a filled "Add …" action — rather than a
 * grid of dashes (AC-04.1), matching the design's first-time prompt.
 */
function OverviewCardShell({
  title,
  filled,
  editable,
  onEdit,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  needsAttention,
  children,
}: OverviewCardShellProps) {
  const { t } = useTranslation('restaurants')

  return (
    <SectionCard
      title={title}
      className={needsAttention ? 'border border-[var(--color-warning-border)]' : undefined}
      titleSuffix={
        needsAttention ? (
          // The banner names the missing fields; this says which card to open.
          <span className="ml-2 align-middle text-[11px] font-semibold normal-case text-[var(--color-warning)]">
            {t('profile.overview.needsAttention')}
          </span>
        ) : undefined
      }
      editAriaLabel={t('profile.overview.editAria', { card: title })}
      onEdit={editable && filled ? onEdit : undefined}
    >
      {filled ? (
        children
      ) : (
        <TabEmptyState
          compact
          IconComp={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={
            editable ? (
              <AppButton variant="primary" onClick={onEdit}>
                <Plus size={15} weight="bold" />
                {emptyAction}
              </AppButton>
            ) : undefined
          }
        />
      )}
    </SectionCard>
  )
}

interface CardBodyProps {
  profile: PartnerRestaurantProfile
  notProvided: string
}

/**
 * Cuisine and Description are the partner's; Category and Commission render
 * read-only beside them because they are admin-assigned at approval (BR-05).
 */
function DetailsBody({ profile, notProvided }: CardBodyProps) {
  const { t } = useTranslation('restaurants')

  return (
    <div>
      {/* Description spans the full width; the rest sit in the row below. On
          mobile everything stacks in the same order. */}
      <OverviewField
        IconComp={Article}
        label={t('profile.fields.description')}
        value={
          hasProfileValue(profile.description) ? (
            <span className="whitespace-pre-wrap leading-[1.6]">{profile.description}</span>
          ) : (
            <NotProvided label={notProvided} />
          )
        }
      />
      <div className={FIELD_GRID}>
        <OverviewField
          IconComp={Percent}
          label={t('profile.fields.commission')}
          value={
            profile.commissionPercent != null ? (
              t('overview.commissionPercent', { pct: profile.commissionPercent })
            ) : (
              <div className="flex flex-col gap-[3px]">
                <LabelTag>{t('overview.commissionPending')}</LabelTag>
                <span className="text-[11px] text-[var(--color-text-subtle)] font-[Poppins,sans-serif] leading-[1.4]">
                  {t('overview.commissionPendingHint')}
                </span>
              </div>
            )
          }
        />
        {/* Free text — there is no cuisine catalogue on the platform (BR-06a). */}
        <OverviewField
          IconComp={ForkKnife}
          label={t('profile.fields.cuisine')}
          value={textOr(profile.cuisine, notProvided)}
        />
      </div>
    </div>
  )
}

function LocationBody({ profile, notProvided }: CardBodyProps) {
  const { t } = useTranslation('restaurants')
  const { fullAddress } = profile.location
  const { phone, email, website } = profile.restaurant
  const mapQuery = mapQueryFor(profile.location)

  return (
    <div className={FIELD_GRID}>
      <OverviewField
        IconComp={MapPin}
        label={t('profile.fields.fullAddress')}
        value={
          <div className="flex flex-col items-start gap-1">
            {textOr(fullAddress, notProvided)}
            {mapQuery ? (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(mapQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 text-[12px] font-medium font-[Poppins,sans-serif] ${LINK}`}
              >
                <NavigationArrow size={13} color="var(--color-accent)" />
                {t('overview.fields.viewOnMap')}
              </a>
            ) : null}
          </div>
        }
      />
      <OverviewField
        IconComp={MapTrifold}
        label={t('profile.fields.areaDistrict')}
        value={textOr(profile.location.areaDistrict, notProvided)}
      />
      <OverviewField
        IconComp={City}
        label={t('profile.fields.city')}
        value={textOr(profile.location.city, notProvided)}
      />
      {/* Stored compact E.164; grouped for display only. */}
      <OverviewField
        IconComp={Phone}
        label={t('profile.fields.restaurantPhone')}
        value={textOr(formatPhoneForDisplay(phone), notProvided)}
      />
      <OverviewField
        IconComp={Envelope}
        label={t('profile.fields.restaurantEmail')}
        value={
          hasProfileValue(email) ? (
            <a href={`mailto:${email}`} className={LINK}>
              {email}
            </a>
          ) : (
            <NotProvided label={notProvided} />
          )
        }
      />
      <OverviewField
        IconComp={Globe}
        label={t('profile.fields.website')}
        value={
          hasProfileValue(website) ? (
            <a
              href={websiteHref(website as string)}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK}
            >
              {website}
            </a>
          ) : (
            <NotProvided label={notProvided} />
          )
        }
      />
    </div>
  )
}

function OwnerBody({ profile, notProvided }: CardBodyProps) {
  const { t } = useTranslation('restaurants')
  const { name, email, phone } = profile.owner

  return (
    <div className={FIELD_GRID}>
      <OverviewField
        IconComp={User}
        label={t('profile.fields.ownerName')}
        value={textOr(name, notProvided)}
      />
      <OverviewField
        IconComp={Envelope}
        label={t('profile.fields.ownerEmail')}
        value={
          hasProfileValue(email) ? (
            <a href={`mailto:${email}`} className={LINK}>
              {email}
            </a>
          ) : (
            <NotProvided label={notProvided} />
          )
        }
      />
      <OverviewField
        IconComp={Phone}
        label={t('profile.fields.ownerPhone')}
        value={textOr(formatPhoneForDisplay(phone), notProvided)}
      />
    </div>
  )
}

function RulesBody({ profile, notProvided }: CardBodyProps) {
  const { t } = useTranslation('restaurants')
  const { houseRules, dressCode, servesAlcohol } = profile.rules

  return (
    <div className={FIELD_GRID}>
      <OverviewField
        IconComp={Info}
        label={t('profile.fields.houseRules')}
        value={textOr(houseRules, notProvided)}
      />
      <OverviewField
        IconComp={CoatHanger}
        label={t('profile.fields.dressCode')}
        value={textOr(dressCode, notProvided)}
      />
      <OverviewField
        IconComp={Wine}
        label={t('profile.fields.servesAlcohol')}
        value={
          servesAlcohol === null ? (
            <NotProvided label={notProvided} />
          ) : (
            <LabelTag>{t(servesAlcohol ? 'profile.overview.yes' : 'profile.overview.no')}</LabelTag>
          )
        }
      />
    </div>
  )
}

interface OverviewTabProps {
  profile: PartnerRestaurantProfile
  cards: ReturnType<typeof useOverviewCards>
  /** Cards owning a field a failed submit reported as missing (AC-07.3). */
  cardsNeedingAttention?: ReadonlySet<OverviewCard>
}

/**
 * The Overview tab — four cards (BR-06).
 *
 * Business Registration and Seating are deliberately absent.
 */
export function OverviewTab({ profile, cards, cardsNeedingAttention }: OverviewTabProps) {
  const { t } = useTranslation('restaurants')
  const editable = profile.editable
  const notProvided = t('profile.overview.notProvided')

  const open = (card: OverviewCard) => () => cards.openCardModal(card)
  const attention = (card: OverviewCard) => cardsNeedingAttention?.has(card) ?? false
  const body = { profile, notProvided }

  return (
    <div className="pt-5">
      <OverviewCardShell
        title={t('profile.overview.details')}
        filled={cards.filled.details}
        editable={editable}
        onEdit={open('details')}
        emptyIcon={ForkKnife}
        emptyTitle={t('profile.overview.emptyDetails')}
        emptyDescription={t('profile.overview.emptyDetailsDesc')}
        emptyAction={t('profile.overview.addDetails')}
        needsAttention={attention('details')}
      >
        <DetailsBody {...body} />
      </OverviewCardShell>

      <OverviewCardShell
        title={t('profile.overview.location')}
        filled={cards.filled.location}
        editable={editable}
        onEdit={open('location')}
        emptyIcon={MapPin}
        emptyTitle={t('profile.overview.emptyLocation')}
        emptyDescription={t('profile.overview.emptyLocationDesc')}
        emptyAction={t('profile.overview.addLocation')}
        needsAttention={attention('location')}
      >
        <LocationBody {...body} />
      </OverviewCardShell>

      <OverviewCardShell
        title={t('profile.overview.owner')}
        filled={cards.filled.owner}
        editable={editable}
        onEdit={open('owner')}
        emptyIcon={User}
        emptyTitle={t('profile.overview.emptyOwner')}
        emptyDescription={t('profile.overview.emptyOwnerDesc')}
        emptyAction={t('profile.overview.addOwner')}
        needsAttention={attention('owner')}
      >
        <OwnerBody {...body} />
      </OverviewCardShell>

      <OverviewCardShell
        title={t('profile.overview.rules')}
        filled={cards.filled.rules}
        editable={editable}
        onEdit={open('rules')}
        emptyIcon={Info}
        emptyTitle={t('profile.overview.emptyRules')}
        emptyDescription={t('profile.overview.emptyRulesDesc')}
        emptyAction={t('profile.overview.addRules')}
      >
        <RulesBody {...body} />
      </OverviewCardShell>
    </div>
  )
}
