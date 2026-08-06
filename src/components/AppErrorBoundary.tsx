import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { reportClientError } from '../lib/diagnostics'

type Props = { children: ReactNode }
type State = { hasError: boolean }

/** Keep a lazy-chunk or render failure actionable instead of showing a blank page. */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError('render', error, {
      source: 'react-error-boundary',
      retryable: true,
      phase: info.componentStack ? 'component-stack-captured' : 'render-failed',
    })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="error-screen" role="alert">
        <div className="error-screen__icon" aria-hidden="true"><AlertTriangle size={24} /></div>
        <h1>Workspace could not load</h1>
        <p>A page module failed to initialize. Your wallet and Shelby data are safe. Reload the app and try again.</p>
        <button type="button" className="btn-gold error-screen__action" onClick={() => window.location.reload()}>
          <RefreshCw size={16} aria-hidden="true" /> Reload app
        </button>
      </main>
    )
  }
}
