import { http, HttpResponse } from 'msw'
import { WEBHOOK_ENDPOINTS } from '../../app/modules/integrations/constants'
import {
  configResponse,
  listMockDeliveries,
  rotateMockSecret,
  saveMockWebhookConfig,
  sendMockTest,
} from '../data/webhooks'

/**
 * J4's five endpoints. The path is singular — the config is a per-restaurant
 * singleton (BR-01), so there is no collection and no id anywhere.
 */
export const partnerWebhookHandlers = [
  http.get(WEBHOOK_ENDPOINTS.config, ({ request }) => {
    // Fails closed: only a literal `true` reveals the plaintext bearer token.
    const reveal = new URL(request.url).searchParams.get('reveal') === 'true'
    return HttpResponse.json({ success: true, data: configResponse(reveal) })
  }),

  http.put(WEBHOOK_ENDPOINTS.config, async ({ request }) =>
    saveMockWebhookConfig((await request.json()) as Record<string, unknown>),
  ),

  http.post(WEBHOOK_ENDPOINTS.rotateSecret, () => rotateMockSecret()),

  http.post(WEBHOOK_ENDPOINTS.test, async ({ request }) =>
    sendMockTest((await request.json()) as Record<string, unknown>),
  ),

  http.get(WEBHOOK_ENDPOINTS.deliveries, ({ request }) => {
    const params = new URL(request.url).searchParams
    return listMockDeliveries({
      page: params.get('page'),
      pageSize: params.get('pageSize'),
      status: params.get('status'),
    })
  }),
]
