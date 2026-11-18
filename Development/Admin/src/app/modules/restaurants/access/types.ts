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
  designation: string | null
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
  /** Make the new login an owner straight away. */
  isOwner?: boolean
}

/** What an admin can change on a login. Leave a field out to keep it. */
export interface UpdateLoginPayload {
  fullName?: string
  email?: string
  designation?: string
  isOwner?: boolean
  status?: 'ACTIVE' | 'SUSPENDED'
}

export interface UpdateLoginResult {
  login: PortalLogin
  /** True when the login's email changed and the new address was emailed. */
  emailed: boolean
}

export interface GrantAccessResult {
  login: PortalLogin
  /** The email already had an empty account, which was moved to this restaurant. */
  moved: boolean
  emailed: boolean
}
