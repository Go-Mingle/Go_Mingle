const BASE = '/api/v1/email-templates'

export const EMAIL_TEMPLATE_ENDPOINTS = {
  list: BASE,
  log: `${BASE}/log`,
  one: (key: string) => `${BASE}/${encodeURIComponent(key)}`,
  preview: (key: string) => `${BASE}/${encodeURIComponent(key)}/preview`,
  test: (key: string) => `${BASE}/${encodeURIComponent(key)}/test`,
  reset: (key: string) => `${BASE}/${encodeURIComponent(key)}/reset`,
} as const

/** How long the editor waits after the last keystroke before refreshing the preview. */
export const PREVIEW_DEBOUNCE_MS = 400
