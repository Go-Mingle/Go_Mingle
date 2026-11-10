import { RouterProvider } from 'react-router-dom'
import { router } from '../app/router'

export function AppRouterProvider() {
  return <RouterProvider router={router} />
}
