import { ForkKnife, DownloadSimple } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Grid, Tooltip } from 'antd'
import { ComboCard } from './components/ComboCard'
import { useMenuOptionsQuery } from './hooks/useRestaurantsQuery'

interface Props {
  restaurant: Record<string, unknown>
}

export function RestaurantCombosTab({ restaurant }: Props) {
  const { t } = useTranslation('restaurants')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const restaurantId = restaurant.id as string | undefined
  const { data, isLoading, isError } = useMenuOptionsQuery(restaurantId)
  const combos = data?.items ?? []

  // Shell — undefined until the restaurant detail API returns a menu PDF URL.
  const menuPdfUrl = (restaurant.menuPdfUrl as string | undefined) ?? null

  return (
    <div className="pt-5">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Tooltip title={menuPdfUrl ? '' : t('menu.noMenuPdf')}>
          <a
            href={menuPdfUrl ?? undefined}
            download
            aria-disabled={!menuPdfUrl}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 36,
              padding: '0 16px',
              borderRadius: 12,
              border: '1px solid var(--color-border-strong)',
              background: 'var(--color-card)',
              color: menuPdfUrl ? 'var(--color-text-secondary)' : 'var(--color-text-subtle)',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'Poppins, sans-serif',
              cursor: menuPdfUrl ? 'pointer' : 'not-allowed',
              pointerEvents: menuPdfUrl ? 'auto' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <DownloadSimple size={15} weight="regular" />
            {t('menu.downloadMenu')}
          </a>
        </Tooltip>
      </div>
      {isLoading ? (
        <div className="text-[var(--color-text-muted)] p-8">{t('common:status.loading')}</div>
      ) : isError ? (
        <div className="text-[var(--color-text-muted)] p-8">Unable to load menu options.</div>
      ) : combos.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            padding: '48px 0',
          }}
        >
          <ForkKnife size={32} weight="regular" style={{ color: 'var(--color-text-subtle)' }} />
          <span
            style={{
              fontSize: 13,
              color: 'var(--color-text-muted)',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {t('menu.combosEmpty')}
          </span>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          {combos.map((combo) => (
            <ComboCard
              key={combo.id}
              item={combo}
              priceLabel={t('menu.price', { price: (combo.pricePkr ?? 0).toLocaleString() })}
            />
          ))}
        </div>
      )}
    </div>
  )
}
