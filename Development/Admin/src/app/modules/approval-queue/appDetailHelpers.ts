import type { TFunction } from 'i18next'
import type { ApplicationDetail } from './types'

export interface StatusBadgeStyle {
  bg: string
  text: string
  label: string
}

export function buildPlatformStatusStyle(currentStatus: string, t: TFunction): StatusBadgeStyle {
  const status = currentStatus.toUpperCase()
  if (status === 'PENDING') return { bg: '#B06000', text: '#FFFFFF', label: t('card.pending') }
  if (status === 'ACTIVE') return { bg: '#1A8A5A', text: '#FFFFFF', label: t('card.approved') }
  if (status === 'REJECTED') return { bg: '#C0392B', text: '#FFFFFF', label: t('card.rejected') }
  return { bg: 'var(--color-text-secondary)', text: '#FFFFFF', label: currentStatus }
}

export function buildVisibilityStyle(visibleOnApp: boolean, t: TFunction): StatusBadgeStyle {
  return visibleOnApp
    ? {
        bg: 'var(--color-accent-light)',
        text: 'var(--color-accent-dark)',
        label: t('detail.visibleOnApp'),
      }
    : {
        bg: 'var(--color-error-bg)',
        text: 'var(--color-error)',
        label: t('detail.notVisibleOnApp'),
      }
}

export function buildAppWithContacts(
  application: ApplicationDetail,
  appRecord: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...appRecord,
    contacts: (appRecord.contacts as
      | { id: string; name: string; title: string; email: string; phone: string }[]
      | undefined) ?? [
      {
        id: 'c1',
        name: application.owner,
        title: 'Owner',
        email: application.email,
        phone: application.phone,
      },
      {
        id: 'c2',
        name: 'Operations Manager',
        title: 'Operations Manager',
        email: `ops@${application.name.toLowerCase().replace(/\s+/g, '')}.ae`,
        phone: '+92 300 234 5678',
      },
    ],
  }
}
