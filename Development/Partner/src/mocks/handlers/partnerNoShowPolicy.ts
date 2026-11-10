import { http, HttpResponse } from 'msw'
import { NO_SHOW_POLICY_ENDPOINT } from '../../app/modules/restaurants/partnerNoShowPolicy/constants'
import type {
  NoShowPolicy,
  SaveNoShowPolicyDto,
} from '../../app/modules/restaurants/partnerNoShowPolicy/types'

/** Mock of the restaurant's no-show policy (tests and mock-only demos). */

const LIMITS = { penaltyMaxPkr: 100_000, windowMaxHours: 168 }

let policy: NoShowPolicy = { penaltyPerSeatPkr: 0, cancellationWindowHours: 24, limits: LIMITS }

export function resetMockNoShowPolicy() {
  policy = { penaltyPerSeatPkr: 0, cancellationWindowHours: 24, limits: LIMITS }
}

export function setMockNoShowPolicy(next: SaveNoShowPolicyDto) {
  policy = { ...next, limits: LIMITS }
}

export function mockNoShowPolicy(): NoShowPolicy {
  return { ...policy }
}

export const partnerNoShowPolicyHandlers = [
  http.get(NO_SHOW_POLICY_ENDPOINT, () => HttpResponse.json({ success: true, data: policy })),
  http.put(NO_SHOW_POLICY_ENDPOINT, async ({ request }) => {
    const body = (await request.json()) as Partial<SaveNoShowPolicyDto>
    const fields: Record<string, string> = {}
    const penalty = body.penaltyPerSeatPkr
    const hours = body.cancellationWindowHours
    if (typeof penalty !== 'number' || penalty < 0) fields.penaltyPerSeatPkr = 'Enter an amount of 0 or more.'
    else if (penalty > LIMITS.penaltyMaxPkr) {
      fields.penaltyPerSeatPkr = 'The penalty can be at most PKR 100,000 per seat.'
    }
    if (typeof hours !== 'number' || !Number.isInteger(hours) || hours < 0) {
      fields.cancellationWindowHours = 'Enter a whole number of hours, 0 or more.'
    } else if (hours > LIMITS.windowMaxHours) {
      fields.cancellationWindowHours = 'The cancellation window can be at most 168 hours.'
    }
    if (Object.keys(fields).length > 0) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'ERR_VALIDATION', message: 'Please correct the highlighted fields.', details: { fields } },
        },
        { status: 422 },
      )
    }
    policy = { penaltyPerSeatPkr: penalty as number, cancellationWindowHours: hours as number, limits: LIMITS }
    return HttpResponse.json({ success: true, data: policy })
  }),
]
