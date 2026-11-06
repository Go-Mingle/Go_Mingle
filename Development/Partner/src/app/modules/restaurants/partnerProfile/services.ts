import { httpClient } from '../../../../shared/api/httpClient'
import { CONTACT_SEARCH_FIELDS, CONTACT_SORT_FIELDS, PARTNER_PROFILE_ENDPOINTS } from './constants'
import type {
  ContactInput,
  ContactSearchField,
  ContactSortBy,
  ContactsQueryParams,
  DeleteContactResponse,
  OnboardingLinkResponse,
  PartnerContact,
  PartnerRestaurantProfile,
  SubmitProfileResponse,
  UpdateProfileDto,
} from './types'

/**
 * Validates the contacts list params.
 *
 * A bad `sortBy` or `searchField` is a **422** on this endpoint, not a silent
 * fallback, so anything unrecognised is dropped rather than forwarded. A search
 * term without a field is also dropped — the backend ignores it.
 */
export function sanitiseContactsParams(raw: Record<string, unknown> = {}): ContactsQueryParams {
  const params: ContactsQueryParams = {}

  if (
    typeof raw.sortBy === 'string' &&
    (CONTACT_SORT_FIELDS as readonly string[]).includes(raw.sortBy)
  ) {
    params.sortBy = raw.sortBy as ContactSortBy
  }
  if (raw.sortOrder === 'asc' || raw.sortOrder === 'desc') {
    params.sortOrder = raw.sortOrder
  }

  const field =
    typeof raw.searchField === 'string' &&
    (CONTACT_SEARCH_FIELDS as readonly string[]).includes(raw.searchField)
      ? (raw.searchField as ContactSearchField)
      : undefined
  const term = typeof raw.search === 'string' ? raw.search.trim() : ''
  if (field && term) {
    params.searchField = field
    params.search = term
  }

  return params
}

function contactsQuery(params: ContactsQueryParams): string {
  const search = new URLSearchParams()
  if (params.sortBy) search.set('sortBy', params.sortBy)
  if (params.sortOrder) search.set('sortOrder', params.sortOrder)
  if (params.searchField) search.set('searchField', params.searchField)
  if (params.search) search.set('search', params.search)
  const query = search.toString()
  return query ? `?${query}` : ''
}

/**
 * J6A's nine client-callable endpoints. The tenth is Safepay's inbound webhook,
 * which the browser never calls.
 *
 * No restaurant id is ever sent: scope comes from the access token (F1 BR-04).
 */
export const partnerProfileService = {
  /** Everything the page needs in one call (endpoint 1). */
  get: (): Promise<PartnerRestaurantProfile> =>
    httpClient.get<PartnerRestaurantProfile>(PARTNER_PROFILE_ENDPOINTS.restaurant),

  /**
   * The single write behind the header modal, all four Overview cards, the cover
   * replace and the visibility toggle (endpoint 2). Callers send only the fields
   * their card owns — an absent key is left untouched.
   */
  update: (data: UpdateProfileDto): Promise<PartnerRestaurantProfile> =>
    httpClient.patch<PartnerRestaurantProfile>(PARTNER_PROFILE_ENDPOINTS.restaurant, data),

  /**
   * Submits for approval (endpoint 8). A gate failure is a 422 carrying all three
   * blockers together; the caller renders every applicable message at once.
   */
  submit: (): Promise<SubmitProfileResponse> =>
    httpClient.post<SubmitProfileResponse>(PARTNER_PROFILE_ENDPOINTS.submit, {}),

  /**
   * Explicit "Save as Draft" (endpoint 9) — narrower than PATCH by status, and
   * it does not enforce the submission gate, since a Draft may be incomplete.
   */
  saveDraft: (data: UpdateProfileDto): Promise<PartnerRestaurantProfile> =>
    httpClient.post<PartnerRestaurantProfile>(PARTNER_PROFILE_ENDPOINTS.saveDraft, data),

  /**
   * Mints a Safepay AccountLink (endpoint 7). Single-use and short-lived, so it is
   * never cached — every call returns a different URL. `mode` distinguishes
   * first-time onboarding from revising an existing account.
   */
  createOnboardingLink: (): Promise<OnboardingLinkResponse> =>
    httpClient.post<OnboardingLinkResponse>(PARTNER_PROFILE_ENDPOINTS.onboardingLink, {}),

  /** Contacts list (endpoint 3) — non-deleted only, sortable and searchable. */
  listContacts: (params: ContactsQueryParams = {}): Promise<{ items: PartnerContact[] }> =>
    httpClient.get<{ items: PartnerContact[] }>(
      `${PARTNER_PROFILE_ENDPOINTS.contacts}${contactsQuery(params)}`,
    ),

  /** Creates a contact (endpoint 4). Only `name` is required. */
  createContact: (data: ContactInput): Promise<PartnerContact> =>
    httpClient.post<PartnerContact>(PARTNER_PROFILE_ENDPOINTS.contacts, data),

  /** Updates a contact (endpoint 5); partial. */
  updateContact: (contactId: string, data: Partial<ContactInput>): Promise<PartnerContact> =>
    httpClient.patch<PartnerContact>(PARTNER_PROFILE_ENDPOINTS.contactById(contactId), data),

  /**
   * Soft-deletes a contact (endpoint 6). Blocked with `ERR_LAST_CONTACT` when it
   * is the only one left; re-adding the same person later works.
   */
  deleteContact: (contactId: string): Promise<DeleteContactResponse> =>
    httpClient.delete<DeleteContactResponse>(PARTNER_PROFILE_ENDPOINTS.contactById(contactId)),
}
