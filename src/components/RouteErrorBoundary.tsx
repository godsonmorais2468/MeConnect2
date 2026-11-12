import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { isStaleBuildError, reloadForNewVersion } from '../lib/staleBuild'

type Props = { children: ReactNode; resetKey?: string }
type State = { failed: boolean; stale: boolean }

/** Catches a page that fails to load or draw, so one bad page never blanks the whole app. A page file that is gone (a new version went live) reloads the app once; anything else shows a message with a way back. Moving to another page clears it. */
export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, stale: false }

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, stale: isStaleBuildError(error) }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isStaleBuildError(error)) reloadForNewVersion()
    else console.error('[ME-CONNECT] page error', error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false, stale: false })
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="page">
        <div className="empty">
          <b>{this.state.stale ? 'A new version is ready.' : 'This page could not be shown.'}</b>
          {this.state.stale ? 'Reload to continue.' : 'Try again, or open another page from the menu.'}
          <div style={{ marginTop: 14 }}>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </div>
    )
  }
}
