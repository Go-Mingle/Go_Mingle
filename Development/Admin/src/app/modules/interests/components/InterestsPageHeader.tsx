import { useTranslation } from 'react-i18next'
import { Grid } from 'antd'
import { Plus } from '@phosphor-icons/react'

interface InterestsPageHeaderProps {
  onNew: () => void
}

export function InterestsPageHeader({ onNew }: InterestsPageHeaderProps) {
  const { t } = useTranslation('interests')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        gap: 12,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: isMobile ? 20 : 26,
          fontWeight: 700,
          color: 'var(--color-text)',
          fontFamily: 'Poppins, sans-serif',
          lineHeight: 1.2,
        }}
      >
        {t('title')}
      </h1>
      <button
        onClick={onNew}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: isMobile ? 34 : 36,
          padding: isMobile ? '0 12px' : '0 16px',
          borderRadius: 12,
          border: 'none',
          background: 'var(--color-accent)',
          color: '#ffffff',
          fontSize: isMobile ? 12 : 13,
          fontWeight: 600,
          fontFamily: 'Poppins, sans-serif',
          cursor: 'pointer',
          transition: 'background 150ms ease-out',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-dark)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
      >
        <Plus size={isMobile ? 13 : 15} weight="bold" />
        {t('form.createInterest')}
      </button>
    </div>
  )
}
