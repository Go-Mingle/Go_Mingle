// Single source of truth for whether MSW should intercept requests.
// Previously this was `import.meta.env.DEV || VITE_ENABLE_MOCKS === 'true'`,
// which forced mocks on for every `npm run dev` session no matter what
// VITE_MSW_ENABLED said — so pointing VITE_API_BASE_URL at a real backend
// locally never actually reached it. VITE_MSW_ENABLED, when explicitly set,
// now always wins; when unset it falls back to the previous DEV-based
// default so CI/production builds (which never set this var) keep hitting
// the real API exactly as before.
export function isMocksEnabled(): boolean {
  const flag = import.meta.env.VITE_MSW_ENABLED
  if (flag === 'true') return true
  if (flag === 'false') return false
  return import.meta.env.DEV
}
