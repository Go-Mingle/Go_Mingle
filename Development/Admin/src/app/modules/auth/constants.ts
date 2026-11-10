export const AUTH_ENDPOINTS = {
  login: '/api/v1/auth/login',
  requestOtp: '/api/v1/auth/otp/request',
  verifyOtp: '/api/v1/auth/otp/verify',
  recordLoginResult: '/api/v1/auth/record-login-result',
  me: '/api/v1/auth/me',
  changePassword: '/api/v1/auth/change-password',
  forgotRequest: '/api/v1/auth/forgot-password/request-code',
  forgotVerify: '/api/v1/auth/forgot-password/verify-code',
  forgotReset: '/api/v1/auth/forgot-password/reset',
} as const

export const OTP_LENGTH = 6
export const OTP_RESEND_COOLDOWN_SECONDS = 60
export const PASSWORD_MIN_LENGTH = 8
