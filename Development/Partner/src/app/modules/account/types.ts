export interface PartnerProfile {
  id: string
  email: string
  fullName: string
  designation: string | null
  isPrimary: boolean
  /** Always false — email is the Cognito username and immutable (BR-12). */
  emailEditable: boolean
}

/**
 * Exactly these keys. The backend runs `forbidNonWhitelisted`, so sending
 * `email` is rejected outright rather than ignored.
 *
 * Omitting `designation` keeps the stored value; sending `''` clears it — that
 * is how a partner removes it.
 */
export interface UpdatePartnerProfileDto {
  fullName: string
  designation?: string
}
