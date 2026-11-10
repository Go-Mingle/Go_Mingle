import { useActiveInterestsQuery } from '../../interests/hooks/useInterestsQuery'

/**
 * Interests offered by the topic form's multi-select.
 *
 * Deliberately the *same* query as the Interests screen — `['interests','active']`
 * over `GET /api/v1/interests/active`. Two reasons, both regressions this hook
 * used to carry (MET-1304):
 *
 * 1. The interest create / update / delete mutations invalidate the `['interests']`
 *    prefix. A private key here (`['interests-catalogue']`) matched no prefix and
 *    was never invalidated by anything, so a just-deleted interest stayed
 *    selectable in this dropdown.
 * 2. It fetched `/api/v1/interests` with no params, so the server's default
 *    `pageSize=25` silently capped the list; `/active` is unpaginated by design.
 */
export function useInterestsCatalogue() {
  return useActiveInterestsQuery()
}
