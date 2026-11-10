import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { partnerRetryPolicy } from '../../../../../shared/api/retryPolicy'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { PARTNER_SESSION_QUERY_KEY } from '../../../session/constants'
import { PARTNER_CONTACTS_QUERY_KEY, PARTNER_PROFILE_QUERY_KEY } from '../constants'
import { partnerProfileService } from '../services'
import type {
  ContactInput,
  ContactsQueryParams,
  PartnerContact,
  PartnerRestaurantProfile,
  UpdateProfileDto,
} from '../types'

/**
 * J6A's server state.
 *
 * Mutations own cache writes only; toasts, modal closing and form resets stay
 * with the caller's `mutate` callbacks.
 */

/** The whole profile in one read — header, all four cards, readiness, rejections. */
export function usePartnerProfileQuery() {
  return useQuery<PartnerRestaurantProfile>({
    queryKey: PARTNER_PROFILE_QUERY_KEY,
    queryFn: partnerProfileService.get,
    enabled: tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

/**
 * Every profile write returns the updated restaurant in the same shape as the
 * read, so the response is written straight into the cache rather than
 * refetched. `submissionReadiness` and `editable` come back recomputed, which is
 * what keeps the submit button and the read-only state honest after each save.
 */
function useProfileWriteCache() {
  const qc = useQueryClient()
  return (updated: PartnerRestaurantProfile) => {
    qc.setQueryData(PARTNER_PROFILE_QUERY_KEY, updated)
  }
}

export function useUpdateProfileMutation() {
  const writeCache = useProfileWriteCache()
  return useMutation({
    mutationFn: (data: UpdateProfileDto) => partnerProfileService.update(data),
    onSuccess: writeCache,
  })
}

/**
 * J6A endpoint 9. **No UI entry point today** — the Save as Draft button was
 * removed because BR-04 already persists every card as it is saved, so the
 * button only ever re-sent an empty body and toasted. Kept because the endpoint
 * is live server-side and the spec still lists it (AC-01.2 / US-07); restoring
 * the button is then a one-line change rather than a re-integration.
 */
export function useSaveDraftMutation() {
  const writeCache = useProfileWriteCache()
  return useMutation({
    mutationFn: (data: UpdateProfileDto) => partnerProfileService.saveDraft(data),
    onSuccess: writeCache,
  })
}

/**
 * Submitting changes the status, which changes every affordance on the page, so
 * the profile is invalidated rather than patched — the response carries only the
 * new status and a message.
 *
 * The session goes with it. `route` is derived server-side from
 * `restaurants.status` (F1 BR-12), so a submit has just moved the partner to
 * UNDER_REVIEW — but the session query has a five-minute `staleTime`, and
 * without this the partner sits on a now-read-only profile for up to five
 * minutes with nothing confirming the application went back for review. This is
 * how a resubmit after a decline reaches the review screen (J6A AC-07.6).
 */
export function useSubmitProfileMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => partnerProfileService.submit(),
    onSuccess: () => {
      // Exact, or the prefix match drags every sibling key in the module with it.
      void qc.invalidateQueries({ queryKey: PARTNER_PROFILE_QUERY_KEY, exact: true })
      // The session is genuinely load-bearing here: submit moves the status, and
      // the route derives from it.
      void qc.invalidateQueries({ queryKey: PARTNER_SESSION_QUERY_KEY })
    },
  })
}

/**
 * Mints a Safepay onboarding link. Deliberately no cache write: the link is
 * single-use and short-lived, so caching it would hand a partner a dead URL.
 */
export function useOnboardingLinkMutation() {
  return useMutation({
    mutationFn: () => partnerProfileService.createOnboardingLink(),
  })
}

export function usePartnerContactsQuery(params: ContactsQueryParams) {
  return useQuery<{ items: PartnerContact[] }>({
    // Params belong in the key so each sort/search view caches separately.
    queryKey: [...PARTNER_CONTACTS_QUERY_KEY, params],
    queryFn: () => partnerProfileService.listContacts(params),
    enabled: tokenStore.hasSession(),
    placeholderData: (previous) => previous,
    ...partnerRetryPolicy,
  })
}

/**
 * A contact write can change the last-contact guard and, while ACTIVE, notifies
 * the admin — so both the contact list and the profile are invalidated.
 */
function useContactsWriteCache() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: PARTNER_CONTACTS_QUERY_KEY })
    // Exact, or the prefix match drags every sibling key in the module with it.
    void qc.invalidateQueries({ queryKey: PARTNER_PROFILE_QUERY_KEY, exact: true })
  }
}

export function useCreateContactMutation() {
  const invalidate = useContactsWriteCache()
  return useMutation({
    mutationFn: (data: ContactInput) => partnerProfileService.createContact(data),
    onSuccess: invalidate,
  })
}

export function useUpdateContactMutation() {
  const invalidate = useContactsWriteCache()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ContactInput> }) =>
      partnerProfileService.updateContact(id, data),
    onSuccess: invalidate,
  })
}

export function useDeleteContactMutation() {
  const invalidate = useContactsWriteCache()
  return useMutation({
    mutationFn: (id: string) => partnerProfileService.deleteContact(id),
    onSuccess: invalidate,
  })
}
