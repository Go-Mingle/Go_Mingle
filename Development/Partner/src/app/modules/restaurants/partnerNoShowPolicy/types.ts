/**
 * The restaurant's no-show policy.
 *
 * A penalty of 0 is a valid policy: no card hold is placed and nothing is
 * charged. A change applies to bookings made from then on.
 */
export interface NoShowPolicy {
  /** Charged per empty seat, in PKR. */
  penaltyPerSeatPkr: number
  /** A Mingler can cancel free of charge until this many hours before the start. */
  cancellationWindowHours: number
  /** The server's limits, so the form never offers a value it would refuse. */
  limits: { penaltyMaxPkr: number; windowMaxHours: number }
}

export interface SaveNoShowPolicyDto {
  penaltyPerSeatPkr: number
  cancellationWindowHours: number
}

export type NoShowPolicyField = keyof SaveNoShowPolicyDto
