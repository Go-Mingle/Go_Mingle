import { useTranslation } from 'react-i18next'

interface PendingTabLabelProps {
  count: number
}

export function PendingTabLabel({ count }: PendingTabLabelProps) {
  const { t } = useTranslation('approval-queue')

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'Poppins, sans-serif',
      }}
    >
      {t('tabs.pending')}
      {count > 0 && (
        <span
          style={{
            background: 'var(--color-coral)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 12,
            padding: '1px 7px',
            lineHeight: '18px',
          }}
        >
          {count}
        </span>
      )}
    </span>
  )
}
