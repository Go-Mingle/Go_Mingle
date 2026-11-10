export const ENV = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '',
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN ?? '',
  APP_VERSION: import.meta.env.VITE_APP_VERSION ?? '1.0.0',
  AWS_REGION: import.meta.env.VITE_AWS_REGION ?? '',
  COGNITO_CLIENT_ID: import.meta.env.VITE_COGNITO_CLIENT_ID ?? '',
  /**
   * `api` signs admins in against the GoMingle backend (`POST /api/v1/auth/login`,
   * JWT access + refresh tokens); `cognito` uses the AWS Cognito user pool.
   * Unset: Cognito when VITE_AWS_REGION and VITE_COGNITO_CLIENT_ID are both set,
   * otherwise the backend — so a local checkout can always sign in.
   */
  AUTH_MODE: import.meta.env.VITE_AUTH_MODE ?? '',
  // /open-app deep-link hand-off. IOS_APP_ID and ANDROID_PACKAGE_NAME are empty
  // by default; while unset each platform degrades to WEB_FALLBACK_URL rather
  // than sending users to a store listing that does not exist.
  APP_DEEP_LINK_SCHEME: import.meta.env.VITE_APP_DEEP_LINK_SCHEME ?? 'gomingle',
  IOS_APP_ID: import.meta.env.VITE_IOS_APP_ID ?? '',
  ANDROID_PACKAGE_NAME: import.meta.env.VITE_ANDROID_PACKAGE_NAME ?? '',
  WEB_FALLBACK_URL: import.meta.env.VITE_WEB_FALLBACK_URL ?? 'https://gomingle.com',
} as const
