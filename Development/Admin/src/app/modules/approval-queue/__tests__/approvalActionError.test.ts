import { describe, it, expect, vi } from 'vitest'
import { handleApprovalActionError } from '../approvalActionError'
import { HttpError } from '../../../../shared/api/httpClient'

function makeMessageApi() {
  return {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    open: vi.fn(),
    destroy: vi.fn(),
  } as never
}

const t = ((k: string) => k) as never

function httpError(code: string, responseBody?: unknown) {
  const err = new HttpError(409, 'Conflict', 'boom', code)
  err.responseBody = responseBody
  return err
}

describe('handleApprovalActionError', () => {
  it('warns and calls onTerminal for already-actioned', () => {
    const messageApi = makeMessageApi()
    const onTerminal = vi.fn()
    handleApprovalActionError(httpError('ERR_APPLICATION_ALREADY_ACTIONED'), {
      messageApi,
      t,
      onTerminal,
    })
    expect(onTerminal).toHaveBeenCalled()
    expect((messageApi as { warning: ReturnType<typeof vi.fn> }).warning).toHaveBeenCalledWith(
      'messages.conflict',
    )
  })

  it('errors and calls onTerminal for not-found', () => {
    const messageApi = makeMessageApi()
    const onTerminal = vi.fn()
    handleApprovalActionError(httpError('ERR_APPLICATION_NOT_FOUND'), { messageApi, t, onTerminal })
    expect(onTerminal).toHaveBeenCalled()
    expect((messageApi as { error: ReturnType<typeof vi.fn> }).error).toHaveBeenCalledWith(
      'messages.notFound',
    )
  })

  it('errors for no-categories and invalid-category without onTerminal', () => {
    const messageApi = makeMessageApi()
    const onTerminal = vi.fn()
    handleApprovalActionError(httpError('ERR_NO_CATEGORIES'), { messageApi, t, onTerminal })
    handleApprovalActionError(httpError('ERR_INVALID_CATEGORY'), { messageApi, t, onTerminal })
    expect(onTerminal).not.toHaveBeenCalled()
    const errorMock = (messageApi as { error: ReturnType<typeof vi.fn> }).error
    expect(errorMock).toHaveBeenCalledWith('approve.noCategories')
    expect(errorMock).toHaveBeenCalledWith('approve.invalidCategory')
  })

  it('falls back to the API message for unknown HttpError codes', () => {
    const messageApi = makeMessageApi()
    handleApprovalActionError(
      httpError('ERR_SOMETHING', { error: { message: 'Server said no' } }),
      {
        messageApi,
        t,
      },
    )
    expect((messageApi as { error: ReturnType<typeof vi.fn> }).error).toHaveBeenCalledWith(
      'Server said no',
    )
  })

  it('falls back to a generic message for non-HttpError values', () => {
    const messageApi = makeMessageApi()
    handleApprovalActionError(new Error('nope'), { messageApi, t })
    expect((messageApi as { error: ReturnType<typeof vi.fn> }).error).toHaveBeenCalledWith(
      'common:errors.genericError',
    )
  })
})
