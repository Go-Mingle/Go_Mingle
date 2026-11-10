import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { partnerRetryPolicy } from '../../../../shared/api/retryPolicy'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { PARTNER_SESSION_QUERY_KEY } from '../../session/constants'
import type { PartnerSession } from '../../session/types'
import { PARTNER_ME_QUERY_KEY } from '../constants'
import { accountService } from '../services'
import type { PartnerProfile, UpdatePartnerProfileDto } from '../types'

/** The signed-in partner's own profile, for the My Profile modal. */
export function usePartnerProfile(enabled = true) {
  return useQuery({
    queryKey: PARTNER_ME_QUERY_KEY,
    queryFn: accountService.getMe,
    enabled: enabled && tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

/**
 * Saves the partner's own name and designation.
 *
 * The response is the updated profile, so it is written straight into the cache
 * — no follow-up GET. UI feedback stays with the caller's `mutate` callbacks,
 * matching the mutation-hook convention across the app.
 */
export function useUpdatePartnerProfileMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdatePartnerProfileDto) => accountService.updateMe(data),
    onSuccess: (updated: PartnerProfile) => {
      qc.setQueryData(PARTNER_ME_QUERY_KEY, updated)
      // The name also shows in session-derived surfaces (the topbar, the avatar
      // menu). The session read carries `fullName`/`designation` on its
      // `partnerUser`, so patch those two fields rather than refetching the whole
      // session — nothing else about it can have changed.
      qc.setQueryData<PartnerSession>(
        PARTNER_SESSION_QUERY_KEY,
        (session) =>
          session && {
            ...session,
            partnerUser: {
              ...session.partnerUser,
              fullName: updated.fullName,
              designation: updated.designation,
            },
          },
      )
    },
  })
}
