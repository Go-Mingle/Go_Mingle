import { http, HttpResponse } from 'msw'
import { PARTNER_PROFILE_ENDPOINTS } from '../../app/modules/restaurants/partnerProfile/constants'
import {
  createMockContact,
  deleteMockContact,
  listMockContacts,
  onboardingLinkResponse,
  patchMockProfile,
  profileResponse,
  saveMockDraft,
  submitMockProfile,
  updateMockContact,
} from '../data/partnerRestaurantProfile'
import { partnerSessionState } from '../data/partnerSession'

/**
 * J6A's nine client-callable endpoints.
 *
 * The literal sub-paths (`/submit`, `/save-draft`, `/contacts`,
 * `/payments/onboarding-link`) are registered before the parameterised contact
 * route so they are not swallowed as a `contactId`.
 */
export const partnerRestaurantProfileHandlers = [
  http.get(PARTNER_PROFILE_ENDPOINTS.restaurant, () =>
    HttpResponse.json({ success: true, data: profileResponse() }),
  ),

  http.patch(PARTNER_PROFILE_ENDPOINTS.restaurant, async ({ request }) =>
    patchMockProfile((await request.json()) as Record<string, unknown>),
  ),

  http.post(PARTNER_PROFILE_ENDPOINTS.submit, () => {
    const response = submitMockProfile()
    // The real backend derives `route` from restaurants.status (F1 BR-12), so a
    // successful submit has just moved the partner to the review screen. Keep
    // the session fixture in step: the client invalidates the session on submit
    // precisely to pick this up, and a stale route would hand back the state it
    // just left — a resubmitting partner would sit on their own declined
    // profile with no sign the application had moved.
    if (response.ok) partnerSessionState.route = 'UNDER_REVIEW'
    return response
  }),

  http.post(PARTNER_PROFILE_ENDPOINTS.saveDraft, async ({ request }) =>
    saveMockDraft((await request.json()) as Record<string, unknown>),
  ),

  http.post(PARTNER_PROFILE_ENDPOINTS.onboardingLink, () => onboardingLinkResponse()),

  http.get(PARTNER_PROFILE_ENDPOINTS.contacts, ({ request }) => {
    const params = new URL(request.url).searchParams
    return listMockContacts({
      sortBy: params.get('sortBy'),
      sortOrder: params.get('sortOrder'),
      searchField: params.get('searchField'),
      search: params.get('search'),
    })
  }),

  http.post(PARTNER_PROFILE_ENDPOINTS.contacts, async ({ request }) =>
    createMockContact((await request.json()) as Record<string, unknown>),
  ),

  http.patch(`${PARTNER_PROFILE_ENDPOINTS.contacts}/:contactId`, async ({ params, request }) =>
    updateMockContact(String(params.contactId), (await request.json()) as Record<string, unknown>),
  ),

  http.delete(`${PARTNER_PROFILE_ENDPOINTS.contacts}/:contactId`, ({ params }) =>
    deleteMockContact(String(params.contactId)),
  ),
]
