'use client';

import React from 'react';
import { captureException } from '@/lib/sentry';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error Info:', errorInfo);

    // Report to Sentry (no-op when SENTRY_DSN is not set)
    captureException(error);

    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center px-4">
          <div className="bg-[#FFFCF3] rounded-2xl shadow-[0_8px_24px_rgba(61,46,30,0.12)] p-8 max-w-md w-full text-center">
            {/* HiMax Branding */}
            <div className="text-6xl mb-4">😊</div>
            <h1 className="text-2xl font-bold text-[#3D2E1E] mb-2">
              Oops! Something went wrong
            </h1>
            <p className="text-[#6B5744] mb-6">
              Don't worry! HiMax had a little hiccup. Let's try again.
            </p>

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="bg-[#F5F0E8] rounded-2xl p-4 mb-6 text-left text-xs text-[#3D2E1E] max-h-40 overflow-auto">
                <summary className="font-semibold cursor-pointer mb-2">
                  Error Details (Dev Only)
                </summary>
                <pre className="whitespace-pre-wrap break-words">
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <pre className="whitespace-pre-wrap break-words mt-2">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}

            {/* Try Again Button */}
            <button
              onClick={this.handleReset}
              className="w-full bg-[#5C8B5C] text-white font-bold py-3 px-6 rounded-2xl hover:bg-[#3D6B3D] transition-colors"
            >
              Try Again
            </button>

            {/* Fallback Link */}
            <div className="mt-4">
              <a
                href="/"
                className="text-[#5C8B5C] hover:underline text-sm font-semibold"
              >
                ← Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
