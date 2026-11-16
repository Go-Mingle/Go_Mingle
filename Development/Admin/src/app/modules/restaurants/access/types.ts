/** A restaurant profile a GoMingle admin created, waiting for its owner to complete and submit it. */
export interface InvitedRestaurant {
  id: string
  name: string
  ownerName: string
  ownerEmail: string
  /** ISO date-time the profile was created. */
  invitedAt: string
  invitedBy: string
  /** The owner has set a password or used Google at least once. */
  ownerSignedIn: boolean
  status: 'INVITED'
}

export interface CreateRestaurantPayload {
  name: string
  ownerName: string
  ownerEmail: string
  ownerPhone?: string
}

export interface CreateRestaurantResult extends InvitedRestaurant {
  /** False when the invitation email could not be sent. */
  emailed: boolean
}

/** Someone who can sign in to a restaurant on the Partner Portal. */
export interface PortalLogin {
  id: string
  fullName: string
  email: string
  isOwner: boolean
  status: string
  hasPassword: boolean
  hasGoogle: boolean
  /** Invited, but has not signed in yet. */
  pending: boolean
  lastActiveAt: string | null
}

export interface GrantAccessPayload {
  fullName: string
  email: string
}

export interface GrantAccessResult {
  login: PortalLogin
  /** The email already had an empty account, which was moved to this restaurant. */
  moved: boolean
  emailed: boolean
}
