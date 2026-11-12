export const ENV = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '',
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN ?? '',
  APP_VERSION: import.meta.env.VITE_APP_VERSION ?? '1.0.0',
  /**
   * GoMingle-Partners Cognito pool. Both must be set for real authentication;
   * with either unset the app falls back to the mock auth provider, so the
   * MSW-backed demo keeps working until DevOps provisions the pool.
   */
  COGNITO_PARTNERS_POOL_ID: import.meta.env.VITE_COGNITO_PARTNERS_POOL_ID ?? '',
  COGNITO_PARTNERS_CLIENT_ID: import.meta.env.VITE_COGNITO_PARTNERS_CLIENT_ID ?? '',
  COGNITO_REGION: import.meta.env.VITE_COGNITO_REGION ?? 'me-central-1',
  /**
   * Which auth provider signs partners in: `api` (the GoMingle backend's own
   * JWTs), `cognito`, or `mock` (offline demo). Unset keeps the original rule —
   * Cognito when the pool is configured, otherwise the mock.
   */
  AUTH_MODE: import.meta.env.VITE_AUTH_MODE ?? '',
  /**
   * Maps JS + Places, for the Location & Address map picker. Read through here
   * rather than from `import.meta.env` at the point of use, so tests can mock
   * this module the way the Cognito suite already does. Unset is a supported
   * state: the picker renders a disabled placeholder instead of a map.
   */
  GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  /**
   * OAuth client id of the GoMingle Google Cloud project, for "Continue with
   * Google". Unset hides the button.
   */
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
} as const
