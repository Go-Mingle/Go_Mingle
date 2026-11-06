import { HttpResponse } from 'msw'
import { DESIGNATION_MAX_LENGTH, FULL_NAME_MAX_LENGTH } from '../../app/modules/account/constants'
import type { PartnerProfile } from '../../app/modules/account/types'

/** Mutable so a save in the demo persists for the session. */
export const mockPartnerProfile: PartnerProfile = {
  id: 'pu1',
  email: 'partner@gomingle.com',
  fullName: 'Hira Mansoor',
  designation: 'Owner',
  isPrimary: true,
  // Always false — email is the Cognito username (BR-12).
  emailEditable: false,
}

const INITIAL = { ...mockPartnerProfile }

export function resetMockPartnerProfile(): void {
  Object.assign(mockPartnerProfile, INITIAL)
}

function errorEnvelope(code: string, message: string, status: number) {
  return HttpResponse.json({ success: false, error: { code, message } }, { status })
}

export const accountResponses = {
  profile: (overrides: Partial<PartnerProfile> = {}) =>
    HttpResponse.json({ success: true, data: { ...mockPartnerProfile, ...overrides } }),

  nameRequired: () => errorEnvelope('ERR_VALIDATION', 'Full name is required.', 422),

  designationTooLong: () =>
    errorEnvelope('ERR_VALIDATION', 'Designation must be 100 characters or fewer.', 422),

  suspended: () =>
    errorEnvelope(
      'ERR_ACCOUNT_SUSPENDED',
      'Your account has been suspended. Please contact support.',
      403,
    ),

  internal: () => errorEnvelope('ERR_INTERNAL', 'Something went wrong.', 500),
}

/** Mirrors the backend's validation so the demo surfaces the same 422s. */
export function validateProfilePatch(body: Record<string, unknown>) {
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  if (!fullName || fullName.length > FULL_NAME_MAX_LENGTH) return accountResponses.nameRequired()
  if (typeof body.designation === 'string' && body.designation.length > DESIGNATION_MAX_LENGTH) {
    return accountResponses.designationTooLong()
  }
  return null
}
