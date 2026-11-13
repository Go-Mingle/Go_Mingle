import React from 'react'
import { Result, Button } from 'antd'
import { captureException } from '../configs/sentry'

interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureException(error, { extra: { componentStack: info.componentStack } })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Result
            status="error"
            title="Something went wrong"
            subTitle="An unexpected error occurred. Our team has been notified."
            extra={
              <Button type="primary" onClick={() => this.setState({ hasError: false })}>
                Try again
              </Button>
            }
          />
        </div>
      )
    }
    return this.props.children
  }
}
