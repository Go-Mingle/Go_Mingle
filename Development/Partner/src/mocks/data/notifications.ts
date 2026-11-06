// ── Push Notifications (SA15) — admin-authored notifications to Minglers ──
export interface PushNotification {
  id: string
  title: string
  body: string
  /** 'all' | 'segment' | 'specific' */
  audience: 'all' | 'segment' | 'specific'
  /** Free-text segment name or comma-separated Mingler list, shown read-only. */
  audienceDetail?: string
  scheduledAt: string
  status: 'scheduled' | 'sent'
}

export const mockPushNotifications: PushNotification[] = [
  {
    id: 'pn1',
    title: 'Weekend Wine Tables are live',
    body: 'New Friday wine-pairing interest tables just opened. Book your seat before they fill up.',
    audience: 'all',
    scheduledAt: '2026-06-20T17:00:00.000Z',
    status: 'sent',
  },
  {
    id: 'pn2',
    title: 'Double loyalty points this week',
    body: 'Earn 2× points on every confirmed booking through Sunday.',
    audience: 'segment',
    audienceDetail: 'Active diners',
    scheduledAt: '2026-06-28T09:00:00.000Z',
    status: 'sent',
  },
  {
    id: 'pn3',
    title: 'Ramadan iftar tables — early access',
    body: 'Prominglers get first access to curated iftar interest tables.',
    audience: 'specific',
    audienceDetail: 'Prominglers',
    scheduledAt: '2026-07-10T15:30:00.000Z',
    status: 'scheduled',
  },
]
