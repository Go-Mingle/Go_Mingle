import { http } from 'msw'
import { NOTIFICATION_ENDPOINTS } from '../../app/modules/notifications/constants'
import {
  listMockNotifications,
  markAllMockRead,
  markMockRead,
  mockNotificationTypes,
  mockRecentNotifications,
  mockUnreadCount,
} from '../data/partnerNotifications'
import type { NotificationsQuery } from '../data/partnerNotifications'

function readQuery(url: string): NotificationsQuery {
  const params = new URL(url).searchParams
  return {
    search: params.get('search'),
    // Repeatable, and CSV is tolerated too — the backend accepts either.
    type: params
      .getAll('type')
      .flatMap((value) => value.split(','))
      .filter(Boolean),
    status: params.get('status'),
    startDate: params.get('startDate'),
    endDate: params.get('endDate'),
    sortDir: params.get('sortDir'),
    page: params.get('page'),
    pageSize: params.get('pageSize'),
  }
}

/**
 * J7's six endpoints.
 *
 * The four literal sub-paths are registered **before** the parameterised `/:id/read`, so
 * `/unread-count` is not swallowed as a notification id — the same ordering J6B, J6F and
 * J6G needed.
 *
 * There is deliberately no un-read route: read state is irreversible (BR-04), and a mock
 * for a mutation the API does not offer would invite a toggle to be built.
 */
export const partnerNotificationsHandlers = [
  http.get(NOTIFICATION_ENDPOINTS.unreadCount, () => mockUnreadCount()),

  http.get(NOTIFICATION_ENDPOINTS.recent, () => mockRecentNotifications()),

  http.get(NOTIFICATION_ENDPOINTS.types, () => mockNotificationTypes()),

  http.patch(NOTIFICATION_ENDPOINTS.markAllRead, () => markAllMockRead()),

  http.get(NOTIFICATION_ENDPOINTS.list, ({ request }) =>
    listMockNotifications(readQuery(request.url)),
  ),

  http.patch(NOTIFICATION_ENDPOINTS.markRead(':id'), ({ params }) =>
    markMockRead(String(params.id)),
  ),
]
