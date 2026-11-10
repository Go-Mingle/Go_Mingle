/* eslint-disable react-refresh/only-export-components */
import type { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import type { RenderOptions } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore, combineReducers, type Store } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import { I18nextProvider } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '../locales/i18n'
import { authSlice } from '../shared/store/authSlice'
import { uiSlice } from '../shared/store/uiSlice'

const rootReducer = combineReducers({
  auth: authSlice.reducer,
  ui: uiSlice.reducer,
})

export function makeStore(preloadedState?: Record<string, unknown>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState as never,
  })
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

interface ProvidersProps {
  children: ReactNode
  store?: Store
  queryClient?: QueryClient
  route?: string
  routes?: string[]
}

export function AllProviders({
  children,
  store = makeStore(),
  queryClient = makeQueryClient(),
  route = '/',
  routes,
}: ProvidersProps) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={i18n}>
          <MemoryRouter initialEntries={routes ?? [route]}>{children}</MemoryRouter>
        </I18nextProvider>
      </QueryClientProvider>
    </Provider>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  options: Omit<ProvidersProps, 'children'> & Omit<RenderOptions, 'wrapper'> = {},
) {
  const { store, queryClient, route, routes, ...renderOptions } = options
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders store={store} queryClient={queryClient} route={route} routes={routes}>
        {children}
      </AllProviders>
    ),
    ...renderOptions,
  })
}

export * from '@testing-library/react'
