import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureError } from "../utils/error-capture";
import { ERROR_CODES } from "../utils/error-codes";
import { useStore } from "../store";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/** True if the error looks like a stale/missing chunk after a deployment. */
function isChunkLoadError(error: Error): boolean {
  const msg = error.message || "";
  return (
    msg.includes("Loading chunk") ||
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Failed to fetch") ||
    msg.includes("MIME type") ||
    error.name === "ChunkLoadError"
  );
}

/**
 * Error boundary for lazy-loaded route pages.
 * Catches chunk-load failures (e.g. after a deploy with new hashes)
 * and offers a retry instead of showing a white screen.
 *
 * Note: most chunk errors are handled earlier by `lazyWithReload` (which
 * auto-reloads before this boundary is reached). This boundary is the
 * fallback for cases where the reload didn't help or for non-chunk errors.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Route load failed:", error, info);
    this.setState({ errorInfo: info });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleReport = () => {
    const error = this.state.error;
    if (!error) return;

    const ctx = captureError(
      isChunkLoadError(error)
        ? ERROR_CODES.CHUNK_LOAD_FAILED
        : ERROR_CODES.RENDER_ERROR,
      error.message || "Unknown render error",
      {
        stack: error.stack,
        component: "RouteErrorBoundary",
      }
    );
    useStore.getState().openBugReport(ctx);
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
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleReport}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Report Bug
              </button>
            </div>
            {this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60">
                  Error details (tap to expand)
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-black/40 border border-white/5 text-[10px] text-white/50 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                  {this.state.error.name}: {this.state.error.message}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                  {this.state.errorInfo?.componentStack &&
                    `\n\nComponent Stack:${this.state.errorInfo.componentStack}`}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
