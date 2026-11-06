import { describe, it, expect } from 'vitest'
import { http } from 'msw'
import { server } from '../../../../mocks/server'
import { accountResponses, mockPartnerProfile } from '../../../../mocks/data/partnerAccount'
import { HttpError } from '../../../../shared/api/httpClient'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { ACCOUNT_ENDPOINTS } from '../constants'
import { accountService } from '../services'

describe('accountService.getMe', () => {
  it('returns the signed-in partner profile', async () => {
    const profile = await accountService.getMe()

    expect(profile).toEqual(mockPartnerProfile)
    // Email is the Cognito username and can never be edited (BR-12).
    expect(profile.emailEditable).toBe(false)
  })

  it('surfaces a suspension as a 403 carrying the code', async () => {
    server.use(http.get(ACCOUNT_ENDPOINTS.me, accountResponses.suspended))

    const error = (await accountService.getMe().catch((e: unknown) => e)) as HttpError

    expect(error).toBeInstanceOf(HttpError)
    expect(error.status).toBe(403)
    expect(error.code).toBe('ERR_ACCOUNT_SUSPENDED')
  })

  it('surfaces an internal failure', async () => {
    server.use(http.get(ACCOUNT_ENDPOINTS.me, accountResponses.internal))

    const error = (await accountService.getMe().catch((e: unknown) => e)) as HttpError
    expect(error.status).toBe(500)
  })
})

describe('accountService.updateMe', () => {
  it('saves the name and designation and returns the updated profile', async () => {
    const updated = await accountService.updateMe({
      fullName: 'Laiba Hashmi',
      designation: 'General Manager',
    })

    expect(updated.fullName).toBe('Laiba Hashmi')
    expect(updated.designation).toBe('General Manager')
  })

  it('sends only fullName and designation — never email', async () => {
    // The backend runs forbidNonWhitelisted, so an email key is rejected rather
    // than ignored.
    let body: Record<string, unknown> = {}
    server.use(
      http.patch(ACCOUNT_ENDPOINTS.me, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return accountResponses.profile()
      }),
    )

    await accountService.updateMe({ fullName: 'Laiba Hashmi', designation: 'Owner' })

    expect(Object.keys(body).sort()).toEqual(['designation', 'fullName'])
    expect(body).not.toHaveProperty('email')
  })

  it('clears the designation when an empty string is sent', async () => {
    const updated = await accountService.updateMe({ fullName: 'Hira Mansoor', designation: '' })
    expect(updated.designation).toBeNull()
  })

  it('keeps the stored designation when the key is omitted', async () => {
    const updated = await accountService.updateMe({ fullName: 'Hira Mansoor' })
    expect(updated.designation).toBe('Owner')
  })

  it('accepts a no-op save', async () => {
    const updated = await accountService.updateMe({
      fullName: mockPartnerProfile.fullName,
      designation: mockPartnerProfile.designation ?? '',
    })
    expect(updated.fullName).toBe('Hira Mansoor')
  })

  it('rejects a blank name with the backend wording', async () => {
    const error = (await accountService
      .updateMe({ fullName: '   ' })
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(422)
    expect(error.responseBody).toMatchObject({ error: { message: 'Full name is required.' } })
  })

  it('rejects a designation over 100 characters', async () => {
    const error = (await accountService
      .updateMe({ fullName: 'Hira Mansoor', designation: 'x'.repeat(101) })
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(422)
    expect(error.responseBody).toMatchObject({
      error: { message: 'Designation must be 100 characters or fewer.' },
    })
  })

  it('rejects a name over 100 characters', async () => {
    const error = (await accountService
      .updateMe({ fullName: 'x'.repeat(101) })
      .catch((e: unknown) => e)) as HttpError

    expect(error.status).toBe(422)
  })

  it('sends the bearer token', async () => {
    tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
    let auth: string | null = null
    server.use(
      http.patch(ACCOUNT_ENDPOINTS.me, ({ request }) => {
        auth = request.headers.get('Authorization')
        return accountResponses.profile()
      }),
    )

    await accountService.updateMe({ fullName: 'Hira Mansoor' })

    expect(auth).toBe('Bearer access-1')
  })
})
