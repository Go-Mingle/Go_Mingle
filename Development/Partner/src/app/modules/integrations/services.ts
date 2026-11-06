import { httpClient } from '../../../shared/api/httpClient'
import { WEBHOOK_ENDPOINTS } from './constants'
import type {
  RotateSecretResponse,
  SaveWebhookConfigDto,
  SaveWebhookConfigResponse,
  TestWebhookResponse,
  WebhookConfig,
  WebhookDeliveriesPage,
  WebhookDeliveriesQueryParams,
  WebhookEventType,
} from './types'

function deliveriesQuery(params: WebhookDeliveriesQueryParams): string {
  const search = new URLSearchParams()
  if (params.page !== undefined) search.set('page', String(params.page))
  if (params.pageSize !== undefined) search.set('pageSize', String(params.pageSize))
  if (params.status) search.set('status', params.status)
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const webhooksService = {
  /**
   * Reads the config. `reveal` populates `bearerToken` in plaintext for the eye
   * icon (BR-16); it fails closed, so only a literal `true` reveals anything.
   * `signingSecret` stays null either way — it is unreadable after generation.
   */
  getConfig: (reveal = false): Promise<WebhookConfig> =>
    httpClient.get<WebhookConfig>(
      reveal ? `${WEBHOOK_ENDPOINTS.config}?reveal=true` : WEBHOOK_ENDPOINTS.config,
    ),

  /**
   * Saves endpoint, token and toggle atomically (BR-07). On the *first* save the
   * response carries `signingSecret` in full — the only chance to show it
   * besides a rotation (BR-04).
   */
  saveConfig: (data: SaveWebhookConfigDto): Promise<SaveWebhookConfigResponse> =>
    httpClient.put<SaveWebhookConfigResponse>(WEBHOOK_ENDPOINTS.config, data),

  /** Rotates the signing secret. No grace window — the old one dies at once (BR-05). */
  rotateSecret: (): Promise<RotateSecretResponse> =>
    httpClient.post<RotateSecretResponse>(WEBHOOK_ENDPOINTS.rotateSecret, {}),

  /**
   * Queues a synthetic payload through the real delivery path (BR-12). Works
   * while the toggle is OFF (AC-05.2); needs a saved endpoint + token.
   */
  sendTest: (eventType: WebhookEventType): Promise<TestWebhookResponse> =>
    httpClient.post<TestWebhookResponse>(WEBHOOK_ENDPOINTS.test, { eventType }),

  /** The 30-day rolling delivery log — F2's records, read-only here (BR-13). */
  getDeliveries: (params: WebhookDeliveriesQueryParams = {}): Promise<WebhookDeliveriesPage> =>
    httpClient.get<WebhookDeliveriesPage>(
      `${WEBHOOK_ENDPOINTS.deliveries}${deliveriesQuery(params)}`,
    ),
}
