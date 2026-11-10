import {
  Tag,
  ForkKnife,
  Globe,
  MapPin,
  MapTrifold,
  City,
  NavigationArrow,
  User,
  Envelope,
  Phone,
  CoatHanger,
  Wine,
  Info,
  Article,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { SectionCard } from './restaurantDetail.utils'
import { OverviewField } from './components/OverviewField'
import { LabelTag } from '../../atoms/LabelTag'

interface Props {
  restaurant: Record<string, unknown>
}

function NotProvided({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 13,
        fontStyle: 'italic',
        color: 'var(--color-text-subtle)',
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      {label}
    </span>
  )
}

function renderText(value: unknown, notProvidedLabel: string): React.ReactNode {
  if (value === undefined || value === null || value === '') {
    return <NotProvided label={notProvidedLabel} />
  }
  return value as React.ReactNode
}

export function RestaurantOverviewTab({ restaurant }: Props) {
  const { t } = useTranslation('restaurants')
  const notProvided = t('overview.notProvided')
  const address = (restaurant.fullAddress as string | undefined) ?? ''
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`

  const ownerPhone =
    (restaurant.ownerPhone as string | undefined) ?? (restaurant.phone as string | undefined)

  const category = restaurant.category as { name?: string } | string | null | undefined
  const categoryName = typeof category === 'string' ? category : category?.name

  const servesAlcohol = restaurant.servesAlcohol as boolean | null | undefined
  const alcoholYesNo = servesAlcohol == null ? undefined : servesAlcohol

  return (
    <div className="pt-5">
      {/* ── Restaurant Details ─────────────────────────────── */}
      <SectionCard title={t('overview.restaurantDetails')}>
        <OverviewField
          IconComp={Article}
          label={t('overview.fields.description')}
          value={renderText(restaurant.description, notProvided)}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: '0 16px' }}>
          <OverviewField
            IconComp={Tag}
            label={t('overview.fields.category')}
            value={
              categoryName ? (
                <LabelTag>{categoryName}</LabelTag>
              ) : (
                <NotProvided label={notProvided} />
              )
            }
          />
          <OverviewField
            IconComp={ForkKnife}
            label={t('overview.fields.cuisineType')}
            value={renderText(restaurant.cuisine, notProvided)}
          />
        </div>
      </SectionCard>

      {/* ── Location & Address ─────────────────────────────── */}
      <SectionCard title={t('overview.locationAddress')}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: '0 16px' }}>
          <OverviewField
            IconComp={MapPin}
            label={t('overview.fields.fullAddress')}
            value={
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                }}
              >
                {renderText(restaurant.fullAddress, notProvided)}
                {restaurant.fullAddress ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      color: 'var(--color-accent)',
                      textDecoration: 'none',
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: 'Poppins, sans-serif',
                    }}
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
            label={t('overview.fields.areaDistrict')}
            value={renderText(restaurant.areaDistrict, notProvided)}
          />
          <OverviewField
            IconComp={City}
            label={t('overview.fields.city')}
            value={renderText(restaurant.city, notProvided)}
          />
          {/* Shells — undefined until the restaurant detail API returns contact fields. */}
          <OverviewField
            IconComp={Phone}
            label={t('overview.fields.phone')}
            value={renderText(restaurant.phone, notProvided)}
          />
          <OverviewField
            IconComp={Envelope}
            label={t('overview.fields.emailAddress')}
            value={renderText(restaurant.email, notProvided)}
          />
          <OverviewField
            IconComp={Globe}
            label={t('overview.fields.website')}
            value={
              restaurant.website ? (
                <a
                  href={`https://${restaurant.website as string}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-accent)', textDecoration: 'none' }}
                >
                  {restaurant.website as string}
                </a>
              ) : (
                <NotProvided label={notProvided} />
              )
            }
          />
        </div>
      </SectionCard>

      {/* ── Owner Details ──────────────────────────────────── */}
      <SectionCard title={t('overview.ownerDetails')}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: '0 16px' }}>
          <OverviewField
            IconComp={User}
            label={t('overview.fields.ownerName')}
            value={renderText(restaurant.ownerName, notProvided)}
          />
          <OverviewField
            IconComp={Envelope}
            label={t('overview.fields.ownerEmail')}
            value={
              restaurant.ownerEmail ? (
                <a
                  href={`mailto:${restaurant.ownerEmail as string}`}
                  style={{ color: 'var(--color-accent)', textDecoration: 'none' }}
                >
                  {restaurant.ownerEmail as string}
                </a>
              ) : (
                <NotProvided label={notProvided} />
              )
            }
          />
          <OverviewField
            IconComp={Phone}
            label={t('overview.fields.ownerPhone')}
            value={renderText(ownerPhone, notProvided)}
          />
        </div>
      </SectionCard>

      {/* ── House Rules / Dress Code ───────────────────────── */}
      <SectionCard title={t('overview.houseRules')}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: '0 16px' }}>
          <OverviewField
            IconComp={Info}
            label={t('overview.fields.houseRules')}
            value={renderText(restaurant.houseRules, notProvided)}
          />
          <OverviewField
            IconComp={CoatHanger}
            label={t('overview.fields.dressCode')}
            value={renderText(restaurant.dressCode, notProvided)}
          />
          <OverviewField
            IconComp={Wine}
            label={t('overview.fields.alcohol')}
            value={
              alcoholYesNo === undefined ? (
                <NotProvided label={notProvided} />
              ) : (
                <LabelTag>
                  {alcoholYesNo ? t('overview.fields.yes') : t('overview.fields.no')}
                </LabelTag>
              )
            }
          />
        </div>
      </SectionCard>
    </div>
  )
}
