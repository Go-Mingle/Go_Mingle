import type { MessageInstance } from 'antd/es/message/interface'
import type { TFunction } from 'i18next'
import { HttpError } from '../../../shared/api/httpClient'
import { getApiErrorMessage } from '../../../shared/utils/apiError'

interface HandleOptions {
  messageApi: MessageInstance
  t: TFunction
  /** Called for terminal errors (already actioned / not found) so the caller can close the modal + refetch. */
  onTerminal?: () => void
}

/**
 * Maps an approve/decline error to the right toast. Backend error codes are
 * handled explicitly; anything else falls back to the API message or a generic one.
 */
export function handleApprovalActionError(
  err: unknown,
  { messageApi, t, onTerminal }: HandleOptions,
) {
  if (err instanceof HttpError) {
    if (err.code === 'ERR_APPLICATION_ALREADY_ACTIONED') {
      onTerminal?.()
      void messageApi.warning(t('messages.conflict'))
      return
    }
    if (err.code === 'ERR_APPLICATION_NOT_FOUND') {
      onTerminal?.()
      void messageApi.error(t('messages.notFound'))
      return
    }
    if (err.code === 'ERR_NO_CATEGORIES') {
      void messageApi.error(t('approve.noCategories'))
      return
    }
    if (err.code === 'ERR_INVALID_CATEGORY') {
      void messageApi.error(t('approve.invalidCategory'))
      return
    }
  }
  void messageApi.error(getApiErrorMessage(err, t('common:errors.genericError')))
}
