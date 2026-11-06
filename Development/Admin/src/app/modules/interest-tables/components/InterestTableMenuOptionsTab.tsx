import { ForkKnife } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { ComboCard } from '../../restaurants/components/ComboCard'
import type { InterestTableMenuOptionItem } from '../types'

interface Props {
  menuOptions: InterestTableMenuOptionItem[]
}

export function InterestTableMenuOptionsTab({ menuOptions }: Props) {
  const { t } = useTranslation('interest-tables')

  if (menuOptions.length === 0) {
    return (
      <div className="pt-5">
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
            {t('detail.menuOptionsEmpty')}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-5">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {menuOptions.map((menuOption) => (
          <ComboCard
            key={menuOption.id}
            item={menuOption}
            priceLabel={t('detail.comboPrice', {
              price: (menuOption.pricePkr ?? 0).toLocaleString(),
            })}
          />
        ))}
      </div>
    </div>
  )
}
