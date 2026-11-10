import { httpClient } from '../../../../shared/api/httpClient'
import { NO_SHOW_POLICY_ENDPOINT } from './constants'
import type { NoShowPolicy, SaveNoShowPolicyDto } from './types'

export const noShowPolicyService = {
  get: (): Promise<NoShowPolicy> => httpClient.get<NoShowPolicy>(NO_SHOW_POLICY_ENDPOINT),
  save: (body: SaveNoShowPolicyDto): Promise<NoShowPolicy> =>
    httpClient.put<NoShowPolicy>(NO_SHOW_POLICY_ENDPOINT, body),
}
