import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Result } from 'antd'
import { captureException } from '../shared/observability/sentry'

interface State {
  hasError: boolean
}

/** Last line of defence for render crashes: reports the error and offers a way back. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureException(error, { extra: { componentStack: info.componentStack } })
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Result
          status="error"
          title="Something went wrong"
          subTitle="An unexpected error occurred. Please try again."
          extra={
            <Button type="primary" onClick={() => this.setState({ hasError: false })}>
              Try again
            </Button>
          }
        />
      </div>
    )
  }
}
