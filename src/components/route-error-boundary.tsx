import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Error boundary for lazy-loaded route pages.
 * Catches chunk-load failures (e.g. after a deploy with new hashes)
 * and offers a retry instead of showing a white screen.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route load failed:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0F1520] text-white flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <img
              src="/ChatOn-Logo-Small.png"
              alt="ChatOn"
              className="w-16 h-16 rounded-[20px] mx-auto mb-6"
            />
            <h1 className="text-lg font-bold mb-2">Something went wrong</h1>
            <p className="text-gray-400 text-sm mb-6">
              This page failed to load. This can happen after an update.
            </p>
            <button
              onClick={this.handleRetry}
              className="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
