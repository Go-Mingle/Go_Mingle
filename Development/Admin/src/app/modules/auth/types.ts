export interface LoginDto {
  email: string
  password: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  /** Module permission keys granted to the user's role (resolved via GET /api/v1/roles/{id}). */
  permissions: string[]
  /** When true the role has access to every module regardless of `permissions`. */
  fullAccess: boolean
  initials: string
  color?: string
}

export interface AuthTokenResponse {
  token: string
  user: AuthUser
}

export interface RequestOtpDto {
  email: string
}

export interface VerifyOtpDto {
  email: string
  otp: string
}

export interface ForgotPasswordVerifyResponse {
  resetSessionToken: string
}
