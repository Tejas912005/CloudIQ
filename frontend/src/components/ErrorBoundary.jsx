import { Component } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  // ARCH-009 FIX: Reset error state when user navigates to a new route.
  // The parent passes routeKey={location.pathname} which changes on navigation.
  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.routeKey !== this.props.routeKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div
        className="rounded-lg border p-6"
        style={{ borderColor: 'rgba(255,68,102,0.2)', background: 'rgba(255,68,102,0.08)' }}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" style={{ color: 'var(--danger)' }} />
          <div className="flex-1">
            <p className="font-semibold" style={{ color: 'var(--text-base)' }}>Screen failed to render</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              {this.state.error.message}
            </p>
          </div>
          <button
            className="command-button"
            onClick={() => this.setState({ error: null })}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }
}
