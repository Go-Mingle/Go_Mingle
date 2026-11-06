import { ConfigProvider } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'react-redux'
import * as Sentry from '@sentry/react'
import '../locales/i18n'
import { AppRouterProvider } from '../routes/AppRouterProvider'
import { store } from '../shared/store/store'
import { antdTheme } from '../styles/theme'

document.documentElement.dataset.theme = 'light'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 2 } },
})

export function App() {
  return (
    <Sentry.ErrorBoundary fallback={<p>Something went wrong.</p>}>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ConfigProvider theme={antdTheme}>
            <AppRouterProvider />
          </ConfigProvider>
        </QueryClientProvider>
      </Provider>
    </Sentry.ErrorBoundary>
  )
}
