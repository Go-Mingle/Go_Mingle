import { useMemo, useState } from 'react'
import { message } from 'antd'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import {
  BEARER_TOKEN_MAX_LENGTH,
  DELIVERIES_PAGE_SIZE,
  ENDPOINT_URL_MAX_LENGTH,
} from '../constants'
import { isDeliverableWebhookHost } from '../endpointUrl'
import { webhookErrorFallbackKey } from '../webhookErrors'
import type { DeliveryStatusFilter, WebhookDeliveryRow, WebhookEventType } from '../types'
import { useWebhooks } from './useWebhooks'
import { usePendingDeliveryRow, usePendingTestDelivery } from './usePendingTestDelivery'

export type WebhookTab = 'setup' | 'events' | 'deliveries'

interface FieldErrors {
  endpoint?: string
  token?: string
}

function validate(url: string, token: string, t: TFunction): FieldErrors {
  const errs: FieldErrors = {}
  const trimmedUrl = url.trim()

  if (!trimmedUrl) {
    errs.endpoint = t('endpoint.invalidError')
  } else if (trimmedUrl.length > ENDPOINT_URL_MAX_LENGTH) {
    errs.endpoint = t('endpoint.tooLongError')
  } else {
    try {
      const parsed = new URL(trimmedUrl)
      // BR-02 — HTTPS only. Checked here so the message appears inline rather
      // than arriving as a 422 toast.
      if (parsed.protocol !== 'https:') {
        errs.endpoint = t('endpoint.httpsError')
      } else if (!isDeliverableWebhookHost(parsed.hostname)) {
        // MET-1282 — https is not enough. A host with no TLD parses, saves and
        // then fails every delivery as unresolvable.
        errs.endpoint = t('endpoint.hostError')
      }
    } catch {
      errs.endpoint = t('endpoint.invalidError')
    }
  }

  const trimmedToken = token.trim()
  if (!trimmedToken) errs.token = t('auth.requiredError')
  else if (trimmedToken.length > BEARER_TOKEN_MAX_LENGTH) errs.token = t('auth.tooLongError')

  return errs
}

/**
 * UI controller for the Webhooks page.
 *
 * Two things about the contract shape the whole file:
 *
 * 1. The bearer token comes back **masked**. `PUT` requires it in full, so any
 *    write — including a bare toggle flip — must first resolve the plaintext,
 *    revealing it from the server when the partner has not typed or revealed it
 *    themselves. Sending the mask would overwrite the real token with bullets.
 * 2. `enabled` is optional on `PUT`, and sending `false` mutes a live
 *    integration. An ordinary endpoint/token edit therefore omits the field
 *    entirely; only an explicit toggle confirmation sends it.
 */
