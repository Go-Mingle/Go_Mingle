import type { ModuleColour } from './types'

export const ROLES_ENDPOINTS = {
  list: '/api/v1/roles',
  byId: (id: string) => `/api/v1/roles/${id}`,
  active: '/api/v1/roles/active',
  permissionKeys: '/api/v1/roles/permission-keys',
} as const

export const ROLES_PAGE_SIZE = 10

// Module badges in the roles listing now use a single neutral palette
// for every module. The map is intentionally left empty so the rendering
// code falls back to `defaultModuleColour` for every label.
export const moduleColours: Record<string, ModuleColour> = {}

export const defaultModuleColour: ModuleColour = {
  bg: 'var(--color-divider)',
  text: 'var(--color-text-secondary)',
}
