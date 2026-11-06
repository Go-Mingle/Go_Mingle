import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { partnerRetryPolicy } from '../../../../shared/api/retryPolicy'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import {
  WEBHOOK_CONFIG_QUERY_KEY,
  WEBHOOK_DELIVERIES_QUERY_KEY,
  DELIVERIES_PAGE_SIZE,
  TEST_DELIVERY_POLL_INTERVAL_MS,
} from '../constants'
import { webhooksService } from '../services'
import type {
  DeliveryStatusFilter,
  SaveWebhookConfigDto,
  WebhookConfig,
  WebhookDeliveriesPage,
  WebhookEventType,
} from '../types'

/**
 * J4's server state.
 *
 * Mutations own cache writes only; UI feedback — toasts, the show-once secret
 * modal, edit resets — stays with the caller's `mutate` callbacks.
 *
 * `awaitingTestDelivery` turns the log into a short poll. See
 * {@link TEST_DELIVERY_POLL_INTERVAL_MS} for why a single refetch is not enough.
 */
export function useWebhooks(
  page: number,
  status: DeliveryStatusFilter,
  awaitingTestDelivery = false,
) {
  const qc = useQueryClient()

  const configQuery = useQuery<WebhookConfig>({
    queryKey: WEBHOOK_CONFIG_QUERY_KEY,
    queryFn: () => webhooksService.getConfig(),
    enabled: tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })

  const deliveriesQuery = useQuery<WebhookDeliveriesPage>({
    // Params belong in the key so paging and filtering each cache separately.
    queryKey: [...WEBHOOK_DELIVERIES_QUERY_KEY, { page, status }],
    queryFn: () => webhooksService.getDeliveries({ page, pageSize: DELIVERIES_PAGE_SIZE, status }),
    enabled: tokenStore.hasSession(),
    // Keeps the current page on screen while the next one loads, so paging and
    // filtering do not blank the table on every click.
    placeholderData: (previous) => previous,
    // Only while a test is outstanding — the log is otherwise static enough that
    // a standing poll would be traffic for nothing.
    refetchInterval: awaitingTestDelivery ? TEST_DELIVERY_POLL_INTERVAL_MS : false,
    ...partnerRetryPolicy,
  })

  /**
   * A save can flip `enabled`, which changes what F2 will deliver — but it never
   * rewrites history, so only the config is refreshed, not the log.
   */
  const saveMutation = useMutation({
    mutationFn: (data: SaveWebhookConfigDto) => webhooksService.saveConfig(data),
    onSuccess: (saved) => {
      // The response is the full config, so write it in rather than refetching.
      // The full secret and plaintext token are stripped so neither lingers in
      // the shared cache — the caller shows the secret once from its own state.
      qc.setQueryData<WebhookConfig>(WEBHOOK_CONFIG_QUERY_KEY, {
        ...saved,
        signingSecret: null,
        bearerToken: null,
      })
    },
  })

  const rotateMutation = useMutation({
    mutationFn: () => webhooksService.rotateSecret(),
    onSuccess: (result) => {
      // Rotation returns only the secret fields, so patch rather than replace.
      qc.setQueryData<WebhookConfig>(WEBHOOK_CONFIG_QUERY_KEY, (current) =>
        current
          ? {
              ...current,
              signingSecretMasked: result.signingSecretMasked,
              signingSecret: null,
              secretRotatedAt: result.secretRotatedAt,
            }
          : current,
      )
    },
  })

  /**
   * The 202 only means accepted — the outcome appears in the log later, so the
   * deliveries query is invalidated instead of the response being trusted.
   */
  const testMutation = useMutation({
    mutationFn: (eventType: WebhookEventType) => webhooksService.sendTest(eventType),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: WEBHOOK_DELIVERIES_QUERY_KEY })
    },
  })

  /**
   * Fetches the plaintext bearer token for the eye icon without writing it into
   * the shared cache — the caller holds it in component state only while it is
   * on screen.
   */
  const revealBearerToken = async (): Promise<string | null> => {
    const revealed = await webhooksService.getConfig(true)
    return revealed.bearerToken
  }

  return {
    config: configQuery.data,
    isPending: configQuery.isPending,
    isError: configQuery.isError,
    error: configQuery.error,
    deliveriesPage: deliveriesQuery.data,
    deliveriesFetching: deliveriesQuery.isFetching,
    saveMutation,
    rotateMutation,
    testMutation,
    revealBearerToken,
    refreshDeliveries: () => qc.invalidateQueries({ queryKey: WEBHOOK_DELIVERIES_QUERY_KEY }),
  }
}
