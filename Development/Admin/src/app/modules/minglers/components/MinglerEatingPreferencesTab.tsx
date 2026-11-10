import { useTranslation } from 'react-i18next'
import { Grid, Spin, Alert } from 'antd'
import { ForkKnife } from '@phosphor-icons/react'
import { OverviewField } from './OverviewField'
import { useMinglerEatingPreferencesQuery } from '../hooks/useMinglersQuery'

interface MinglerEatingPreferencesTabProps {
  minglerId: string
  isActive: boolean
}

function NeutralChip({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: 'var(--color-divider)',
        color: 'var(--color-text-secondary)',
        borderRadius: 'var(--radius-xs)',
        padding: '3px 10px',
        marginRight: 6,
        marginBottom: 4,
        fontFamily: 'Poppins, sans-serif',
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  )
}

function MutedText({ children }: { children: string }) {
  return (
    <span
      style={{
        fontFamily: 'Poppins, sans-serif',
        fontSize: 14,
        fontWeight: 500,
        color: 'var(--color-text-muted)',
      }}
    >
      {children}
    </span>
  )
}

export function MinglerEatingPreferencesTab({
  minglerId,
  isActive,
}: MinglerEatingPreferencesTabProps) {
  const { t } = useTranslation('minglers')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const { data, isPending, isError } = useMinglerEatingPreferencesQuery(minglerId, isActive)

  if (isPending) return <Spin className="flex justify-center mt-20" />
  if (isError) return <Alert type="error" message={t('common:errors.fetchError')} className="m-4" />

  const items = data.items

  if (items.length === 0) {
    return (
      <p
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 14,
          color: 'var(--color-text-muted)',
          padding: '24px 0',
        }}
      >
        {t('eating.noPrefs')}
      </p>
    )
  }

  return (
    <div
      style={{
        background: 'var(--color-card)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-sm)',
        padding: 24,
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      <h3
        style={{
          fontFamily: 'Poppins, sans-serif',
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--color-text)',
          margin: 0,
          marginBottom: 12,
        }}
      >
        {t('eating.heading')}
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: '0 16px',
        }}
      >
        {items.map((item) => (
          <OverviewField key={item.questionId} IconComp={ForkKnife} label={item.question}>
            {item.selectedOptions.length === 0 ? (
              <MutedText>{t('eating.notSpecified')}</MutedText>
            ) : (
              <div>
                {item.selectedOptions.map((opt) => (
                  <NeutralChip key={opt.id} label={opt.text} />
                ))}
              </div>
            )}
          </OverviewField>
        ))}
      </div>
    </div>
  )
}
