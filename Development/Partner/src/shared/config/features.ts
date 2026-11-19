/**
 * Parts of the portal that are built but switched off.
 *
 * `integrations`: restaurant webhooks (stories PP9). Out of Phase 1 scope, and
 * the API does not deliver webhooks yet, so the page is hidden until go-live
 * to avoid promising something that does not happen.
 */
export const FEATURES = {
  integrations: false,
} as const
