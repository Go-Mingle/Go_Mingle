import { http } from 'msw'
import { ACCOUNT_ENDPOINTS } from '../../app/modules/account/constants'
import { accountResponses, mockPartnerProfile, validateProfilePatch } from '../data/partnerAccount'

/**
 * J2's two owned endpoints. Login, forgot/reset, change-password and signout are
 * Cognito-direct and never reach MSW — they go through the auth-provider seam.
 */
export const partnerAccountHandlers = [
  http.get(ACCOUNT_ENDPOINTS.me, () => accountResponses.profile()),

  http.patch(ACCOUNT_ENDPOINTS.me, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>

    const invalid = validateProfilePatch(body)
    if (invalid) return invalid

    mockPartnerProfile.fullName = (body.fullName as string).trim()
    // Omitted keeps the current value; '' clears it.
    if (typeof body.designation === 'string') {
      mockPartnerProfile.designation = body.designation.trim() || null
    }
    return accountResponses.profile()
  }),
]
