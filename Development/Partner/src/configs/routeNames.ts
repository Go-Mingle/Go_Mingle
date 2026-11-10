export const routeNames = {
  root: '/',
  login: '/login',
  // Add route paths here. Keep paths in one place so links and route definitions stay in sync.
} as const

export type RouteName = (typeof routeNames)[keyof typeof routeNames]
