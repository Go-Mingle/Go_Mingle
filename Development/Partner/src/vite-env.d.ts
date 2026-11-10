/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_AUTH_MODE?: string
  readonly VITE_SHOW_DEMO_CREDENTIALS?: string
  readonly VITE_MSW_MODE?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_ENABLE_MOCKS?: string
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  /** GoMingle-Partners Cognito user pool id. Unset → the mock auth provider. */
  readonly VITE_COGNITO_PARTNERS_POOL_ID?: string
  /** GoMingle-Partners Cognito app client id. Unset → the mock auth provider. */
  readonly VITE_COGNITO_PARTNERS_CLIENT_ID?: string
  readonly VITE_COGNITO_REGION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