export function useWebhooksPage() {
  const { t } = useTranslation(['integrations', 'common'])
  const [messageApi, contextHolder] = message.useMessage()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<DeliveryStatusFilter>('ALL')

  // Before the query: it decides whether that query polls (MET-1277).
  const { pending, pollDeliveries, startPendingTest, clearPendingTest } = usePendingTestDelivery()

  const {
    config,
    isPending,
    isError,
    error,
    deliveriesPage,
    deliveriesFetching,
    saveMutation,
    rotateMutation,
    testMutation,
    revealBearerToken,
    refreshDeliveries,
  } = useWebhooks(page, statusFilter, pollDeliveries)

  const { pendingRow, awaitingTestDelivery, testDeliveryUnconfirmed } = usePendingDeliveryRow(
    pending,
    deliveriesPage,
    clearPendingTest,
  )

  // Pending edits override the saved config; null means "follow the server".
  const [endpointEdit, setEndpointEdit] = useState<string | null>(null)
  const [tokenEdit, setTokenEdit] = useState<string | null>(null)
  const [revealedToken, setRevealedToken] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [toggleTarget, setToggleTarget] = useState<boolean | null>(null)
  const [tab, setTab] = useState<WebhookTab>('setup')

  const endpointUrl = endpointEdit ?? config?.endpointUrl ?? ''
  const enabled = config?.enabled ?? false
  const configured = !!config?.configured

  /**
   * What the token field shows: the partner's own edit, else the plaintext they
   * revealed, else the mask. Never a value that can be saved blindly — see
   * {@link resolveBearerToken}.
   */
  const tokenFieldValue = tokenEdit ?? revealedToken ?? config?.bearerTokenMasked ?? ''
  const tokenRevealed = tokenEdit !== null || revealedToken !== null

  const showError = (cause: unknown) => {
    void messageApi.error(getApiErrorMessage(cause, t(webhookErrorFallbackKey(cause))))
  }

  /**
   * The plaintext token to send. Falls back to a reveal request because the mask
   * on screen is not a usable credential.
   */
  const resolveBearerToken = async (): Promise<string | null> => {
    const edited = tokenEdit?.trim()
    if (edited) return edited
    if (revealedToken) return revealedToken
    if (!configured) return null
    return revealBearerToken()
  }

  /**
   * MET-1276 — one control, two states: the eye must be able to put the token
   * away again, not just take it out. Hiding drops the plaintext rather than
   * parking it off-screen, so a later save resolves it from the server again.
   *
   * Offered only for the stored token. Once the partner has typed their own
   * value there is no mask to return to, and clearing it would bin their edit.
   */
  const canToggleToken = configured && tokenEdit === null

  const toggleToken = async () => {
    if (revealedToken !== null) {
      setRevealedToken(null)
      return
    }
    setRevealing(true)
    try {
      setRevealedToken((await revealBearerToken()) ?? '')
    } catch (cause) {
      showError(cause)
    } finally {
      setRevealing(false)
    }
  }

  const applySaved = (fullSecret: string | null) => {
    // The generated secret exists in this one response and nowhere else (BR-04).
    if (fullSecret) setRevealedSecret(fullSecret)
    setEndpointEdit(null)
    setTokenEdit(null)
    setRevealedToken(null)
    setErrors({})
  }

  /** Saves the endpoint and token. Deliberately omits `enabled` — see the note above. */
  const saveSettings = async () => {
    let bearerToken: string | null
    try {
      bearerToken = await resolveBearerToken()
    } catch (cause) {
      showError(cause)
      return
    }

    const errs = validate(endpointUrl, bearerToken ?? '', t)
    setErrors(errs)
    if (errs.endpoint || errs.token) {
      setTab('setup')
      return
    }

    saveMutation.mutate(
      { endpointUrl: endpointUrl.trim(), bearerToken: (bearerToken ?? '').trim() },
      {
        onSuccess: (saved) => {
          applySaved(saved.signingSecret)
          void messageApi.success(t('integrations:save.toast'))
        },
        onError: showError,
      },
    )
  }

  /**
   * Persists the toggle. This is the only path that sends `enabled`, and it has
   * to re-send the endpoint and token because `PUT` requires both.
   */
  const confirmToggle = async () => {
    const next = toggleTarget
    setToggleTarget(null)
    if (next === null) return

    if (!configured) {
      // AC-03.2 — cannot enable before a valid endpoint + token are saved.
      void messageApi.warning(t('integrations:toggle.lockedHint'))
      return
    }

    let bearerToken: string | null
    try {
      bearerToken = await resolveBearerToken()
    } catch (cause) {
      showError(cause)
      return
    }
    if (!bearerToken || !config?.endpointUrl) {
      void messageApi.warning(t('integrations:toggle.lockedHint'))
      return
    }

    saveMutation.mutate(
      { endpointUrl: config.endpointUrl, bearerToken, enabled: next },
      {
        onSuccess: (saved) => {
          applySaved(saved.signingSecret)
          void messageApi.success(
            next ? t('integrations:toggle.onToast') : t('integrations:toggle.offToast'),
          )
        },
        onError: showError,
      },
    )
  }

  const confirmRotate = () => {
    setRotateOpen(false)
    rotateMutation.mutate(undefined, {
      onSuccess: (result) => {
        setRevealedSecret(result.signingSecret)
        void messageApi.success(t('integrations:secret.rotated'))
      },
      onError: showError,
    })
  }

  const sendTest = (eventType: WebhookEventType) => {
    testMutation.mutate(eventType, {
      onSuccess: () => {
        // A 202 means queued, not delivered — the outcome only exists in the log,
        // so the copy must not claim success.
        void messageApi.success(t('integrations:test.queuedToast'))
        // ...and the log will not have it yet. Hold a queued marker and poll for
        // the real record rather than letting a 3s toast be the only trace of a
        // send that has not landed anywhere (MET-1277).
        startPendingTest(eventType)
      },
      onError: showError,
    })
  }

  const changeStatusFilter = (next: DeliveryStatusFilter) => {
    setStatusFilter(next)
    setPage(1)
  }

  const serverRows = deliveriesPage?.items
  const serverTotal = deliveriesPage?.pagination.totalRecords ?? 0

  /**
   * The queued marker belongs at the top of the newest page of everything, and
   * nowhere else: it has no server status, so it would be a lie under a status
   * filter, and it is the newest row, so it has no business on page 2.
   */
  const showPendingRow = !!pendingRow && page === 1 && statusFilter === 'ALL'

  const deliveries = useMemo<WebhookDeliveryRow[]>(() => {
    const rows = serverRows ?? []
    if (!showPendingRow || !pendingRow) return rows
    // Sliced so the page never runs one row longer than the size the pager below
    // it is counting in.
    return [pendingRow, ...rows].slice(0, DELIVERIES_PAGE_SIZE)
  }, [serverRows, pendingRow, showPendingRow])

  return {
    contextHolder,
    config,
    isPending,
    isError,
    error,

    // Setup
    endpointUrl,
    onEndpointChange: setEndpointEdit,
    tokenFieldValue,
    tokenRevealed,
    revealing,
    onToggleToken: canToggleToken ? toggleToken : undefined,
    onTokenChange: setTokenEdit,
    errors,
    saveSettings,
    saving: saveMutation.isPending,

    // Secret
    signingSecretMasked: config?.signingSecretMasked ?? null,
    revealedSecret,
    clearSecret: () => setRevealedSecret(null),
    rotateOpen,
    openRotate: () => setRotateOpen(true),
    closeRotate: () => setRotateOpen(false),
    confirmRotate,
    rotating: rotateMutation.isPending,

    // Toggle
    enabled,
    canEnable: configured,
    toggleTarget,
    requestToggle: setToggleTarget,
    cancelToggle: () => setToggleTarget(null),
    confirmToggle,

    // Test — allowed while the toggle is OFF (AC-05.2), blocked until configured.
    canTest: configured,
    sendTest,
    testSending: testMutation.isPending,
    // MET-1277 — a send is accepted but not yet in the log.
    awaitingTestDelivery,
    testDeliveryUnconfirmed,

    // Deliveries
    deliveries,
    totalDeliveries: showPendingRow ? serverTotal + 1 : serverTotal,
    page,
    setPage,
    statusFilter,
    changeStatusFilter,
    refreshDeliveries,
    deliveriesFetching,

    tab,
    setTab,
  }
}
