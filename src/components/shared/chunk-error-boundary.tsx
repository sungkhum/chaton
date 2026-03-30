import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches lazy-chunk load failures (e.g. network error, CDN outage)
 * and renders a retry button instead of crashing the parent tree.
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  private retry = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex items-center justify-center p-4">
            <button
              onClick={this.retry}
              className="text-sm text-blue-400 hover:text-blue-300 cursor-pointer"
            >
              Failed to load. Tap to retry.
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
