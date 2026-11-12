/**
 * Google Identity Services ("Continue with Google").
 *
 * Loads Google's script once and renders Google's own button, which hands back
 * an ID token (`credential`). The portal sends that token to the GoMingle API,
 * which verifies it with Google before signing the partner in.
 */

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

export interface GoogleCredentialResponse {
  credential: string
}

interface GoogleButtonOptions {
  type: 'standard'
  theme: 'outline' | 'filled_blue' | 'filled_black'
  size: 'large' | 'medium' | 'small'
  text: 'signin_with' | 'signup_with' | 'continue_with'
  shape: 'rectangular' | 'pill'
  logo_alignment: 'left' | 'center'
  width: number
}

interface GoogleIdApi {
  initialize(config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    ux_mode?: 'popup' | 'redirect'
    context?: 'signin' | 'signup' | 'use'
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }): void
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void
  disableAutoSelect(): void
}

/** `window.google` is shared with the Maps script, so read it through a narrow view. */
const gis = (): GoogleIdApi | undefined =>
  (window as unknown as { google?: { accounts?: { id?: GoogleIdApi } } }).google?.accounts?.id

let loading: Promise<GoogleIdApi> | null = null

/** Resolves with the Google Identity API, loading Google's script the first time. */
export function loadGoogleIdentity(): Promise<GoogleIdApi> {
  const ready = gis()
  if (ready) return Promise.resolve(ready)
  loading ??= new Promise<GoogleIdApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => {
      const api = gis()
      if (api) resolve(api)
      else reject(new Error('Google sign-in did not load'))
    }
    script.onerror = () => {
      loading = null
      reject(new Error('Google sign-in did not load'))
    }
    document.head.appendChild(script)
  })
  return loading
}
